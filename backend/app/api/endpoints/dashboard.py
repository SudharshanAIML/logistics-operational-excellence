from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from backend.app.db.database import get_db
from backend.app.db.models import DailyKPI, Alert, ScanEvent, ShiftSchedule, WorkerRoster, HourlyVolume
from backend.app.services import oei_calculator
from datetime import datetime, timedelta
from sqlalchemy import func

router = APIRouter()

@router.get("/summary")
def get_dashboard_summary(
    date: str = Query("2026-08-28", description="Date YYYY-MM-DD"),
    shift: str = Query(None, description="Shift Name (Day/Twilight/Night)"),
    db: Session = Depends(get_db)
):
    """
    Returns today's OEI summary score, sub-ratios, alerts, and hourly volumes.
    """
    date = oei_calculator.get_nearest_available_date(db, date)

    kpis = oei_calculator.get_oei_summary(db, date, shift)
    
    # Calculate weighted averages for the hub level
    total_oei = 0.0
    total_throughput = 0.0
    total_quality = 0.0
    total_utilization = 0.0
    total_cycle_time = 0.0
    total_workers = 0

    # We filter out redacted items for overall statistics, but still display them
    valid_kpis = [k for k in kpis if k.get("oei") is not None]
    if valid_kpis:
        total_oei = sum(k["oei"] for k in valid_kpis) / len(valid_kpis)
        total_throughput = sum(k["throughput_ratio"] for k in valid_kpis) / len(valid_kpis)
        total_quality = sum(k["quality_ratio"] for k in valid_kpis) / len(valid_kpis)
        total_utilization = sum(k["utilization_ratio"] for k in valid_kpis) / len(valid_kpis)
        total_cycle_time = sum(k["avg_cycle_time_min"] for k in valid_kpis) / len(valid_kpis)
        total_workers = sum(k["active_worker_count"] for k in valid_kpis)
        
    # Get active alerts
    alerts_db = db.query(Alert).filter(Alert.status == "active").all()
    alerts = [{
        "alert_id": a.alert_id,
        "timestamp": a.timestamp,
        "process": a.process,
        "zone": a.zone,
        "severity": a.severity,
        "alert_type": a.alert_type,
        "message": a.message,
        "status": a.status
    } for a in alerts_db]
    
    # Staffing gap calculation
    # Standard total headcount for day is ~32. Compare actual total workers.
    target_hc = 30
    staff_gap = total_workers - target_hc

    # Real week-over-week OEI delta, replacing a previously hardcoded "+0.04"
    week_ago_date = (datetime.strptime(date, "%Y-%m-%d") - timedelta(days=7)).strftime("%Y-%m-%d")
    week_ago_kpis = [
        k for k in oei_calculator.get_oei_summary(db, week_ago_date, shift)
        if k.get("oei") is not None
    ] if db.query(DailyKPI).filter(DailyKPI.date == week_ago_date).first() else []
    week_ago_oei = (sum(k["oei"] for k in week_ago_kpis) / len(week_ago_kpis)) if week_ago_kpis else None
    oei_delta_vs_last_week = round(total_oei - week_ago_oei, 3) if week_ago_oei is not None else None

    return {
        "date": date,
        "shift": shift or "All Shifts",
        "oei_score": round(total_oei, 2),
        "oei_delta_vs_last_week": oei_delta_vs_last_week,
        "throughput_ratio": round(total_throughput, 2),
        "quality_ratio": round(total_quality, 2),
        "utilization_ratio": round(total_utilization, 2),
        "avg_cycle_time_min": round(total_cycle_time, 1),
        "active_workers": total_workers,
        "staffing_gap": staff_gap,
        "alerts": alerts,
        "process_kpis": kpis
    }

@router.get("/trends")
def get_dashboard_trends(
    start_date: str = Query("2026-08-20", description="Start date YYYY-MM-DD"),
    end_date: str = Query("2026-08-28", description="End date YYYY-MM-DD"),
    db: Session = Depends(get_db)
):
    """
    Returns historical OEI trends for the network or hub comparison.
    """
    # If the requested range doesn't overlap real data at all, use the
    # trailing 7 real days ending on the latest available date instead.
    overlap_exists = db.query(DailyKPI).filter(
        DailyKPI.date >= start_date, DailyKPI.date <= end_date
    ).first()
    if not overlap_exists:
        latest = db.query(func.max(DailyKPI.date)).scalar()
        if latest:
            end_date = latest
            start_date = (datetime.strptime(latest, "%Y-%m-%d") - timedelta(days=7)).strftime("%Y-%m-%d")

    return oei_calculator.get_oei_trends(db, start_date, end_date)

@router.get("/waterfall")
def get_dashboard_waterfall(
    date: str = Query("2026-08-28"),
    shift: str = Query(None),
    db: Session = Depends(get_db)
):
    """
    Returns cycle times across process nodes in sequence.
    """
    date = oei_calculator.get_nearest_available_date(db, date)

    return oei_calculator.get_cycle_time_waterfall(db, date, shift)

@router.get("/heatmap")
def get_dashboard_heatmap(
    date: str = Query("2026-08-28"),
    shift: str = Query(None),
    db: Session = Depends(get_db)
):
    """
    Returns zone utilization percentages for heatmap visualization.
    """
    date = oei_calculator.get_nearest_available_date(db, date)

    # Reuse get_oei_summary so the heatmap respects the same privacy-floor
    # escalation logic (shift slice -> full-day rollup -> redaction) instead of
    # reading utilization_ratio directly with no floor check at all.
    kpis = oei_calculator.get_oei_summary(db, date, shift)

    heatmap = []
    for k in kpis:
        if k.get("utilization_ratio") is None:
            heatmap.append({
                "zone": k["zone"],
                "process": k["process"],
                "utilization": None,
                "state": "redacted",
                "active_workers": k["active_worker_count"]
            })
            continue

        util_pct = max(0, min(100, int(round(k["utilization_ratio"] * 100))))

        state = "idle"
        if util_pct > 95:
            state = "risk"
        elif util_pct > 85:
            state = "watch"
        elif util_pct >= 60:
            state = "ok"

        heatmap.append({
            "zone": k["zone"],
            "process": k["process"],
            "utilization": util_pct,
            "state": state,
            "active_workers": k["active_worker_count"]
        })

    return heatmap

STANDARD_UPH = {"unload": 140, "sort": 320, "stow": 110, "pick": 180, "pack": 150, "load": 200}
ZONE_LABEL = {"unload": "Unload Dock", "sort": "Primary Sort", "stow": "Stow", "pick": "Pick", "pack": "Pack", "load": "Load"}

@router.get("/efficiency")
def get_efficiency_dashboard(
    date: str = Query("2026-08-28"),
    shift: str = Query(None),
    db: Session = Depends(get_db)
):
    """
    Real, computed efficiency metrics for the Efficiency Dashboard page:
    facility-wide avg UPH, lost time, cost/package, an hourly throughput-vs-standard
    series, and a per-process zone audit - all derived from scan_events, shift_schedule,
    worker_roster, and daily_kpis (through the same privacy-floor escalation logic
    used elsewhere), replacing what was previously a fully hardcoded page.
    """
    date = oei_calculator.get_nearest_available_date(db, date)

    # Facility-wide average actual UPH across all scan events that day
    avg_uph = db.query(func.avg(ScanEvent.actual_uph)).filter(
        ScanEvent.timestamp.like(f"{date}%")
    ).scalar()

    # Lost time = paid hours that weren't productive, from real shift_schedule rows
    schedule_query = db.query(ShiftSchedule).filter(ShiftSchedule.schedule_date == date)
    if shift:
        schedule_query = schedule_query.filter(ShiftSchedule.shift_name == shift)
    schedules = schedule_query.all()
    lost_time_hours = sum(max(0.0, s.actual_hours_worked - s.productive_hours) for s in schedules)

    # Cost per package: total real labor cost (roster wage_rate * hours worked) / total real volume
    wage_by_worker = {w.worker_id: w.wage_rate for w in db.query(WorkerRoster).all()}
    total_labor_cost = sum(wage_by_worker.get(s.worker_id, 0.0) * s.actual_hours_worked for s in schedules)
    total_volume = db.query(func.sum(HourlyVolume.actual_volume)).filter(
        HourlyVolume.timestamp.like(f"{date}%")
    ).scalar() or 0
    cost_per_pkg = round(total_labor_cost / total_volume, 2) if total_volume else 0.0

    # Hourly throughput ratio (actual / standard), averaged across all processes -
    # a comparable normalized series since each process has a very different UPH scale
    throughput_series = []
    for hour in range(24):
        hour_events = db.query(ScanEvent).filter(
            ScanEvent.timestamp.like(f"{date} {hour:02d}:%")
        ).all()
        if not hour_events:
            continue
        ratios = [e.actual_uph / e.uph_standard for e in hour_events if e.uph_standard]
        if ratios:
            throughput_series.append({
                "time": f"{hour:02d}:00",
                "actual": round((sum(ratios) / len(ratios)) * 100, 1),
                "target": 100,
            })

    # Zone/process audit - OEI and quality (respecting the privacy floor escalation),
    # standard/actual UPH from real scan_events
    kpis = {k["process"]: k for k in oei_calculator.get_oei_summary(db, date, shift)}
    zone_audit = []
    for process, standard in STANDARD_UPH.items():
        actual_uph_row = db.query(func.avg(ScanEvent.actual_uph)).filter(
            ScanEvent.timestamp.like(f"{date}%"), ScanEvent.process == process
        ).scalar()
        kpi = kpis.get(process)
        oei_val = kpi.get("oei") if kpi else None
        quality_loss_pct = round((1 - kpi["quality_ratio"]) * 100, 1) if kpi and kpi.get("quality_ratio") is not None else None

        status = "redacted" if oei_val is None else "risk" if oei_val < 0.75 else "watch" if oei_val < 0.85 else "ok"

        zone_audit.append({
            "belt": ZONE_LABEL[process],
            "process": process,
            "standard": standard,
            "actual": round(float(actual_uph_row), 1) if actual_uph_row else None,
            "oei": oei_val,
            "quality_loss_pct": quality_loss_pct,
            "status": status,
        })

    return {
        "date": date,
        "avg_uph": round(float(avg_uph), 1) if avg_uph else 0.0,
        "lost_time_hours": round(lost_time_hours, 1),
        "cost_per_pkg": cost_per_pkg,
        "throughput_series": throughput_series,
        "zone_audit": zone_audit,
    }

from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.app.db.database import get_db
from backend.app.db.models import ModelDriftLog, HourlyVolume, ScanEvent, WorkerRoster, DailyKPI
from sqlalchemy import func

router = APIRouter()

def _run_validation_rules(db: Session):
    """
    Real, computed data-quality checks against the live database - replaces the
    previous hardcoded "12 passed / 0 failed" placeholder.
    """
    rules = []

    # 1. No negative hourly volumes
    negative_volumes = db.query(HourlyVolume).filter(HourlyVolume.actual_volume < 0).count()
    rules.append({
        "rule_name": "volume_non_negative",
        "status": "passed" if negative_volumes == 0 else "failed",
        "message": (
            "All hourly volumes are >= 0." if negative_volumes == 0
            else f"{negative_volumes} rows have negative actual_volume."
        )
    })

    # 2. Worker counts within physical capacity
    total_workers = db.query(WorkerRoster).count()
    over_capacity = db.query(DailyKPI).filter(DailyKPI.active_worker_count > total_workers).count()
    rules.append({
        "rule_name": "worker_count_limit",
        "status": "passed" if over_capacity == 0 else "failed",
        "message": (
            f"All daily_kpis active_worker_count values are within the {total_workers}-worker roster."
            if over_capacity == 0
            else f"{over_capacity} rows report more active workers than exist in worker_roster ({total_workers})."
        )
    })

    # 3. No gaps in the hourly sequence, per process - compare row count to the
    # timestamp span in hours (DB-agnostic, works on both SQLite and Postgres)
    processes = [p for (p,) in db.query(HourlyVolume.process).distinct().all()]
    gap_count = 0
    for process in processes:
        row = db.query(
            func.min(HourlyVolume.timestamp).label("min_ts"),
            func.max(HourlyVolume.timestamp).label("max_ts"),
            func.count(HourlyVolume.timestamp).label("cnt"),
        ).filter(HourlyVolume.process == process).first()
        if row.min_ts and row.max_ts:
            span_hours = int((datetime.strptime(row.max_ts, "%Y-%m-%d %H:%M:%S") - datetime.strptime(row.min_ts, "%Y-%m-%d %H:%M:%S")).total_seconds() / 3600) + 1
            if span_hours != row.cnt:
                gap_count += abs(span_hours - row.cnt)

    rules.append({
        "rule_name": "timestamp_continuity",
        "status": "passed" if gap_count == 0 else "failed",
        "message": (
            "No gaps found in the hourly sequence for any process."
            if gap_count == 0
            else f"{gap_count} missing hourly readings detected across {len(processes)} processes."
        )
    })

    # 4. OEI values within the valid [0, 1] range
    invalid_oei = db.query(DailyKPI).filter(
        (DailyKPI.oei < 0) | (DailyKPI.oei > 1)
    ).count()
    rules.append({
        "rule_name": "oei_bounds",
        "status": "passed" if invalid_oei == 0 else "failed",
        "message": (
            "All daily_kpis.oei values fall within [0, 1]." if invalid_oei == 0
            else f"{invalid_oei} rows have an OEI value outside [0, 1]."
        )
    })

    # 5. Referential integrity: every scan_events.worker_id exists in worker_roster
    orphan_workers = db.query(ScanEvent.worker_id).filter(
        ~ScanEvent.worker_id.in_(db.query(WorkerRoster.worker_id))
    ).distinct().count()
    rules.append({
        "rule_name": "scan_event_worker_referential_integrity",
        "status": "passed" if orphan_workers == 0 else "failed",
        "message": (
            "Every scan_events.worker_id exists in worker_roster." if orphan_workers == 0
            else f"{orphan_workers} distinct worker_id values in scan_events have no matching worker_roster row."
        )
    })

    return rules

@router.get("/status")
def get_health_status(db: Session = Depends(get_db)):
    """
    Returns pipeline freshness, real record counts, and real data quality check results.
    """
    latest_ts = db.query(func.max(HourlyVolume.timestamp)).scalar()
    freshness = f"Latest data point: {latest_ts}" if latest_ts else "No data available"

    total_scan_events = db.query(ScanEvent).count()

    rules = _run_validation_rules(db)
    checks_passed = sum(1 for r in rules if r["status"] == "passed")
    checks_failed = sum(1 for r in rules if r["status"] == "failed")

    return {
        "status": "Healthy" if checks_failed == 0 else "Degraded",
        "pipeline_freshness": freshness,
        "total_scan_events_count": total_scan_events,
        "checks_passed": checks_passed,
        "checks_failed": checks_failed,
        "rules": rules
    }

@router.get("/drift")
def get_model_drift(db: Session = Depends(get_db)):
    """
    Returns the recent model drift log entries.
    """
    drifts_db = db.query(ModelDriftLog).order_by(ModelDriftLog.date.desc()).limit(15).all()
    
    drifts = [{
        "date": d.date,
        "model_name": d.model_name,
        "wape": round(d.wape, 4),
        "baseline_wape": round(d.baseline_wape, 4),
        "drift_score": round(d.drift_score, 4),
        "status": d.status
    } for d in drifts_db]
    
    return drifts

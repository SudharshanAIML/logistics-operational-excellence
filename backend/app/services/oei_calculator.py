from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.app.db.models import DailyKPI
from backend.app.core.aggregation import enforce_aggregation_floor
from backend.app.core.config import settings

def _weighted_rollup(rows, shift_label: str) -> dict:
    """
    Worker-count-weighted rollup of one or more daily_kpis rows for the same
    process into a single summary row (used to roll a shift-level slice up to
    a full-day view when the shift-level worker count is too small to display).
    """
    total_workers = sum(r.active_worker_count for r in rows)
    weights = [r.active_worker_count for r in rows]

    def wavg(attr):
        if total_workers > 0:
            return sum(getattr(r, attr) * w for r, w in zip(rows, weights)) / total_workers
        return sum(getattr(r, attr) for r in rows) / len(rows)

    return {
        "date": rows[0].date,
        "shift_name": shift_label,
        "process": rows[0].process,
        "zone": rows[0].zone,
        "throughput_ratio": round(wavg("throughput_ratio"), 3),
        "quality_ratio": round(wavg("quality_ratio"), 3),
        "utilization_ratio": round(wavg("utilization_ratio"), 3),
        "oei": round(wavg("oei"), 3),
        "avg_cycle_time_min": round(wavg("avg_cycle_time_min"), 1),
        "active_worker_count": total_workers,
    }

def get_nearest_available_date(db: Session, date_str: str) -> str:
    """
    Returns date_str if daily_kpis has rows for it, otherwise the closest
    real date on or before it, falling back to the latest date available.
    Replaces silently swapping in a single hardcoded literal date.
    """
    exists = db.query(DailyKPI).filter(DailyKPI.date == date_str).first()
    if exists:
        return date_str

    nearest = db.query(func.max(DailyKPI.date)).filter(DailyKPI.date <= date_str).scalar()
    if nearest:
        return nearest

    latest = db.query(func.max(DailyKPI.date)).scalar()
    return latest or date_str

def get_oei_summary(db: Session, date_str: str, shift_name: str = None):
    """
    Retrieves the OEI rollup for a specific day, one row per process, enforcing
    privacy floor limits.

    The synthetic roster generator assigns as few as 2 workers per
    process/shift/zone combination, which is almost always below the k>=5
    privacy floor at that grain. Rather than silently redacting nearly every
    row, a shift-level slice that falls below the floor is rolled up to the
    full day for that process (still summing to a real worker count, still
    enforcing the same floor) before falling back to redaction.
    """
    query = db.query(DailyKPI).filter(DailyKPI.date == date_str)
    if shift_name:
        query = query.filter(DailyKPI.shift_name == shift_name)

    kpis = query.all()

    by_process = {}
    for k in kpis:
        by_process.setdefault(k.process, []).append(k)

    results = []
    for process, rows in by_process.items():
        shift_worker_count = sum(r.active_worker_count for r in rows)

        if shift_name and shift_worker_count < settings.AGGREGATION_FLOOR:
            # Shift-level slice is too small to display on its own - escalate
            # to the full day (all shifts) for this process before redacting.
            all_shift_rows = db.query(DailyKPI).filter(
                DailyKPI.date == date_str, DailyKPI.process == process
            ).all()
            results.append(_weighted_rollup(all_shift_rows, "All Shifts (rolled up)"))
        else:
            results.append(_weighted_rollup(rows, shift_name or "All Shifts"))

    # Enforce privacy floor (still applies - only escalates grain, never bypasses it)
    return enforce_aggregation_floor(results)

def get_oei_trends(db: Session, start_date: str, end_date: str):
    """
    Aggregates overall OEI scores day-by-day for comparison (e.g. Monday vs Tuesday).
    """
    results = db.query(
        DailyKPI.date,
        func.avg(DailyKPI.oei).label("oei"),
        func.avg(DailyKPI.throughput_ratio).label("throughput_ratio"),
        func.avg(DailyKPI.quality_ratio).label("quality_ratio"),
        func.avg(DailyKPI.utilization_ratio).label("utilization_ratio"),
        func.sum(DailyKPI.active_worker_count).label("active_worker_count")
    ).filter(
        DailyKPI.date >= start_date,
        DailyKPI.date <= end_date
    ).group_by(DailyKPI.date).order_by(DailyKPI.date).all()
    
    trends = []
    for r in results:
        trends.append({
            "date": r.date,
            "oei": round(r.oei, 3) if r.oei else 0.0,
            "throughput_ratio": round(r.throughput_ratio, 3) if r.throughput_ratio else 0.0,
            "quality_ratio": round(r.quality_ratio, 3) if r.quality_ratio else 0.0,
            "utilization_ratio": round(r.utilization_ratio, 3) if r.utilization_ratio else 0.0,
            "active_worker_count": r.active_worker_count or 0
        })
        
    # Since this aggregates across the whole hub, worker count is high, but we still guard it.
    return enforce_aggregation_floor(trends)

def get_cycle_time_waterfall(db: Session, date_str: str, shift_name: str = None):
    """
    Retrieves cycle times for each process in the fulfillment flow:
    unload -> sort -> stow -> pick -> pack -> load.
    """
    query = db.query(DailyKPI).filter(DailyKPI.date == date_str)
    if shift_name:
        query = query.filter(DailyKPI.shift_name == shift_name)
        
    kpis = query.all()
    
    # Standard flow ordering
    flow = ["unload", "sort", "stow", "pick", "pack", "load"]
    waterfall = []
    
    for process in flow:
        # Find matching kpi
        matching = [k for k in kpis if k.process == process]
        if matching:
            # Average cycle time across zones for this process
            avg_cycle = sum(k.avg_cycle_time_min for k in matching) / len(matching)
            worker_count = sum(k.active_worker_count for k in matching)
            
            waterfall.append({
                "process": process,
                "label": process.upper(),
                "cycle_time": round(avg_cycle, 1),
                "active_worker_count": worker_count
            })
        else:
            waterfall.append({
                "process": process,
                "label": process.upper(),
                "cycle_time": 0.0,
                "active_worker_count": 0
            })
            
    # Guard privacy
    return enforce_aggregation_floor(waterfall, redact_keys=["cycle_time"])

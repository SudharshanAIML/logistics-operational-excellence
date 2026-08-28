from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.app.db.models import DailyKPI
from backend.app.core.aggregation import enforce_aggregation_floor

def get_oei_summary(db: Session, date_str: str, shift_name: str = None):
    """
    Retrieves the OEI rollup for a specific day across all processes and zones,
    enforcing privacy floor limits.
    """
    query = db.query(DailyKPI).filter(DailyKPI.date == date_str)
    if shift_name:
        query = query.filter(DailyKPI.shift_name == shift_name)
        
    kpis = query.all()
    
    results = []
    for kpi in kpis:
        item = {
            "date": kpi.date,
            "shift_name": kpi.shift_name,
            "process": kpi.process,
            "zone": kpi.zone,
            "throughput_ratio": kpi.throughput_ratio,
            "quality_ratio": kpi.quality_ratio,
            "utilization_ratio": kpi.utilization_ratio,
            "oei": kpi.oei,
            "avg_cycle_time_min": kpi.avg_cycle_time_min,
            "active_worker_count": kpi.active_worker_count
        }
        results.append(item)
        
    # Enforce privacy floor
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

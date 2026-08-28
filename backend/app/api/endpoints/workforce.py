import math
from fastapi import APIRouter, Depends, Query, Body
from sqlalchemy.orm import Session
from backend.app.db.database import get_db
from backend.app.services import roster_optimizer, oei_calculator
from typing import Dict, Any

router = APIRouter()

@router.get("/gaps")
def get_workforce_gaps(
    date: str = Query("2026-08-28"),
    db: Session = Depends(get_db)
):
    """
    Computes forecasted volume, required hours, headcount, and active roster gap.
    """
    # Query daily KPIs for available/actual workers
    kpis = oei_calculator.get_oei_summary(db, date)
    
    # Volume and standards
    standards = {
        "unload": 140, "sort": 320, "stow": 110, "pick": 180, "pack": 150, "load": 200
    }
    
    # We will simulate the forecasted volume and hours for each process
    gaps_table = []
    total_fcst_vol = 0
    total_req_hours = 0.0
    total_req_hc = 0
    total_avail_hc = 0
    total_gap = 0
    
    for p, std in standards.items():
        # Match kpi row
        kpi_row = next((k for k in kpis if k["process"] == p), None)
        active_wc = kpi_row["active_worker_count"] if kpi_row else 0
        
        # Calculate volume
        mock_volumes = {
            "unload": 4200, "sort": 12800, "stow": 3900, 
            "pick": 8400, "pack": 7100, "load": 9500
        }
        
        vol = mock_volumes[p]
        req_hrs = round(vol / std, 1)
        req_hc = max(2, math.ceil(req_hrs / 8.0))
        
        gap = active_wc - req_hc
        
        gaps_table.append({
            "process": p,
            "label": p.upper(),
            "forecast_volume": vol,
            "standard_uph": std,
            "required_hours": req_hrs,
            "required_headcount": req_hc,
            "available_headcount": active_wc,
            "gap": gap
        })
        
        total_fcst_vol += vol
        total_req_hours += req_hrs
        total_req_hc += req_hc
        total_avail_hc += active_wc
        total_gap += gap
        
    return {
        "date": date,
        "processes": gaps_table,
        "total": {
            "forecast_volume": total_fcst_vol,
            "required_hours": round(total_req_hours, 1),
            "required_headcount": total_req_hc,
            "available_headcount": total_avail_hc,
            "gap": total_gap
        }
    }

@router.post("/optimize")
def optimize_roster(
    date: str = Query("2026-08-28"),
    requirements: Dict[str, Dict[str, int]] = Body(None),
    db: Session = Depends(get_db)
):
    """
    Runs the CP-SAT optimizer to resolve roster constraints.
    """
    if requirements is None:
        # Default fallback requirements
        requirements = {
            "Day": {"unload": 5, "sort": 6, "stow": 5, "pick": 6, "pack": 5, "load": 5},
            "Twilight": {"unload": 6, "sort": 7, "stow": 6, "pick": 6, "pack": 5, "load": 5},
            "Night": {"unload": 3, "sort": 4, "stow": 3, "pick": 4, "pack": 3, "load": 3}
        }
    return roster_optimizer.optimize_shift_roster(db, date, requirements)

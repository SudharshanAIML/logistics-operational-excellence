from fastapi import APIRouter, Query, Depends
from sqlalchemy.orm import Session
from backend.app.db.database import get_db
from backend.app.services import simulator

router = APIRouter()

@router.get("/simulate")
def run_simulation(
    surge_pct: float = Query(0.0, description="Inbound volume surge percentage (-50% to +100%)"),
    absenteeism_pct: float = Query(6.0, description="Roster absenteeism rate percentage (0% to 30%)"),
    variance_pct: float = Query(0.0, description="Per-worker efficiency variance percentage (-20% to +20%)"),
    db: Session = Depends(get_db)
):
    """
    Triggers a SimPy digital twin simulation run and returns metrics.
    """
    return simulator.run_hub_simulation(surge_pct, absenteeism_pct, variance_pct, db=db)

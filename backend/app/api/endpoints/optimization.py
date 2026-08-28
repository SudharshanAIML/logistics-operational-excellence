from fastapi import APIRouter, Query
from backend.app.services import simulator

router = APIRouter()

@router.get("/simulate")
def run_simulation(
    surge_pct: float = Query(0.0, description="Inbound volume surge percentage (-50% to +100%)"),
    absenteeism_pct: float = Query(6.0, description="Roster absenteeism rate percentage (0% to 30%)")
):
    """
    Triggers a SimPy digital twin simulation run and returns metrics.
    """
    return simulator.run_hub_simulation(surge_pct, absenteeism_pct)

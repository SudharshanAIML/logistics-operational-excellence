from fastapi import APIRouter, Depends, Query, BackgroundTasks
from sqlalchemy.orm import Session
from backend.app.db.database import get_db
from backend.app.services import forecasting

router = APIRouter()

@router.get("/studio")
def get_forecast_studio(
    horizon: str = Query("1D", description="Horizon: 4H, 1D, 1W, 1M"),
    process: str = Query("unload", description="Process type"),
    db: Session = Depends(get_db)
):
    """
    Returns time series actuals and P10/P50/P90 predictions, along with accuracy backtest metrics.
    """
    return forecasting.get_forecast_studio_data(db, horizon, process)

@router.get("/drivers")
def get_forecast_drivers(
    process: str = Query("unload", description="Process type"),
    db: Session = Depends(get_db)
):
    """
    Returns the driver breakdown panel explaining forecast variations (real SHAP values).
    """
    return forecasting.get_forecast_drivers(db, process)

@router.post("/train")
def train_forecast_model(
    process: str = Query("unload"),
    background_tasks: BackgroundTasks = None,
    db: Session = Depends(get_db)
):
    """
    Triggers model training in background or synchronously and returns performance reports.
    """
    if background_tasks:
        background_tasks.add_task(forecasting.train_volume_forecast_model, db, process)
        return {"status": "training_scheduled", "message": f"LightGBM retraining initiated for process '{process}'."}
    else:
        res = forecasting.train_volume_forecast_model(db, process)
        return res

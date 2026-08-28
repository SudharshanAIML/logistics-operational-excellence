from fastapi import APIRouter
from backend.app.api.endpoints import dashboard, forecast, workforce, optimization, copilot, data_health

api_router = APIRouter()

api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
api_router.include_router(forecast.router, prefix="/forecast", tags=["Forecast"])
api_router.include_router(workforce.router, prefix="/workforce", tags=["Workforce"])
api_router.include_router(optimization.router, prefix="/optimization", tags=["Optimization"])
api_router.include_router(copilot.router, prefix="/copilot", tags=["Copilot"])
api_router.include_router(data_health.router, prefix="/data-health", tags=["Data Health"])

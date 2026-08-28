import asyncio
import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func
from backend.app.api.router import api_router
from backend.app.db.database import SessionLocal
from backend.app.db.models import ScanEvent

app = FastAPI(
    title="Synapse Ops API",
    description="UPS Ground Hub Operations Intelligence Platform API",
    version="1.0.0"
)

# CORS Configuration for React Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # for local development demo
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers
app.include_router(api_router, prefix="/api")

@app.get("/")
def read_root():
    return {"message": "Welcome to Synapse Ops API. Navigate to /docs for Swagger documentation."}

# Active WebSocket connections list
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                # remove stale connections
                self.disconnect(connection)

manager = ConnectionManager()

def _fetch_live_metrics() -> dict:
    """
    Reads the most recent real scan_events per process to build the live telemetry
    snapshot, instead of the previous random.uniform() placeholder values.
    """
    from backend.app.db.models import Alert

    db = SessionLocal()
    try:
        metrics = {}
        for process in ["unload", "sort", "stow", "pick", "pack", "load"]:
            # Average over the 200 most recent real scan events for this process
            # (ORDER BY + LIMIT must happen in a subquery before the aggregate)
            recent = db.query(ScanEvent.actual_uph).filter(
                ScanEvent.process == process
            ).order_by(ScanEvent.timestamp.desc()).limit(200).subquery()
            avg_uph = db.query(func.avg(recent.c.actual_uph)).scalar()
            metrics[f"{process}_uph"] = round(float(avg_uph), 1) if avg_uph is not None else 0.0

        metrics["active_alerts_count"] = db.query(Alert).filter(Alert.status == "active").count()
        return metrics
    finally:
        db.close()

# Background task streaming real, DB-derived telemetry over WebSocket
async def stream_live_ops_updates():
    while True:
        await asyncio.sleep(5.0) # Send updates every 5 seconds
        if manager.active_connections:
            metrics = await asyncio.to_thread(_fetch_live_metrics)
            live_data = {
                "type": "live_telemetry",
                "timestamp": asyncio.get_event_loop().time(),
                "metrics": metrics
            }
            await manager.broadcast(json.dumps(live_data))

@app.websocket("/ws/live")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # Send initial status
        await websocket.send_text(json.dumps({"type": "connection_established", "message": "Connected to Synapse telemetry"}))
        while True:
            # Keep connection open, client can send messages if needed
            data = await websocket.receive_text()
            # Echo or process client messages
            await websocket.send_text(json.dumps({"type": "echo", "data": data}))
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)

# Start background simulation telemetry when FastAPI starts
@app.on_event("startup")
async def startup_event():
    asyncio.create_task(stream_live_ops_updates())

from sqlalchemy import Column, String, Integer, Float, PrimaryKeyConstraint
from backend.app.db.database import Base

class WorkerRoster(Base):
    __tablename__ = "worker_roster"
    
    worker_id = Column(String, primary_key=True)
    name = Column(String)
    primary_role = Column(String)
    max_hours = Column(Float)
    rest_required = Column(Float)
    wage_rate = Column(Float)
    certifications = Column(String) # stored as JSON string

class ShiftSchedule(Base):
    __tablename__ = "shift_schedule"
    
    schedule_date = Column(String)
    shift_name = Column(String)
    worker_id = Column(String)
    assigned_zone = Column(String)
    assigned_process = Column(String)
    planned_hours = Column(Float)
    actual_hours_worked = Column(Float)
    productive_hours = Column(Float)
    absent_flag = Column(Integer)
    
    __table_args__ = (
        PrimaryKeyConstraint("schedule_date", "shift_name", "worker_id"),
    )

class ScanEvent(Base):
    __tablename__ = "scan_events"
    
    event_id = Column(String, primary_key=True)
    timestamp = Column(String)
    order_id = Column(String)
    item_id = Column(String)
    worker_id = Column(String)
    zone = Column(String)
    process = Column(String)
    uph_standard = Column(Float)
    actual_uph = Column(Float)
    status = Column(String)

class HourlyVolume(Base):
    __tablename__ = "hourly_volume"
    
    timestamp = Column(String)
    process = Column(String)
    zone = Column(String)
    actual_volume = Column(Integer)
    forecast_p10 = Column(Integer)
    forecast_p50 = Column(Integer)
    forecast_p90 = Column(Integer)
    temp = Column(Float)
    rain = Column(Float)
    holiday_flag = Column(Integer)
    
    __table_args__ = (
        PrimaryKeyConstraint("timestamp", "process"),
    )

class DailyKPI(Base):
    __tablename__ = "daily_kpis"
    
    date = Column(String)
    shift_name = Column(String)
    process = Column(String)
    zone = Column(String)
    throughput_ratio = Column(Float)
    quality_ratio = Column(Float)
    utilization_ratio = Column(Float)
    oei = Column(Float)
    avg_cycle_time_min = Column(Float)
    active_worker_count = Column(Integer)
    
    __table_args__ = (
        PrimaryKeyConstraint("date", "shift_name", "process", "zone"),
    )

class Alert(Base):
    __tablename__ = "alerts"
    
    alert_id = Column(String, primary_key=True)
    timestamp = Column(String)
    process = Column(String)
    zone = Column(String)
    severity = Column(String)
    alert_type = Column(String)
    message = Column(String)
    status = Column(String)

class SimulationRun(Base):
    __tablename__ = "simulation_runs"
    
    run_id = Column(String, primary_key=True)
    timestamp = Column(String)
    scenario_name = Column(String)
    inbound_surge_pct = Column(Float)
    absenteeism_pct = Column(Float)
    projected_backlog = Column(Integer)
    projected_sla_breach_prob = Column(Float)
    projected_oei = Column(Float)

class ModelDriftLog(Base):
    __tablename__ = "model_drift_log"
    
    date = Column(String, primary_key=True)
    model_name = Column(String)
    wape = Column(Float)
    baseline_wape = Column(Float)
    drift_score = Column(Float)
    status = Column(String)

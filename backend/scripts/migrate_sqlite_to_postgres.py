import os
import sys
import sqlite3
import pandas as pd
from sqlalchemy import create_engine
from psycopg2.extras import execute_values

# Add project root directory to Python path
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(project_root)

from backend.app.core.config import settings
from backend.app.db.database import Base, engine as pg_engine
# Import models to ensure they are registered with Base
from backend.app.db.models import WorkerRoster, ShiftSchedule, ScanEvent, HourlyVolume, DailyKPI, Alert, SimulationRun, ModelDriftLog

def migrate():
    sqlite_db_path = "backend/app/db/hub_operations.db"
    if not os.path.exists(sqlite_db_path):
        print(f"SQLite file not found at {sqlite_db_path}. Please run generate_synthetic_data.py first.")
        return
        
    print(f"Connecting to Cloud PostgreSQL using URI: {settings.DATABASE_URL.split('@')[-1]}")
    print("Creating tables on PostgreSQL cloud if they do not exist...")
    Base.metadata.create_all(pg_engine)
    
    print("Connecting to local SQLite...")
    sqlite_conn = sqlite3.connect(sqlite_db_path)
    
    tables = [
        "worker_roster",
        "shift_schedule",
        "scan_events",
        "hourly_volume",
        "daily_kpis",
        "alerts",
        "simulation_runs",
        "model_drift_log"
    ]
    
    pg_conn = pg_engine.raw_connection()
    pg_cursor = pg_conn.cursor()
    
    for table in tables:
        print(f"Migrating table '{table}'...")
        df = pd.read_sql(f"SELECT * FROM {table}", sqlite_conn)
        if df.empty:
            print(f"Table '{table}' is empty. Skipping.")
            continue
            
        # Clear existing data in target table
        pg_cursor.execute(f"TRUNCATE TABLE {table} CASCADE")
        
        # Prepare columns and insert query
        columns = list(df.columns)
        col_names = ", ".join(columns)
        insert_query = f"INSERT INTO {table} ({col_names}) VALUES %s"
        
        # Convert df values to tuples, replacing NaN with None
        rows = []
        for x in df.values:
            row_tuple = tuple(None if pd.isna(y) else y for y in x)
            rows.append(row_tuple)
        
        # High speed batch insert
        execute_values(pg_cursor, insert_query, rows, page_size=5000)
        pg_conn.commit()
        print(f"Successfully migrated {len(rows)} rows for '{table}'.")
        
    sqlite_conn.close()
    pg_conn.close()
    print("Cloud database migration completed successfully!")

if __name__ == "__main__":
    migrate()

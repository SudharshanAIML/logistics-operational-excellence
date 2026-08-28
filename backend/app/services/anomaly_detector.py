import numpy as np
import pandas as pd
from sqlalchemy.orm import Session
from sklearn.ensemble import IsolationForest
from backend.app.db.models import HourlyVolume, Alert
from datetime import datetime

def detect_volume_anomalies(db: Session, process: str = "unload") -> list:
    """
    Analyzes the last 14 days of hourly volume data.
    Approximates STL residuals (by removing hour-of-day and day-of-week medians)
    and fits an Isolation Forest model to detect volumetric anomalies.
    """
    # Fetch historical data
    query = db.query(HourlyVolume).filter(HourlyVolume.process == process).order_by(HourlyVolume.timestamp)
    df = pd.read_sql(query.statement, db.bind)
    
    if df.empty or len(df) < 168: # Need at least 1 week of data
        return []
        
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    
    # 1. Feature Engineering
    df['hour'] = df['timestamp'].dt.hour
    df['dayofweek'] = df['timestamp'].dt.dayofweek
    
    # Calculate seasonal medians
    diurnal_medians = df.groupby('hour')['actual_volume'].transform('median')
    weekly_medians = df.groupby('dayofweek')['actual_volume'].transform('median')
    
    # Residuals
    df['residual'] = df['actual_volume'] - (diurnal_medians + weekly_medians) / 2.0
    
    # Prepare features for Isolation Forest
    # We look at: actual volume, residuals, and rolling average
    df['rolling_mean'] = df['actual_volume'].rolling(24, min_periods=1).mean()
    
    features = ['actual_volume', 'residual', 'rolling_mean']
    X = df[features].fillna(0)
    
    # 2. Fit Isolation Forest
    # contamination = 0.02 (expect 2% anomalies)
    clf = IsolationForest(contamination=0.02, random_state=42)
    df['anomaly_score'] = clf.fit_predict(X)
    
    # In scikit-learn Isolation Forest, -1 is an anomaly, 1 is normal
    anomalies = df[df['anomaly_score'] == -1].copy()
    
    anomaly_events = []
    
    # Check if we should insert new alerts in the DB
    cursor = db.connection().connection.cursor()
    
    for _, row in anomalies.tail(10).iterrows():
        ts_str = row['timestamp'].strftime("%Y-%m-%d %H:%M:%S")
        alert_id = f"ANOM-{row['timestamp'].strftime('%y%m%d%H')}-{process}"
        
        # Build message
        vol = int(row['actual_volume'])
        expected = int(row['actual_volume'] - row['residual'])
        dev_pct = round((vol - expected) / max(1, expected) * 100, 1)
        
        severity = "risk" if abs(dev_pct) > 25.0 else "watch"
        direction = "surge" if dev_pct > 0 else "drop"
        
        msg = f"Volume {direction} detected: {vol} items scanned vs expected {expected} ({dev_pct}% deviation)."
        
        # Check if already exists
        cursor.execute("SELECT 1 FROM alerts WHERE alert_id = ?", (alert_id,))
        if not cursor.fetchone():
            cursor.execute("""
            INSERT INTO alerts (alert_id, timestamp, process, zone, severity, alert_type, message, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
            """, (alert_id, ts_str, process, row['zone'], severity, "anomaly", msg))
            db.commit()
            
        anomaly_events.append({
            "timestamp": ts_str,
            "process": process,
            "zone": row['zone'],
            "actual_volume": vol,
            "expected_volume": expected,
            "deviation_pct": dev_pct,
            "severity": severity,
            "message": msg
        })
        
    return anomaly_events

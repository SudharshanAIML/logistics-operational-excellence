import os
import sqlite3
import random
import json
from datetime import datetime, timedelta
import pandas as pd
import numpy as np

# Standards
UPH_STANDARD = {
    "unload": 140, "sort": 320, "stow": 110, "pick": 180, "pack": 150, "load": 200
}
PROCESSES = list(UPH_STANDARD.keys())
ZONES = {
    "unload": "Zone A", "sort": "Zone B", "stow": "Zone C", 
    "pick": "Zone D", "pack": "Zone E", "load": "Zone F"
}

def create_connection(db_path):
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    conn = sqlite3.connect(db_path)
    return conn

def setup_schema(conn):
    cursor = conn.cursor()
    
    # 1. Roster
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS worker_roster (
        worker_id TEXT PRIMARY KEY,
        name TEXT,
        primary_role TEXT,
        max_hours REAL,
        rest_required REAL,
        wage_rate REAL,
        certifications TEXT
    )
    """)
    
    # 2. Shift Schedule
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS shift_schedule (
        schedule_date TEXT,
        shift_name TEXT,
        worker_id TEXT,
        assigned_zone TEXT,
        assigned_process TEXT,
        planned_hours REAL,
        actual_hours_worked REAL,
        productive_hours REAL,
        absent_flag INTEGER,
        PRIMARY KEY (schedule_date, shift_name, worker_id)
    )
    """)
    
    # 3. Scan Events
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS scan_events (
        event_id TEXT PRIMARY KEY,
        timestamp TEXT,
        order_id TEXT,
        item_id TEXT,
        worker_id TEXT,
        zone TEXT,
        process TEXT,
        uph_standard REAL,
        actual_uph REAL,
        status TEXT
    )
    """)
    
    # 4. Hourly Volume and Forecast
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS hourly_volume (
        timestamp TEXT,
        process TEXT,
        zone TEXT,
        actual_volume INTEGER,
        forecast_p10 INTEGER,
        forecast_p50 INTEGER,
        forecast_p90 INTEGER,
        temp REAL,
        rain REAL,
        holiday_flag INTEGER,
        PRIMARY KEY (timestamp, process)
    )
    """)
    
    # 5. Daily KPIs (OEI Rollups)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS daily_kpis (
        date TEXT,
        shift_name TEXT,
        process TEXT,
        zone TEXT,
        throughput_ratio REAL,
        quality_ratio REAL,
        utilization_ratio REAL,
        oei REAL,
        avg_cycle_time_min REAL,
        active_worker_count INTEGER,
        PRIMARY KEY (date, shift_name, process, zone)
    )
    """)
    
    # 6. Alerts
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS alerts (
        alert_id TEXT PRIMARY KEY,
        timestamp TEXT,
        process TEXT,
        zone TEXT,
        severity TEXT,
        alert_type TEXT,
        message TEXT,
        status TEXT
    )
    """)
    
    # 7. Simulation runs
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS simulation_runs (
        run_id TEXT PRIMARY KEY,
        timestamp TEXT,
        scenario_name TEXT,
        inbound_surge_pct REAL,
        absenteeism_pct REAL,
        projected_backlog INTEGER,
        projected_sla_breach_prob REAL,
        projected_oei REAL
    )
    """)
    
    # 8. Model drift log
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS model_drift_log (
        date TEXT PRIMARY KEY,
        model_name TEXT,
        wape REAL,
        baseline_wape REAL,
        drift_score REAL,
        status TEXT
    )
    """)
    
    conn.commit()

def generate_roster(conn):
    first_names = ["James", "John", "Robert", "Michael", "William", "David", "Richard", "Joseph", "Thomas", "Charles",
                   "Mary", "Patricia", "Jennifer", "Linda", "Elizabeth", "Barbara", "Susan", "Jessica", "Sarah", "Karen"]
    last_names = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
                  "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin"]
    
    workers = []
    # Create 120 workers
    for i in range(1, 121):
        worker_id = f"W{i:03d}"
        name = f"{random.choice(first_names)} {random.choice(last_names)}"
        primary_role = random.choices(PROCESSES, weights=[0.2, 0.25, 0.15, 0.15, 0.15, 0.1])[0]
        max_hours = 40.0
        rest_required = 11.0
        wage_rate = round(random.uniform(16.5, 24.0), 2)
        
        # Certifications
        certs = [primary_role]
        other_roles = [r for r in PROCESSES if r != primary_role]
        # Cross train 40% of workers in 1 or 2 other roles
        if random.random() < 0.4:
            certs.extend(random.sample(other_roles, k=random.choice([1, 2])))
            
        workers.append((
            worker_id, name, primary_role, max_hours, rest_required, wage_rate, json.dumps(certs)
        ))
        
    cursor = conn.cursor()
    cursor.executemany("""
    INSERT OR REPLACE INTO worker_roster (worker_id, name, primary_role, max_hours, rest_required, wage_rate, certifications)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    """, workers)
    conn.commit()
    return workers

def load_olist_data(orders_path, items_path):
    print("Loading Olist data...")
    if not os.path.exists(orders_path) or not os.path.exists(items_path):
        print("Olist files not found, generating mock time series...")
        return None, None
        
    orders = pd.read_csv(orders_path)
    items = pd.read_csv(items_path)
    
    # Clean dates
    date_cols = ['order_purchase_timestamp', 'order_approved_at', 
                 'order_delivered_carrier_date', 'order_delivered_customer_date']
    for col in date_cols:
        orders[col] = pd.to_datetime(orders[col])
        
    return orders, items

def generate_hub_data(conn, orders, items):
    cursor = conn.cursor()
    
    # We will simulate data for a 6 month period: Sept 1, 2017 to Feb 28, 2018
    # This covers Black Friday (Nov 24, 2017) and the holiday peak.
    start_date = datetime(2017, 9, 1)
    end_date = datetime(2018, 3, 1)
    
    # Roster mapping
    cursor.execute("SELECT worker_id, primary_role, certifications, wage_rate FROM worker_roster")
    roster_rows = cursor.fetchall()
    roster = []
    for r in roster_rows:
        roster.append({
            "id": r[0],
            "role": r[1],
            "certs": json.loads(r[2]),
            "wage": r[3]
        })
        
    print("Generating volume timeline...")
    # Generate continuous hours list
    hours = []
    curr = start_date
    while curr < end_date + timedelta(days=1):
        hours.append(curr)
        curr += timedelta(hours=1)
        
    # Weather patterns
    # São Paulo average temperatures: Sept (19C) -> Jan (23C)
    # Precipitation: rain is common in summer (Nov-Feb)
    weather_data = {}
    for h in hours:
        month = h.month
        base_temp = 19.0 + (5.0 * np.sin((month - 9) / 12.0 * 2 * np.pi))
        temp = base_temp + random.uniform(-4, 4)
        
        # Rain chance
        rain_prob = 0.15 if month in [9, 10] else 0.35 # wet summer
        rain = 0.0
        if random.random() < rain_prob:
            rain = round(random.expovariate(1.0 / 5.0), 1)
            if rain > 25.0:
                rain = 25.0 # cap it
                
        weather_data[h] = {"temp": round(temp, 1), "rain": rain}
        
    # Scale volume from Olist or synthesize
    hourly_volume_records = []
    
    if orders is not None and items is not None:
        # Map Olist orders to our simulation period
        # Align purchase dates to our timeframe
        # Filter Olist orders to the range of 2017-09-01 to 2018-03-01
        olist_sub = orders[(orders['order_purchase_timestamp'] >= start_date) & 
                           (orders['order_purchase_timestamp'] < end_date)].copy()
        
        # Merge items to count total packages
        items_sub = items[items['order_id'].isin(olist_sub['order_id'])]
        item_counts = items_sub.groupby('order_id').size().reset_index(name='qty')
        olist_sub = olist_sub.merge(item_counts, on='order_id', how='left').fillna({'qty': 1})
        
        # Round purchase timestamp to hour
        olist_sub['hour_dt'] = olist_sub['order_purchase_timestamp'].dt.floor('h')
        
        # Pivot volume by hour
        vol_by_hour = olist_sub.groupby('hour_dt')['qty'].sum().to_dict()
    else:
        vol_by_hour = {}
        
    # Generate hourly entries
    hourly_volumes = {} # timestamp -> process -> volume
    
    for h in hours:
        timestamp_str = h.strftime("%Y-%m-%d %H:00:00")
        day_of_week = h.weekday() # 0 = Monday, 6 = Sunday
        hour_of_day = h.hour
        
        # Holiday check (Brazilian or US baseline)
        is_holiday = 0
        # Nov 24: Black Friday (approx peak)
        is_black_friday = (h.month == 11 and h.day == 24)
        is_christmas_rush = (h.month == 12 and h.day >= 10 and h.day <= 24)
        
        if (h.month == 9 and h.day == 7) or (h.month == 10 and h.day == 12) or \
           (h.month == 11 and h.day == 2) or (h.month == 11 and h.day == 15) or \
           (h.month == 12 and h.day == 25) or (h.month == 1 and h.day == 1):
            is_holiday = 1
            
        # Base volume mapping
        base_vol = vol_by_hour.get(h, 0)
        # If we are using mock or base_vol is too small, synthesize a realistic profile
        if base_vol == 0:
            # Hourly diurnal cycle
            # Peak at 10-12am, and 8-10pm
            hour_factor = 0.3 + 0.7 * np.exp(-((hour_of_day - 11)/4)**2) + 0.5 * np.exp(-((hour_of_day - 21)/3)**2)
            # Weekly seasonality (higher mid-week, lower Sunday)
            week_factor = [1.2, 1.3, 1.2, 1.1, 1.0, 0.7, 0.5][day_of_week]
            # Base scale: 120 units/hour standard
            base_vol = int(120 * hour_factor * week_factor * random.uniform(0.8, 1.2))
            
        # Scale for peak seasons
        if is_black_friday:
            base_vol *= 4.5
        elif is_christmas_rush:
            base_vol *= 2.2
        elif is_holiday:
            base_vol *= 0.3 # dips on holidays
            
        # Now map to processes with lag
        # Inbound unload -> sort -> stow -> pick -> pack -> load
        # Unload receives the raw package volume
        # Sort processes it 1 hour later
        # Stow is 1-2 hours later
        # Pick is 2 hours later
        # Pack is 3 hours later
        # Load is 3-4 hours later
        hourly_volumes[h] = {
            "unload": int(base_vol),
            "sort": int(base_vol * 0.95),  # slight losses
            "stow": int(base_vol * 0.94),
            "pick": int(base_vol * 0.93),
            "pack": int(base_vol * 0.92),
            "load": int(base_vol * 0.92)
        }
        
    print("Writing hourly volume & generating rosters/scans...")
    # We will generate daily schedules and detailed scans in batches to save memory
    scan_batch = []
    schedule_batch = []
    daily_kpis_batch = []
    
    # Process day-by-day
    current_day = start_date
    while current_day < end_date:
        date_str = current_day.strftime("%Y-%m-%d")
        
        # 3 shifts per day: Day (06:00-14:00), Twilight (14:00-22:00), Night (22:00-06:00)
        shifts = [
            ("Day", 6, 14),
            ("Twilight", 14, 22),
            ("Night", 22, 6)
        ]
        
        # Determine schedule for today
        # For each shift, assign workers
        for shift_name, start_hr, end_hr in shifts:
            # Collect hourly volumes for this shift
            shift_hours = []
            if start_hr < end_hr:
                for hr in range(start_hr, end_hr):
                    shift_hours.append(current_day + timedelta(hours=hr))
            else:
                # Crosses midnight
                for hr in range(start_hr, 24):
                    shift_hours.append(current_day + timedelta(hours=hr))
                for hr in range(0, end_hr):
                    shift_hours.append(current_day + timedelta(days=1, hours=hr))
                    
            # Calculate total volume per process in this shift
            shift_vol = {p: sum(hourly_volumes[sh][p] for sh in shift_hours) for p in PROCESSES}
            
            # Required hours per process based on volume / standard UPH
            req_hours = {p: shift_vol[p] / UPH_STANDARD[p] for p in PROCESSES}
            req_hc = {p: max(2, int(np.ceil(req_hours[p] / 8.0))) for p in PROCESSES}
            
            # Assign workers from roster
            # 6% absenteeism rate
            # Filter roster for availability (a simple rotating rule: worker_id mod 7 != day of week mod 7)
            day_idx = current_day.weekday()
            available_workers = [w for w in roster if (int(w["id"][1:]) % 7) != (day_idx % 7)]
            
            assigned_workers = set()
            
            for p in PROCESSES:
                role_workers = [w for w in available_workers if w["id"] not in assigned_workers and p in w["certs"]]
                # Need req_hc[p] workers
                needed = req_hc[p]
                
                # If short, take any worker cross-certified
                if len(role_workers) < needed:
                    role_workers = [w for w in available_workers if w["id"] not in assigned_workers and p in w["certs"]]
                    
                # Take what we can
                assigned_to_process = random.sample(role_workers, k=min(len(role_workers), needed))
                
                for w in assigned_to_process:
                    assigned_workers.add(w["id"])
                    
                    # Absent flag (6% chance)
                    is_absent = 1 if random.random() < 0.06 else 0
                    
                    # Calculate actual hours worked & productive hours
                    planned_hrs = 8.0
                    actual_worked = 0.0 if is_absent else 8.0
                    
                    # Productive hours: actual hours spent scanning (excluding idle/wait)
                    # Idle time depends on volumes. If volumes are low, idle increases
                    vol_factor = min(1.0, req_hours[p] / (len(assigned_to_process) * 8.0 + 1e-5))
                    productive_hrs = 0.0 if is_absent else (actual_worked * vol_factor * random.uniform(0.85, 0.98))
                    
                    schedule_batch.append((
                        date_str, shift_name, w["id"], ZONES[p], p, planned_hrs, actual_worked, round(productive_hrs, 2), is_absent
                    ))
                    
                    # If not absent, generate scan events for this worker during the shift
                    if not is_absent:
                        # Number of items this worker scans
                        # Average UPH based on volume factor
                        weather_effect = 1.0
                        # Rain reduces unload productivity by 15%, other processes by 5%
                        total_rain = sum(weather_data[sh]["rain"] for sh in shift_hours)
                        if total_rain > 5.0:
                            weather_effect = 0.85 if p == "unload" else 0.95
                            
                        # Actual worker UPH
                        base_uph = UPH_STANDARD[p] * random.uniform(0.9, 1.15) * weather_effect
                        units_scanned = int(base_uph * productive_hrs)
                        
                        # Generate scan events
                        for item_idx in range(units_scanned):
                            # Distribute scans randomly over the shift hours
                            scan_hr = random.choice(shift_hours)
                            scan_time = scan_hr + timedelta(minutes=random.uniform(0, 59), seconds=random.uniform(0, 59))
                            
                            # Random status (Quality metrics: rework, misroutes, damage)
                            status_choices = ["completed", "rework", "misrouted", "damaged"]
                            status = random.choices(status_choices, weights=[0.982, 0.010, 0.005, 0.003])[0]
                            
                            event_id = f"EV-{scan_time.strftime('%y%m%d%H%M')}-{w['id']}-{item_idx:03d}"
                            
                            scan_batch.append((
                                event_id, scan_time.strftime("%Y-%m-%d %H:%M:%S"),
                                f"ORD-{random.randint(100000, 999999)}", f"ITEM-{random.randint(1, 4)}",
                                w["id"], ZONES[p], p, UPH_STANDARD[p], round(base_uph, 1), status
                            ))
                            
            # Enforce Aggregation Floor (N=5) when rolling up Daily KPIs
            # Let's count active workers (excluding absent) assigned to this process-zone in this shift
            # If active_worker_count < 5, we still record the raw KPIs but we flag/record the count so backend can redact.
            for p in PROCESSES:
                z = ZONES[p]
                # Filter schedule_batch for current date, shift, process
                active_workers = [s for s in schedule_batch if s[0] == date_str and s[1] == shift_name and s[4] == p and s[8] == 0]
                active_count = len(active_workers)
                
                # Calculations for KPIs
                # Throughput Ratio = actual units-per-labor-hour / standard UPH
                # actual units scanned:
                shift_scans = [sb for sb in scan_batch if sb[1][:10] == date_str and sb[6] == p] # rough approximation for speed
                # More precise: scans within the shift window
                actual_scans_count = len(shift_scans) // 3 # split across 3 shifts
                
                # Fallback if no scans
                if active_count > 0:
                    total_productive_hrs = sum(w[7] for w in active_workers)
                    total_actual_hrs = sum(w[6] for w in active_workers)
                    
                    actual_uph = (actual_scans_count) / (total_actual_hrs + 1e-5)
                    # Clamp actual_uph to be realistic
                    actual_uph = max(UPH_STANDARD[p] * 0.7, min(UPH_STANDARD[p] * 1.3, actual_uph))
                    
                    throughput_ratio = round(actual_uph / UPH_STANDARD[p], 3)
                    
                    # Quality Ratio = 1 - (rework + misroutes + damage) / total
                    errors = int(actual_scans_count * random.uniform(0.01, 0.03))
                    quality_ratio = round(1.0 - (errors / max(1, actual_scans_count)), 3)
                    
                    # Utilization Ratio = productive hours / paid hours
                    utilization_ratio = round(total_productive_hrs / (total_actual_hrs + 1e-5), 3)
                    
                    # OEI
                    oei = round(throughput_ratio * quality_ratio * utilization_ratio, 3)
                    avg_cycle_time = round(random.uniform(22.0, 58.0), 1)
                else:
                    throughput_ratio = 0.0
                    quality_ratio = 1.0
                    utilization_ratio = 0.0
                    oei = 0.0
                    avg_cycle_time = 0.0
                    
                daily_kpis_batch.append((
                    date_str, shift_name, p, z, throughput_ratio, quality_ratio, utilization_ratio, oei, avg_cycle_time, active_count
                ))
                
        # Write batches in chunks to avoid memory overhead
        if len(scan_batch) > 30000:
            cursor.executemany("""
            INSERT OR REPLACE INTO scan_events (event_id, timestamp, order_id, item_id, worker_id, zone, process, uph_standard, actual_uph, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, scan_batch)
            scan_batch = []
            
        current_day += timedelta(days=1)
        
    # Write remaining scans and schedules
    if scan_batch:
        cursor.executemany("""
        INSERT OR REPLACE INTO scan_events (event_id, timestamp, order_id, item_id, worker_id, zone, process, uph_standard, actual_uph, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, scan_batch)
        
    cursor.executemany("""
    INSERT OR REPLACE INTO shift_schedule (schedule_date, shift_name, worker_id, assigned_zone, assigned_process, planned_hours, actual_hours_worked, productive_hours, absent_flag)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, schedule_batch)
    
    cursor.executemany("""
    INSERT OR REPLACE INTO daily_kpis (date, shift_name, process, zone, throughput_ratio, quality_ratio, utilization_ratio, oei, avg_cycle_time_min, active_worker_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, daily_kpis_batch)
    
    # Save hourly volumes
    hourly_volume_inserts = []
    print("Writing hourly volumes...")
    for h, vdict in hourly_volumes.items():
        timestamp_str = h.strftime("%Y-%m-%d %H:00:00")
        w = weather_data[h]
        day_of_week = h.weekday()
        # Holiday check
        is_holiday = 0
        if (h.month == 9 and h.day == 7) or (h.month == 10 and h.day == 12) or \
           (h.month == 11 and h.day == 2) or (h.month == 11 and h.day == 15) or \
           (h.month == 12 and h.day == 25) or (h.month == 1 and h.day == 1):
            is_holiday = 1
            
        for p in PROCESSES:
            vol = vdict[p]
            
            # Forecast quantiles (P10, P50, P90)
            # Make P50 follow the actual volume with a small error
            # Make P10 and P90 represent confidence bands
            forecast_p50 = int(vol * random.uniform(0.92, 1.08))
            forecast_p10 = int(forecast_p50 * 0.8)
            forecast_p90 = int(forecast_p50 * 1.25)
            
            hourly_volume_inserts.append((
                timestamp_str, p, ZONES[p], vol, forecast_p10, forecast_p50, forecast_p90, w["temp"], w["rain"], is_holiday
            ))
            
    cursor.executemany("""
    INSERT OR REPLACE INTO hourly_volume (timestamp, process, zone, actual_volume, forecast_p10, forecast_p50, forecast_p90, temp, rain, holiday_flag)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, hourly_volume_inserts)
    
    conn.commit()
    print("Database generation completed successfully!")

def generate_alerts(conn):
    # Inject some alerts into the database
    alerts = [
        ("A001", "2026-08-28 06:15:00", "unload", "Zone A", "risk", "shortstaffing", "Inbound unload is 3 workers short for Day shift. SLA breach risk.", "active"),
        ("A002", "2026-08-28 07:05:00", "sort", "Zone B", "watch", "throughput", "Sort productivity drops below standard. Rain affecting outdoor unloads.", "active"),
        ("A003", "2026-08-28 08:30:00", "pick", "Zone D", "risk", "congestion", "Pick zone backlog exceeds 800 items. Processing delay is increasing.", "active"),
        ("A004", "2026-08-27 10:00:00", "pack", "Zone E", "watch", "rework", "Pack quality ratio dropped to 92.4% (high rework detected).", "resolved")
    ]
    cursor = conn.cursor()
    cursor.executemany("""
    INSERT OR REPLACE INTO alerts (alert_id, timestamp, process, zone, severity, alert_type, message, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, alerts)
    conn.commit()

def generate_simulation_runs(conn):
    sims = [
        ("S001", "2026-08-28 10:00:00", "Peak Season Surge", 30.0, 6.0, 1420, 0.88, 0.72),
        ("S002", "2026-08-28 10:05:00", "Flu Week Shortage", 0.0, 15.0, 950, 0.45, 0.78),
        ("S003", "2026-08-28 10:10:00", "Normal Operations", 0.0, 6.0, 110, 0.02, 0.87),
        ("S004", "2026-08-28 10:15:00", "Black Friday Prep", 100.0, 6.0, 4500, 0.99, 0.54)
    ]
    cursor = conn.cursor()
    cursor.executemany("""
    INSERT OR REPLACE INTO simulation_runs (run_id, timestamp, scenario_name, inbound_surge_pct, absenteeism_pct, projected_backlog, projected_sla_breach_prob, projected_oei)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, sims)
    conn.commit()

def generate_model_drift(conn):
    drifts = [
        ("2026-08-22", "LightGBM Volume Forecast", 0.084, 0.079, 0.005, "normal"),
        ("2026-08-23", "LightGBM Volume Forecast", 0.085, 0.079, 0.006, "normal"),
        ("2026-08-24", "LightGBM Volume Forecast", 0.088, 0.079, 0.009, "normal"),
        ("2026-08-25", "LightGBM Volume Forecast", 0.104, 0.079, 0.025, "drift_detected"),
        ("2026-08-26", "LightGBM Volume Forecast", 0.112, 0.079, 0.033, "drift_detected"),
        ("2026-08-27", "LightGBM Volume Forecast", 0.119, 0.079, 0.040, "drift_detected")
    ]
    cursor = conn.cursor()
    cursor.executemany("""
    INSERT OR REPLACE INTO model_drift_log (date, model_name, wape, baseline_wape, drift_score, status)
    VALUES (?, ?, ?, ?, ?, ?)
    """, drifts)
    conn.commit()

if __name__ == "__main__":
    db_path = "backend/app/db/hub_operations.db"
    orders_path = "data/olist/olist_orders_dataset.csv"
    items_path = "data/olist/olist_order_items_dataset.csv"
    
    print("Starting database generation...")
    conn = create_connection(db_path)
    setup_schema(conn)
    generate_roster(conn)
    orders, items = load_olist_data(orders_path, items_path)
    generate_hub_data(conn, orders, items)
    generate_alerts(conn)
    generate_simulation_runs(conn)
    generate_model_drift(conn)
    conn.close()
    print("Database ready!")

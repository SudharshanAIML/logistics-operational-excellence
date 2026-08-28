import re
import json
import requests
from sqlalchemy import func
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from backend.app.core.config import settings
from backend.app.db.models import DailyKPI, Alert, HourlyVolume

WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

def _latest_date(db: Session) -> datetime:
    latest_str = db.query(func.max(DailyKPI.date)).scalar()
    return datetime.strptime(latest_str, "%Y-%m-%d") if latest_str else datetime.now()

def _resolve_target_date(db: Session, query_lower: str) -> datetime:
    """
    Resolves relative date phrases against the real latest date in the data,
    instead of hardcoded calendar literals that only matched one specific dataset snapshot.
    """
    latest = _latest_date(db)

    if "today" in query_lower:
        return latest
    if "yesterday" in query_lower:
        return latest - timedelta(days=1)

    for i, day_name in enumerate(WEEKDAYS):
        if day_name in query_lower:
            # Most recent occurrence of that weekday on or before "latest"
            days_back = (latest.weekday() - i) % 7
            return latest - timedelta(days=days_back)

    # Default: most recent occurrence of the same weekday as "latest" one week back
    return latest - timedelta(days=7)

def ask_ops_copilot(db: Session, query: str) -> dict:
    """
    Ops Copilot Agentic Layer.
    Parses queries, extracts key dates/processes, queries the operational database,
    and returns a narrative explanation of anomalies, weather effects, and metrics.
    """
    query_lower = query.lower()

    # 1. Date/Process Parsing (Simple entity extraction), resolved against real data
    target_date = _resolve_target_date(db, query_lower)
    target_date_str = target_date.strftime("%Y-%m-%d")

    # Process extraction
    process_target = None
    for p in ["unload", "sort", "stow", "pick", "pack", "load"]:
        if p in query_lower:
            process_target = p
            break
            
    # 2. Database Retrieval
    # Query KPIs
    kpi_query = db.query(DailyKPI).filter(DailyKPI.date == target_date_str)
    if process_target:
        kpi_query = kpi_query.filter(DailyKPI.process == process_target)
    kpis = kpi_query.all()
    
    # Query weather for that day
    vol_query = db.query(HourlyVolume).filter(HourlyVolume.timestamp.like(f"{target_date_str}%"))
    if process_target:
        vol_query = vol_query.filter(HourlyVolume.process == process_target)
    vols = vol_query.all()
    
    avg_temp = round(sum(v.temp for v in vols) / len(vols), 1) if vols else 22.0
    total_rain = round(sum(v.rain for v in vols) / 6.0, 1) if vols else 0.0 # roughly daily accumulated
    
    # Query Alerts for that day
    alert_query = db.query(Alert).filter(Alert.timestamp.like(f"{target_date_str}%"))
    alerts = alert_query.all()
    
    # 3. Assemble contextual data
    context = {
        "date": target_date_str,
        "queried_process": process_target or "all processes",
        "average_temperature_c": round(avg_temp, 1),
        "total_precipitation_mm": round(total_rain, 1),
        "kpi_metrics": [
            {
                "process": k.process,
                "zone": k.zone,
                "shift": k.shift_name,
                "oei": k.oei,
                "throughput_ratio": k.throughput_ratio,
                "quality_ratio": k.quality_ratio,
                "utilization_ratio": k.utilization_ratio,
                "avg_cycle_time_min": k.avg_cycle_time_min,
                "active_workers": k.active_worker_count
            } for k in kpis
        ],
        "alerts_logged": [
            {
                "process": a.process,
                "severity": a.severity,
                "message": a.message
            } for a in alerts
        ]
    }
    
    # 4. Generate response narrative
    # If Gemini API Key is configured, make a call to Gemini
    response_text = ""
    if settings.GEMINI_API_KEY:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={settings.GEMINI_API_KEY}"
            headers = {"Content-Type": "application/json"}
            prompt = f"""
            You are Antigravity, a logistics ops analyst copilot for UPS Synapse.
            Answer the user's operational question based on the following warehouse data context.
            User Question: {query}
            
            Warehouse Data Context:
            {json.dumps(context, indent=2)}
            
            Keep your answer professional, quantitative, action-oriented, and focused on operational factors (e.g. weather impacts on unloads, understaffing gaps, quality errors). Suggest practical rebalancing solutions.
            """
            payload = {
                "contents": [{"parts": [{"text": prompt}]}]
            }
            res = requests.post(url, headers=headers, json=payload, timeout=5.0)
            if res.status_code == 200:
                response_text = res.json()["candidates"][0]["content"]["parts"][0]["text"]
        except Exception as e:
            response_text = f"LLM error: {str(e)}. Falling back to deterministic operations narrative."
            
    if not response_text:
        # Structured operations report fallback
        day_name = target_date.strftime("%A")
        
        # Analyze variables
        spikes = [a for a in alerts if a.severity == "risk"]
        rain_warning = "precipitation detected (outdoor unload capacity compromised by 15%)" if total_rain > 5.0 else "no major weather interruptions"
        
        # Core OEI summaries
        oei_values = [k.oei for k in kpis if k.oei > 0]
        avg_oei = sum(oei_values) / len(oei_values) if oei_values else 0.85
        
        low_oei_processes = [k.process for k in kpis if k.oei < 0.80 and k.oei > 0]
        
        response_text = f"### Operational Narrative for {day_name}, {target_date_str}\n\n"
        response_text += f"On **{day_name}**, the overall Hub Ops Efficiency Index (OEI) aggregated to **{avg_oei:.2f}** (with standard target of 0.87).\n\n"
        
        response_text += f"**Key Findings:**\n"
        if low_oei_processes:
            response_text += f"- **Efficiency Bottleneck:** Lower OEI scores were observed in `{', '.join(set(low_oei_processes))}` processes.\n"
        else:
            response_text += f"- **Stability:** All core processes maintained acceptable OEI ranges ($\ge 0.80$).\n"
            
        if total_rain > 5.0:
            response_text += f"- **Weather Constraints:** Precipitation measured `{total_rain}mm`. This directly impacted Unload Dock UPH due to safety restrictions on wet trailer ramps.\n"
        else:
            response_text += f"- **Weather Condition:** Weather was clear (`{avg_temp}°C`, `{total_rain}mm` rain), posing no operational constraints.\n"
            
        if spikes:
            response_text += f"- **Alerts Logged:** {len(spikes)} high-severity alerts were triggered, including: *\"{spikes[0].message}\"*\n"
        else:
            response_text += f"- **No Critical Alerts:** Roster assignments and throughput rates remained stable without triggering critical alarms.\n"
            
        response_text += "\n**Recommended Action Plan:**\n"
        response_text += "1. **Cross-Train Rebalancing**: Move certified pick/pack workers to Unload during rainfall events to maintain throughput standard.\n"
        response_text += "2. **Staffing Buffer**: Adjust the twilight shift schedule with an extra 6% absenteeism buffer on forecasted high-volume days."
        
    return {
        "query": query,
        "date": target_date_str,
        "context": context,
        "response": response_text
    }

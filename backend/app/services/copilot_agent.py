import re
import json
import logging
import requests
from sqlalchemy import func
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from backend.app.core.config import settings
from backend.app.db.models import DailyKPI, Alert, HourlyVolume
from backend.app.services import oei_calculator

logger = logging.getLogger(__name__)

WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

def _true_latest_date(db: Session) -> datetime:
    """
    The real latest day in the dataset, per hourly_volume - which is generated
    per-hour with no shift-boundary logic, so it always extends further than
    daily_kpis (whose per-shift rollup can lag a day behind). "Today" should
    mean this date, matching what the rest of the app (Command Center, etc.)
    treats as today - not silently whatever daily_kpis happens to have finished.
    """
    latest_str = db.query(func.max(HourlyVolume.timestamp)).scalar()
    return datetime.strptime(latest_str[:10], "%Y-%m-%d") if latest_str else datetime.now()

def _resolve_target_date(db: Session, query_lower: str) -> datetime:
    """
    Resolves relative date phrases against the real latest date in the data,
    instead of hardcoded calendar literals that only matched one specific dataset snapshot.
    """
    latest = _true_latest_date(db)

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

def _get_recent_trend(db: Session, target_date_str: str, process_target: str = None) -> list:
    """
    Real OEI trend for the 7 days leading up to the queried date, so the LLM has
    comparative context ("today vs the recent trend") instead of a single isolated
    day - this is what makes "why did X spike" answerable rather than a guess.
    """
    end = datetime.strptime(target_date_str, "%Y-%m-%d")
    start = (end - timedelta(days=6)).strftime("%Y-%m-%d")

    query_ = db.query(
        DailyKPI.date,
        func.avg(DailyKPI.oei).label("oei"),
        func.avg(DailyKPI.avg_cycle_time_min).label("avg_cycle_time_min"),
    ).filter(DailyKPI.date >= start, DailyKPI.date <= target_date_str)
    if process_target:
        query_ = query_.filter(DailyKPI.process == process_target)

    rows = query_.group_by(DailyKPI.date).order_by(DailyKPI.date).all()
    return [
        {"date": r.date, "oei": round(r.oei, 3) if r.oei else None,
         "avg_cycle_time_min": round(r.avg_cycle_time_min, 1) if r.avg_cycle_time_min else None}
        for r in rows
    ]

def _call_gemini(query: str, context: dict) -> str:
    """
    Calls the Gemini API for a narrative answer. Returns "" on any failure
    (network error, timeout, safety block, malformed response) so the caller
    falls back to the deterministic narrative - errors are logged, never
    surfaced to the user as if they were the answer.
    """
    if not settings.GEMINI_API_KEY:
        return ""

    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{settings.GEMINI_MODEL}:generateContent?key={settings.GEMINI_API_KEY}"
    )
    prompt = f"""You are the Synapse Ops Copilot: a senior logistics operations analyst embedded in a UPS
ground hub's command center, briefing a hub manager or shift supervisor. Your tone is that of an experienced
analyst, not a chatbot - confident, precise, and entirely grounded in the data. Never say "as an AI" or
hedge about your own nature; never invent a number that isn't in the context below; if the context is
insufficient to answer with confidence, state plainly what's missing rather than speculate.

User question: {query}

Warehouse data context (weather, active alerts, KPI rollup, and the last 7 days' OEI/cycle-time trend):
{json.dumps(context, indent=2)}

Respond in well-formed Markdown, structured like a briefing:
- Lead with the single most important takeaway in one sentence.
- Follow with 2-4 supporting bullet points, each citing a specific number, process, or zone from the context.
- If the 7-day trend shows a meaningful change, name it explicitly (direction and magnitude).
- Close with one bolded, concrete recommendation a shift supervisor could execute this shift.
If "kpi_data_note" is present, state it plainly near the top (e.g. "today's KPI rollup isn't finalized yet;
figures below are from <date>") - never silently relabel data from kpi_rollup_date as if it were "date".
Keep the whole answer tight - no filler, no restating the question, no generic advice unmoored from the
data provided."""

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        # thinkingBudget: 0 disables extended "thinking" - without it, this model
        # spends most of maxOutputTokens on internal reasoning tokens before ever
        # writing the visible answer, so the response comes back truncated
        # mid-sentence (finishReason=MAX_TOKENS) for a task this simple.
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 800, "thinkingConfig": {"thinkingBudget": 0}},
    }

    try:
        res = requests.post(url, headers={"Content-Type": "application/json"}, json=payload, timeout=20.0)
    except requests.RequestException as e:
        logger.warning("Gemini request failed: %s", e)
        return ""

    if res.status_code != 200:
        logger.warning("Gemini returned HTTP %s: %s", res.status_code, res.text[:300])
        return ""

    try:
        data = res.json()
        block_reason = data.get("promptFeedback", {}).get("blockReason")
        if block_reason:
            logger.warning("Gemini blocked the prompt: %s", block_reason)
            return ""
        candidates = data.get("candidates", [])
        if not candidates or "content" not in candidates[0]:
            logger.warning("Gemini returned no usable candidate (finishReason=%s)",
                            candidates[0].get("finishReason") if candidates else "none")
            return ""

        finish_reason = candidates[0].get("finishReason")
        parts = candidates[0]["content"].get("parts", [])
        text = "".join(p.get("text", "") for p in parts if "text" in p).strip()

        # A response cut off by the token limit reads as garbled, truncated
        # mid-sentence text - worse than the deterministic fallback, so treat
        # it as a failure rather than return a broken answer to the user.
        if finish_reason == "MAX_TOKENS" or not text:
            logger.warning("Gemini response incomplete (finishReason=%s, len=%d)", finish_reason, len(text))
            return ""

        return text
    except (KeyError, IndexError, ValueError) as e:
        logger.warning("Gemini response parsing failed: %s", e)
        return ""

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
    # Query KPIs - daily_kpis' shift-based rollup can lag a real day behind
    # hourly_volume (it only has a completed row once a full day's shifts have
    # run), so fall back to the nearest day that actually has a rollup rather
    # than silently returning zero rows for "today" with no explanation.
    kpi_date_str = oei_calculator.get_nearest_available_date(db, target_date_str)
    kpi_query = db.query(DailyKPI).filter(DailyKPI.date == kpi_date_str)
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
        "kpi_rollup_date": kpi_date_str,
        "kpi_data_note": (
            None if kpi_date_str == target_date_str else
            f"No finalized daily KPI rollup exists yet for {target_date_str}. "
            f"The kpi_metrics below are from the most recent completed rollup, {kpi_date_str}."
        ),
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
        ],
        "last_7_days_trend": _get_recent_trend(db, kpi_date_str, process_target)
    }

    # 4. Generate response narrative - real Gemini call if configured, with a
    # deterministic fallback that always runs on any failure (previously an
    # exception would overwrite response_text with the raw error message and
    # skip the fallback entirely, despite the comment claiming otherwise)
    response_text = _call_gemini(query, context)
    source = "gemini" if response_text else "deterministic"

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
        if context["kpi_data_note"]:
            response_text += f"_{context['kpi_data_note']}_\n\n"
            kpi_day_name = datetime.strptime(kpi_date_str, "%Y-%m-%d").strftime("%A")
            kpi_day_label = f"{kpi_day_name} ({kpi_date_str})"
        else:
            kpi_day_label = day_name
        response_text += f"On **{kpi_day_label}**, the overall Hub Ops Efficiency Index (OEI) aggregated to **{avg_oei:.2f}** (with standard target of 0.87).\n\n"

        response_text += f"**Key Findings:**\n"
        if low_oei_processes:
            response_text += f"- **Efficiency Bottleneck:** Lower OEI scores were observed in `{', '.join(set(low_oei_processes))}` processes.\n"
        else:
            response_text += f"- **Stability:** All core processes maintained acceptable OEI ranges (≥ 0.80).\n"
            
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
        "response": response_text,
        "source": source
    }

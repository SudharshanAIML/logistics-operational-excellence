from typing import Any, Dict, List, Union
from backend.app.core.config import settings

def enforce_aggregation_floor(
    data: Union[Dict[str, Any], List[Dict[str, Any]]], 
    worker_count_key: str = "active_worker_count", 
    redact_keys: List[str] = None
) -> Union[Dict[str, Any], List[Dict[str, Any]]]:
    """
    Enforces the privacy aggregation floor. If the worker count (active_worker_count)
    is below the aggregation floor N (default 5), all performance and productivity
    metrics are redacted (masked or set to None/null) and a privacy notice is added.
    """
    if redact_keys is None:
        redact_keys = ["oei", "throughput_ratio", "quality_ratio", "utilization_ratio", "avg_cycle_time_min", "actual_uph"]
        
    floor = settings.AGGREGATION_FLOOR
    
    def redact_item(item: Dict[str, Any]) -> Dict[str, Any]:
        count = item.get(worker_count_key, 0)
        if count is not None and count < floor:
            redacted = item.copy()
            for key in redact_keys:
                if key in redacted:
                    redacted[key] = None
            redacted["privacy_redacted"] = True
            redacted["privacy_message"] = (
                f"Data redacted: Active workers ({count}) below aggregation floor threshold ({floor})"
            )
            return redacted
        return item

    if isinstance(data, list):
        return [redact_item(item) for item in data]
    elif isinstance(data, dict):
        return redact_item(data)
    
    return data

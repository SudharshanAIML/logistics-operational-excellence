
## staffing requirement
forecast_volume = SUM(hourly_volume.forecast_p50) for that process, that date
required_hours  = forecast_volume / standard_UPH
required_headcount = max(2, ceil(required_hours / 8))
available_headcount = real active_worker_count from daily_kpis (privacy-floor-safe rollup)
gap = available_headcount - required_headcount


these are get from the forecast_ps50 and like from forecast.


# Roster (OR-TOOLS CP-SAT)
Staffing requirement → actual roster (OR-Tools CP-SAT)
This is the part that's genuinely Operations Research, not ML — roster_optimizer.py, using Google OR-Tools' CP-SAT constraint solver:

Decision variables: for every (worker, shift, process) triple, a boolean "is this worker assigned here"
Hard constraints: a worker can only be assigned if certified for that process; at most one shift+process per worker per day; anyone who worked Twilight/Night yesterday cannot work Day today (11-hour rest rule, checked against real shift_schedule history)
Objective: minimize 1000×shortfall + 100×overstaffing + wage_cost, i.e. hitting headcount targets matters ~10x more than avoiding overstaffing, which matters more than minimizing payroll
This is the piece that was completely broken before my fixes — it referenced a nonexistent cp_model.datetime attribute and crashed every single time, silently swallowed by the frontend's fallback logic. It now genuinely solves and returns real assignments (87 real worker-shift-process assignments in my test run), which feed the Gantt chart in Workforce Planner.

# venv
cd /home/susan/Development/logistics-operational-excellence
source .venv/bin/activate

cd /home/susan/Development/logistics-operational-excellence
PYTHONPATH=. uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload

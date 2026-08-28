import json
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from ortools.sat.python import cp_model
from backend.app.db.models import WorkerRoster, ShiftSchedule

def optimize_shift_roster(db: Session, date_str: str, required_headcounts: Dict[str, Dict[str, int]]) -> Dict[str, Any]:
    """
    Optimizes shift assignments for a specific date using OR-Tools CP-SAT.
    
    Arguments:
    - db: SQLAlchemy Session
    - date_str: Date for scheduling (YYYY-MM-DD)
    - required_headcounts: Dict mapping shift_name -> process_name -> required_headcount
      e.g. {"Day": {"unload": 5, "sort": 6, ...}, "Twilight": {...}, "Night": {...}}
    """
    # Fetch roster and active workers
    workers_db = db.query(WorkerRoster).all()
    
    # Simple availability: workers can be absent or off. Let's filter out workers with scheduled leave (mocked)
    workers = []
    for w in workers_db:
        certs = json.loads(w.certifications)
        # 6% absenteeism is already handled in schedule actuals, here we roster available staff
        # We model available workers
        workers.append({
            "id": w.worker_id,
            "name": w.name,
            "primary_role": w.primary_role,
            "certs": certs,
            "wage": w.wage_rate
        })
        
    shifts = ["Day", "Twilight", "Night"]
    processes = ["unload", "sort", "stow", "pick", "pack", "load"]
    zones = {
        "unload": "Zone A", "sort": "Zone B", "stow": "Zone C", 
        "pick": "Zone D", "pack": "Zone E", "load": "Zone F"
    }
    
    # Fetch shift schedule of previous day to enforce rest rules (min 11 hours rest)
    # If a worker worked Twilight (14:00-22:00) or Night (22:00-06:00) yesterday,
    # they cannot work Day (06:00-14:00) today.
    prev_date = (cp_model.datetime.datetime.strptime(date_str, "%Y-%m-%d") - cp_model.datetime.timedelta(days=1)).strftime("%Y-%m-%d")
    prev_schedules = db.query(ShiftSchedule).filter(
        ShiftSchedule.schedule_date == prev_date,
        ShiftSchedule.shift_name.in_(["Twilight", "Night"]),
        ShiftSchedule.absent_flag == 0
    ).all()
    rest_restricted_workers = {s.worker_id for s in prev_schedules}

    # Initialize CP-SAT Model
    model = cp_model.CpModel()
    
    # Variables: x[w, s, p] = 1 if worker w is assigned to shift s and process p
    x = {}
    for w in workers:
        for s in shifts:
            for p in processes:
                # Certified only
                if p in w["certs"]:
                    x[w["id"], s, p] = model.NewBoolVar(f"x_{w['id']}_{s}_{p}")
                else:
                    x[w["id"], s, p] = 0 # Cannot assign if not certified
                    
    # Constraints
    
    # 1. At most one shift/process per worker per day
    for w in workers:
        assigned_vars = []
        for s in shifts:
            for p in processes:
                if isinstance(x[w["id"], s, p], int):
                    continue
                assigned_vars.append(x[w["id"], s, p])
        if assigned_vars:
            model.AddAtMostOne(assigned_vars)
            
    # 2. Rest Rule: Worked Twilight/Night yesterday -> cannot work Day today
    for w_id in rest_restricted_workers:
        for p in processes:
            if ("Day", p) in x and not isinstance(x[w_id, "Day", p], int):
                model.Add(x[w_id, "Day", p] == 0)
                
    # 3. Soft headcount requirements
    # We want to match required_headcounts[shift][process] as closely as possible.
    # Shortfall and Overstaffing variables
    shortfalls = {}
    overstaffings = {}
    
    for s in shifts:
        for p in processes:
            req = required_headcounts.get(s, {}).get(p, 0)
            
            # Sum of assigned workers
            assigned_sum = []
            for w in workers:
                if not isinstance(x[w["id"], s, p], int):
                    assigned_sum.append(x[w["id"], s, p])
                    
            # Shortfall variable: shortfall >= req - assigned_sum
            shortfall = model.NewIntVar(0, 100, f"shortfall_{s}_{p}")
            # Overstaffing variable: overstaffing >= assigned_sum - req
            overstaffing = model.NewIntVar(0, 100, f"overstaffing_{s}_{p}")
            
            model.Add(shortfall >= req - sum(assigned_sum))
            model.Add(overstaffing >= sum(assigned_sum) - req)
            
            shortfalls[s, p] = shortfall
            overstaffings[s, p] = overstaffing

    # Objective: Minimize shortfall (high penalty) + overstaffing (low penalty) + labor cost (very low penalty)
    shortfall_penalty = 1000
    overstaff_penalty = 100
    
    objective_terms = []
    
    # Penalties for staffing gaps
    for s in shifts:
        for p in processes:
            objective_terms.append(shortfalls[s, p] * shortfall_penalty)
            objective_terms.append(overstaffings[s, p] * overstaff_penalty)
            
    # Labor cost term (wage rates * hours)
    for w in workers:
        for s in shifts:
            for p in processes:
                if not isinstance(x[w["id"], s, p], int):
                    # planned hours = 8
                    cost = int(w["wage"] * 8.0)
                    objective_terms.append(x[w["id"], s, p] * cost)
                    
    model.Minimize(sum(objective_terms))
    
    # Solve CP-SAT
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 5.0
    status = solver.Solve(model)
    
    roster_output = []
    gantt_tasks = []
    
    # Shift time slots in hours relative to 00:00
    shift_times = {
        "Day": {"start": 6, "end": 14},
        "Twilight": {"start": 14, "end": 22},
        "Night": {"start": 22, "end": 30} # wraps to 06:00 next day
    }
    
    if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
        # Collect assignments
        for w in workers:
            assigned_shift = None
            assigned_process = None
            for s in shifts:
                for p in processes:
                    v = x[w["id"], s, p]
                    if not isinstance(v, int) and solver.Value(v) == 1:
                        assigned_shift = s
                        assigned_process = p
                        break
                if assigned_shift:
                    break
                    
            if assigned_shift:
                roster_output.append({
                    "worker_id": w["id"],
                    "name": w["name"],
                    "shift_name": assigned_shift,
                    "zone": zones[assigned_process],
                    "process": assigned_process,
                    "hourly_rate": w["wage"],
                    "hours": 8.0
                })
                
                # Gantt format task
                t_info = shift_times[assigned_shift]
                gantt_tasks.append({
                    "id": f"task_{w['id']}",
                    "workerId": w["id"],
                    "workerName": w["name"],
                    "process": assigned_process,
                    "zone": zones[assigned_process],
                    "shift": assigned_shift,
                    "startHour": t_info["start"],
                    "endHour": t_info["end"]
                })
                
        # Gap analysis
        gap_table = []
        for s in shifts:
            for p in processes:
                req = required_headcounts.get(s, {}).get(p, 0)
                assigned_count = sum(1 for r in roster_output if r["shift_name"] == s and r["process"] == p)
                gap = assigned_count - req
                gap_table.append({
                    "shift": s,
                    "process": p,
                    "required": req,
                    "assigned": assigned_count,
                    "gap": gap
                })
                
        return {
            "status": "success",
            "solved_optimally": (status == cp_model.OPTIMAL),
            "assignments": roster_output,
            "gantt_tasks": gantt_tasks,
            "gaps": gap_table
        }
    else:
        return {
            "status": "failure",
            "message": "CP-SAT solver failed to find a valid solution under constraints."
        }

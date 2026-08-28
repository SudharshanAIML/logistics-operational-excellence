import simpy
import random
import numpy as np
from typing import Dict, Any, Optional
from sqlalchemy import func
from sqlalchemy.orm import Session
from backend.app.db.models import DailyKPI, WorkerRoster

def _get_real_baselines(db: Optional[Session]):
    """
    Derives baseline OEI/cycle-time from the most recent real day's daily_kpis
    average instead of hardcoded literals, so the scenario "delta" the UI shows
    is a comparison against real recent operations.
    """
    if db is None:
        return 0.87, 42.0

    latest_date = db.query(func.max(DailyKPI.date)).scalar()
    if not latest_date:
        return 0.87, 42.0

    avg_oei, avg_cycle = db.query(
        func.avg(DailyKPI.oei), func.avg(DailyKPI.avg_cycle_time_min)
    ).filter(DailyKPI.date == latest_date).first()

    return (float(avg_oei) if avg_oei is not None else 0.87,
            float(avg_cycle) if avg_cycle is not None else 42.0)

def _get_avg_wage(db: Optional[Session]) -> float:
    """Real average hourly wage across the roster, replacing a made-up per-percent cost formula."""
    if db is None:
        return 22.0
    avg_wage = db.query(func.avg(WorkerRoster.wage_rate)).scalar()
    return float(avg_wage) if avg_wage is not None else 22.0

def run_hub_simulation(
    inbound_surge_pct: float = 0.0,
    absenteeism_pct: float = 6.0,
    efficiency_variance_pct: float = 0.0,
    num_iterations: int = 15,
    sim_duration_min: int = 480, # 8 hour shift
    db: Optional[Session] = None
) -> Dict[str, Any]:
    """
    Simulates the UPS Ground Hub operations using a discrete-event SimPy model.
    Models package flow: Inbound Trailer -> Unload -> Sort -> Stow -> Pick -> Pack -> Load.
    Runs Monte Carlo simulation to estimate SLA breach probability and backlogs.
    """
    
    # Baseline configuration (for a standard day shift)
    base_headcounts = {
        "unload": 5, "sort": 6, "stow": 5, "pick": 6, "pack": 5, "load": 5
    }
    
    uph_standards = {
        "unload": 140, "sort": 320, "stow": 110, "pick": 180, "pack": 150, "load": 200
    }
    
    # Calculate available headcount after absenteeism
    actual_headcounts = {}
    for p, hc in base_headcounts.items():
        # Reduce headcount based on absenteeism
        sick_prob = absenteeism_pct / 100.0
        active_hc = sum(1 for _ in range(hc) if random.random() >= sick_prob)
        actual_headcounts[p] = max(1, active_hc) # at least 1 person per process
        
    # Scale package arrival rate based on surge
    base_arrival_rate_per_min = (1200 / 60.0) # 1200 packages/hour base
    arrival_rate = base_arrival_rate_per_min * (1.0 + inbound_surge_pct / 100.0)
    
    iteration_results = []
    
    for iteration in range(num_iterations):
        env = simpy.Environment()
        
        # Track statistics
        cycle_times = []
        backlogs = {p: 0 for p in uph_standards}
        peak_backlog = 0
        
        # SimPy Resources representing workers
        # Unload -> Sort -> Stow -> Pick -> Pack -> Load
        resources = {
            p: simpy.Resource(env, capacity=actual_headcounts[p]) for p in uph_standards
        }
        
        def package_process(name, env):
            start_time = env.now
            
            # Flow sequence: Unload -> Sort -> Stow -> Pick -> Pack -> Load
            # Each process takes time: item UPH rate is uph_standards[p] per worker
            # Process time in minutes for 1 package = 60.0 / (uph_standards[p] * worker_performance_multiplier)
            
            for p in ["unload", "sort", "stow", "pick", "pack", "load"]:
                backlogs[p] += 1
                nonlocal peak_backlog
                total_backlog = sum(backlogs.values())
                if total_backlog > peak_backlog:
                    peak_backlog = total_backlog
                    
                req = resources[p].request()
                yield req
                
                # Service time per package - efficiency_variance_pct shifts the
                # center of the per-worker performance distribution (e.g. a
                # cross-training or fatigue effect), instead of being a slider
                # that was previously never passed to the simulation at all.
                perf_mult = random.uniform(0.85, 1.15) * (1.0 + efficiency_variance_pct / 100.0)
                perf_mult = max(0.1, perf_mult)
                # scale service time for the resource capacity (active workers)
                # Since multiple workers share the resource pool, wait time is handled by SimPy Resource capacity,
                # but individual processing speed is modeled here.
                service_time = 60.0 / (uph_standards[p] * perf_mult)
                # add small random variance
                service_time = random.expovariate(1.0 / service_time)
                
                yield env.timeout(service_time)
                resources[p].release(req)
                backlogs[p] -= 1
                
            end_time = env.now
            cycle_times.append(end_time - start_time)
            
        def package_generator(env):
            package_id = 0
            while True:
                # Poisson arrivals: time between arrivals is exponentially distributed
                yield env.timeout(random.expovariate(arrival_rate))
                package_id += 1
                env.process(package_process(f"Package_{package_id}", env))
                
        # Start generator
        env.process(package_generator(env))
        
        # Run simulation
        env.run(until=sim_duration_min)
        
        # Calculate stats
        avg_cycle = np.mean(cycle_times) if cycle_times else 0.0
        # SLA breach defined as package taking longer than 90 minutes dock-to-stock
        sla_limit = 90.0
        breached = sum(1 for t in cycle_times if t > sla_limit)
        sla_prob = breached / len(cycle_times) if cycle_times else 0.0
        
        iteration_results.append({
            "avg_cycle_time": avg_cycle,
            "peak_backlog": peak_backlog,
            "sla_breach_prob": sla_prob
        })
        
    # Aggregate Monte Carlo results
    avg_sim_cycle = np.mean([r["avg_cycle_time"] for r in iteration_results])
    avg_peak_backlog = int(np.mean([r["peak_backlog"] for r in iteration_results]))
    avg_sla_breach = np.mean([r["sla_breach_prob"] for r in iteration_results])
    
    # Calculate OEI Impact - each ratio is clamped to [0, 1] since OEI is a
    # product of three ratios and can never legitimately go negative or exceed 1.
    # Throughput drop if backlog piles up
    throughput_mult = max(0.0, min(1.0, 1.0 - (avg_peak_backlog / 2500.0)))
    # Quality drop: congestion increases errors/damage (kept within its
    # realistic modeled band; also capped at 1.0 since negative surge_pct
    # would otherwise push this fractionally above 1)
    quality_mult = max(0.85, min(1.0, 0.985 - (inbound_surge_pct / 1000.0)))
    # Utilization: high volume means high utilization, low volume means low utilization
    utilization_mult = max(0.0, min(0.96, 0.82 + (inbound_surge_pct / 400.0) - (absenteeism_pct / 200.0)))

    projected_oei = round(throughput_mult * quality_mult * utilization_mult, 3)

    # Baseline values from the most recent real day's average, not hardcoded literals.
    # baseline_backlog stays a structural simulation constant: backlog isn't a
    # column anywhere in the schema, so there is no real number to source it from.
    baseline_oei, baseline_cycle = _get_real_baselines(db)
    baseline_backlog = 180

    oei_delta = round(projected_oei - baseline_oei, 3)
    cycle_delta = round(avg_sim_cycle - baseline_cycle, 1)

    # Real labor cost: real average wage from worker_roster x headcount x 8h shift,
    # replacing a made-up "surge_pct * 145 - absenteeism_pct * 80" formula
    avg_wage = _get_avg_wage(db)
    shift_hours = 8.0
    baseline_headcount_total = sum(base_headcounts.values())
    scenario_headcount_total = sum(actual_headcounts.values())
    baseline_cost = round(baseline_headcount_total * shift_hours * avg_wage, 2)
    simulated_cost = round(scenario_headcount_total * shift_hours * avg_wage, 2)
    cost_impact = round(simulated_cost - baseline_cost, 2)

    per_process = [
        {
            "process": p,
            "base_headcount": base_headcounts[p],
            "actual_headcount": actual_headcounts[p],
            "standard_uph": uph_standards[p],
        }
        for p in uph_standards
    ]

    return {
        "scenario": {
            "surge_pct": inbound_surge_pct,
            "absenteeism_pct": absenteeism_pct
        },
        "metrics": {
            "projected_oei": projected_oei,
            "baseline_oei": round(baseline_oei, 3),
            "oei_delta": oei_delta,
            "average_dock_to_stock_min": round(avg_sim_cycle, 1),
            "baseline_dock_to_stock_min": round(baseline_cycle, 1),
            "cycle_time_delta_min": cycle_delta,
            "peak_backlog_items": avg_peak_backlog,
            "backlog_delta_items": avg_peak_backlog - baseline_backlog,
            "sla_breach_probability": round(avg_sla_breach, 2),
            "baseline_headcount": baseline_headcount_total,
            "scenario_headcount": scenario_headcount_total,
            "baseline_cost": baseline_cost,
            "simulated_cost": simulated_cost,
            "projected_cost_delta_usd": cost_impact
        },
        "headcount_allocations": actual_headcounts,
        "per_process": per_process
    }

import simpy
import random
import numpy as np
from typing import Dict, Any

def run_hub_simulation(
    inbound_surge_pct: float = 0.0,
    absenteeism_pct: float = 6.0,
    num_iterations: int = 15,
    sim_duration_min: int = 480 # 8 hour shift
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
                
                # Service time per package
                perf_mult = random.uniform(0.85, 1.15)
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
    
    # Calculate OEI Impact
    # Throughput drop if backlog piles up
    throughput_mult = min(1.0, 1.0 - (avg_peak_backlog / 2500.0))
    # Quality drop: congestion increases errors/damage
    quality_mult = max(0.85, 0.985 - (inbound_surge_pct / 1000.0))
    # Utilization: high volume means high utilization, low volume means low utilization
    utilization_mult = min(0.96, 0.82 + (inbound_surge_pct / 400.0) - (absenteeism_pct / 200.0))
    
    projected_oei = round(throughput_mult * quality_mult * utilization_mult, 3)
    
    # Baseline values for a normal day (0% surge, 6% absent)
    baseline_oei = 0.87
    baseline_cycle = 42.0
    baseline_backlog = 180
    
    oei_delta = round(projected_oei - baseline_oei, 3)
    cycle_delta = round(avg_sim_cycle - baseline_cycle, 1)
    cost_impact = round((inbound_surge_pct * 145.0) - (absenteeism_pct * 80.0), 2)
    
    return {
        "scenario": {
            "surge_pct": inbound_surge_pct,
            "absenteeism_pct": absenteeism_pct
        },
        "metrics": {
            "projected_oei": projected_oei,
            "oei_delta": oei_delta,
            "average_dock_to_stock_min": round(avg_sim_cycle, 1),
            "cycle_time_delta_min": cycle_delta,
            "peak_backlog_items": avg_peak_backlog,
            "backlog_delta_items": avg_peak_backlog - baseline_backlog,
            "sla_breach_probability": round(avg_sla_breach, 2),
            "projected_cost_delta_usd": cost_impact
        },
        "headcount_allocations": actual_headcounts
    }

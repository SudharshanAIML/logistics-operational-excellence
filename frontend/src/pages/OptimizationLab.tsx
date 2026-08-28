import React, { useState, useEffect } from 'react';
import { Sliders, RefreshCw, Zap, TrendingUp } from 'lucide-react';

export const OptimizationLab: React.FC = () => {
  const [surge, setSurge] = useState<number>(0);
  const [absenteeism, setAbsenteeism] = useState<number>(6);
  const [simulation, setSimulation] = useState<any>(null);
  const [running, setRunning] = useState(false);

  // Fetch simulation data when sliders change
  // Note: we fetch on change, but SimPy backend is extremely fast (< 10ms) so it feels instant!
  useEffect(() => {
    setRunning(true);
    fetch(`http://localhost:8000/api/optimization/simulate?surge_pct=${surge}&absenteeism_pct=${absenteeism}`)
      .then(res => res.json())
      .then(data => {
        setSimulation(data);
      })
      .catch(err => console.error("Error running scenario simulation:", err))
      .finally(() => setRunning(false));
  }, [surge, absenteeism]);

  // Presets mapping
  const applyPreset = (surgeVal: number, absentVal: number) => {
    setSurge(surgeVal);
    setAbsenteeism(absentVal);
  };

  if (!simulation) {
    return (
      <div className="flex items-center justify-center h-[500px] text-textMuted font-display uppercase tracking-widest text-xs">
        Loading Digital Twin Lab...
      </div>
    );
  }

  const m = simulation.metrics;
  
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-baseline border-b border-borderClean pb-4">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-wide text-brand-brown">Optimization Lab</h2>
          <p className="text-xs text-textMuted font-ui">
            Simulate operational shifts. Run discrete-event Monte Carlo scenarios using the hub's SimPy digital twin.
          </p>
        </div>
      </div>

      {/* Main Panel grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sliders and Presets Left Panel */}
        <div className="lg:col-span-4 bg-canvas border border-borderClean rounded-card p-5 space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="font-display text-[15px] tracking-wide text-brand-brown">Scenario Parameters</h3>
            <Sliders className="w-4 h-4 text-brand-brown" />
          </div>
          
          {/* Sliders */}
          <div className="space-y-5">
            {/* Surge Slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold text-brand-brown">
                <span className="font-ui">Inbound Volume Surge</span>
                <span className="font-mono text-sm">+{surge}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={surge}
                onChange={(e) => setSurge(Number(e.target.value))}
                className="w-full h-1.5 bg-brand-brown/15 rounded-lg appearance-none cursor-pointer accent-brand-gold"
              />
            </div>

            {/* Absenteeism Slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold text-brand-brown">
                <span className="font-ui">Roster Absenteeism</span>
                <span className="font-mono text-sm">{absenteeism}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="30" 
                value={absenteeism}
                onChange={(e) => setAbsenteeism(Number(e.target.value))}
                className="w-full h-1.5 bg-brand-brown/15 rounded-lg appearance-none cursor-pointer accent-brand-gold"
              />
            </div>
          </div>
          
          {/* Presets */}
          <div className="space-y-2 pt-4 border-t border-borderClean">
            <span className="font-display text-[10px] font-bold tracking-widest text-textMuted uppercase">
              Operational Presets
            </span>
            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <button 
                onClick={() => applyPreset(0, 6)}
                className="border border-borderClean font-display font-semibold uppercase tracking-wider py-2 rounded-btn hover:bg-surface transition-all text-brand-brown"
              >
                Normal Day
              </button>
              <button 
                onClick={() => applyPreset(30, 6)}
                className="border border-borderClean font-display font-semibold uppercase tracking-wider py-2 rounded-btn hover:bg-surface transition-all text-brand-brown"
              >
                Peak Season
              </button>
              <button 
                onClick={() => applyPreset(0, 15)}
                className="border border-borderClean font-display font-semibold uppercase tracking-wider py-2 rounded-btn hover:bg-surface transition-all text-brand-brown"
              >
                Flu Week
              </button>
              <button 
                onClick={() => applyPreset(100, 6)}
                className="border border-borderClean font-display font-semibold uppercase tracking-wider py-2 rounded-btn hover:bg-surface transition-all text-brand-brown"
              >
                Black Friday
              </button>
            </div>
          </div>
        </div>

        {/* Projected Impact Comparison Right Panel */}
        <div className="lg:col-span-8 bg-canvas border border-borderClean rounded-card p-5 flex flex-col justify-between">
          <div>
            <h3 className="font-display text-[15px] tracking-wide text-brand-brown mb-4">Projected Operational Impact</h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-surfaceAlt text-textMuted uppercase font-display text-[10px] font-bold tracking-wider border-b border-borderClean">
                    <th className="py-2.5 px-3">Metric</th>
                    <th className="py-2.5 px-3 text-right">Baseline (Normal)</th>
                    <th className="py-2.5 px-3 text-right">Scenario Projection</th>
                    <th className="py-2.5 px-3 text-right">Delta Deviation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borderClean font-mono tabular-nums">
                  <tr className="hover:bg-surface">
                    <td className="py-3 px-3 font-ui font-semibold text-brand-brown">Ops Efficiency Index (OEI)</td>
                    <td className="py-3 px-3 text-right">0.87</td>
                    <td className="py-3 px-3 text-right font-bold text-brand-brown">{m.projected_oei}</td>
                    <td className={`py-3 px-3 text-right font-bold ${
                      m.oei_delta >= 0 ? 'text-brand-green' : 'text-status-risk'
                    }`}>
                      {m.oei_delta >= 0 ? `+${m.oei_delta.toFixed(2)}` : m.oei_delta.toFixed(2)}
                    </td>
                  </tr>
                  <tr className="hover:bg-surface">
                    <td className="py-3 px-3 font-ui font-semibold text-brand-brown">Dock-to-Stock Cycle Time</td>
                    <td className="py-3 px-3 text-right">42.0 min</td>
                    <td className="py-3 px-3 text-right font-bold text-brand-brown">{m.average_dock_to_stock_min} min</td>
                    <td className={`py-3 px-3 text-right font-bold ${
                      m.cycle_time_delta_min <= 0 ? 'text-brand-green' : 'text-status-risk'
                    }`}>
                      {m.cycle_time_delta_min > 0 ? '+' : ''}{m.cycle_time_delta_min.toFixed(1)} min
                    </td>
                  </tr>
                  <tr className="hover:bg-surface">
                    <td className="py-3 px-3 font-ui font-semibold text-brand-brown">Peak Queue Backlog</td>
                    <td className="py-3 px-3 text-right">180 items</td>
                    <td className="py-3 px-3 text-right font-bold text-brand-brown">{m.peak_backlog_items} items</td>
                    <td className={`py-3 px-3 text-right font-bold ${
                      m.backlog_delta_items <= 0 ? 'text-brand-green' : 'text-status-risk'
                    }`}>
                      {m.backlog_delta_items > 0 ? '+' : ''}{m.backlog_delta_items} units
                    </td>
                  </tr>
                  <tr className="hover:bg-surface">
                    <td className="py-3 px-3 font-ui font-semibold text-brand-brown">SLA Breach Probability</td>
                    <td className="py-3 px-3 text-right">2%</td>
                    <td className="py-3 px-3 text-right font-bold text-brand-brown">{(m.sla_breach_probability * 100).toFixed(0)}%</td>
                    <td className={`py-3 px-3 text-right font-bold ${
                      m.sla_breach_probability <= 0.05 ? 'text-brand-green' : 'text-status-risk'
                    }`}>
                      +{((m.sla_breach_probability - 0.02) * 100).toFixed(0)}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Recommended Redistributive Moves */}
      <div className="bg-canvas border border-borderClean rounded-card p-5">
        <h3 className="font-display text-[15px] tracking-wide text-brand-brown mb-4">Recommended Redistributive Floor Moves</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          <div className="space-y-3">
            <div className="flex justify-between items-center border border-borderClean p-3 rounded-card hover:bg-surface transition-all">
              <span className="font-ui text-xs font-semibold text-brand-brown">Zone D (Pick) &rarr; Zone C (Stow)</span>
              <div className="text-right">
                <span className="font-mono text-xs font-bold text-brand-green">+2 workers</span>
                <span className="block font-display text-[9px] uppercase tracking-wider text-textMuted">OEI Delta: +0.04</span>
              </div>
            </div>

            <div className="flex justify-between items-center border border-borderClean p-3 rounded-card hover:bg-surface transition-all">
              <span className="font-ui text-xs font-semibold text-brand-brown">Zone B (Sort) &rarr; Conveyor Belt Sort</span>
              <div className="text-right">
                <span className="font-mono text-xs font-bold text-brand-green">+1 worker</span>
                <span className="block font-display text-[9px] uppercase tracking-wider text-textMuted">OEI Delta: +0.02</span>
              </div>
            </div>
          </div>
          
          <div className="border border-borderClean rounded-card p-4 bg-surfaceAlt space-y-4">
            <div className="flex items-center gap-2 text-brand-green">
              <Zap className="w-5 h-5 fill-brand-green/20" />
              <h4 className="font-display text-sm tracking-wide font-bold uppercase">Projected Scenario Resolution</h4>
            </div>
            <p className="text-xs text-textMuted leading-relaxed">
              Applying the recommended 3 rebalancing moves corrects sorting bottlenecks and reduces stow waiting idle time, moving projected OEI back to <strong className="text-brand-brown font-mono font-bold">0.84</strong> (within tolerance bounds).
            </p>
            <button className="w-full font-display text-[11px] font-bold uppercase tracking-widest text-textInverse bg-brand-brown hover:bg-brand-brown700 rounded-btn py-2 transition-all">
              Apply Redistributive Plan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

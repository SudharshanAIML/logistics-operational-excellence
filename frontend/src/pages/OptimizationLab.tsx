import React, { useState, useEffect } from 'react';
import { CheckCircle2, Sliders, RefreshCw, Zap, TrendingUp, Download, ArrowRight, Minus, Plus, Target } from 'lucide-react';

const FALLBACK_SIMULATION = {
  status: "success",
  engine_status: "Deterministic MIP Solved",
  metrics: {
    projected_oei: 0.941,
    oei_delta: 0.017,
    average_dock_to_stock_min: 35.0,
    cycle_time_delta_min: -30.0,
    peak_backlog_items: 462,
    backlog_delta_items: 12,
    sla_breach_probability: 0.03,
    baseline_cost: 42500,
    simulated_cost: 43850,
    cost_delta: 1350
  }
};

const FALLBACK_TELEMETRY = [
  { cell: "Sort A", baseHc: 45, rebalancedHc: 53, simLoad: 12400, effUph: 234, clearance: "02:30 AM", status: "Optimized" },
  { cell: "Small Sort", baseHc: 30, rebalancedHc: 34, simLoad: 8900, effUph: 261, clearance: "03:00 AM", status: "Optimized" },
  { cell: "Outbound Pack", baseHc: 60, rebalancedHc: 52, simLoad: 15200, effUph: 292, clearance: "03:15 AM", status: "Stable" },
];

export const OptimizationLab: React.FC = () => {
  const [surge, setSurge] = useState<number>(15);
  const [absenteeism, setAbsenteeism] = useState<number>(8);
  const [variance, setVariance] = useState<number>(-5);
  const [objective, setObjective] = useState<string>('cost_variance');
  const [preset, setPreset] = useState<string>('normal');
  const [simulation, setSimulation] = useState<any>(FALLBACK_SIMULATION);
  const [telemetry, setTelemetry] = useState<any[]>(FALLBACK_TELEMETRY);
  const [appliedPlan, setAppliedPlan] = useState(false);

  // Fetch simulation data when sliders change with fallback
  useEffect(() => {
    fetch(`http://localhost:8000/api/optimization/simulate?surge_pct=${surge}&absenteeism_pct=${absenteeism}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.metrics) {
          setSimulation(data);
        }
      })
      .catch(() => {});
  }, [surge, absenteeism, variance]);

  // Presets mapping
  const applyPreset = (presetName: string, surgeVal: number, absentVal: number, varVal: number) => {
    setPreset(presetName);
    setSurge(surgeVal);
    setAbsenteeism(absentVal);
    setVariance(varVal);
  };

  const handleAdjustHc = (cellIndex: number, delta: number) => {
    setTelemetry(prev => prev.map((t, idx) => {
      if (idx === cellIndex) {
        return { ...t, rebalancedHc: Math.max(1, t.rebalancedHc + delta) };
      }
      return t;
    }));
  };

  const handleApplyPlan = () => {
    setAppliedPlan(true);
    alert("Optimization plan applied: Shift directives dispatched to hub floor supervisors.");
  };

  const handleExportCSV = () => {
    const csvRows = [
      ["Work Cell", "Base HC", "Rebalanced HC", "Simulated Load", "Eff UPH", "Proj Clearance", "Status"],
      ...telemetry.map(t => [t.cell, t.baseHc, t.rebalancedHc, t.simLoad, t.effUph, t.clearance, t.status])
    ];
    const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "zone_rebalancing_telemetry.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const m = simulation.metrics || FALLBACK_SIMULATION.metrics;

  return (
    <div className="space-y-6">
      {/* Engine Top Control Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-borderClean pb-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-brand-green shrink-0" />
          <span className="font-eyebrow text-xs uppercase font-bold tracking-widest text-textMuted">Engine Status:</span>
          <span className="font-display text-lg font-bold text-brand-green uppercase tracking-wide">
            DETERMINISTIC MIP SOLVED
          </span>
        </div>

        <div className="flex items-center gap-2">
          <label className="font-eyebrow text-xs uppercase font-bold tracking-widest text-textMuted">Objective:</label>
          <select 
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            className="bg-canvas border border-borderClean font-display text-xs font-bold uppercase tracking-wider text-brand-brown px-3 py-1.5 rounded-btn outline-none cursor-pointer focus:border-brand-gold shadow-sm"
          >
            <option value="cost_variance">Minimize Cost & Variance</option>
            <option value="throughput">Maximize Throughput</option>
            <option value="load_balance">Balance Load Evenly</option>
          </select>
        </div>
      </div>

      {/* Main 12-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Rail (4 cols): Scenario Stress Controls */}
        <div className="lg:col-span-4 bg-canvas border border-borderClean rounded-card p-5 space-y-6 shadow-sm">
          <div className="flex justify-between items-center border-b border-borderClean pb-3">
            <h2 className="font-display text-sm font-bold uppercase tracking-wide text-brand-brown m-0">
              SCENARIO STRESS CONTROLS
            </h2>
            <Sliders className="w-4 h-4 text-brand-brown" />
          </div>

          {/* Presets Grid */}
          <div className="space-y-2">
            <span className="font-eyebrow text-[10px] font-bold uppercase tracking-widest text-textMuted block">
              OPERATIONAL PRESETS
            </span>
            <div className="grid grid-cols-2 gap-2 text-center">
              <button 
                onClick={() => applyPreset('peak', 30, 6, 5)}
                className={`border py-1.5 px-2 rounded-btn font-display text-[11px] font-bold uppercase tracking-wider transition-all ${
                  preset === 'peak' ? 'bg-brand-brown text-brand-gold border-brand-brown' : 'border-borderClean hover:bg-surfaceAlt text-brand-brown'
                }`}
              >
                Peak Surge
              </button>

              <button 
                onClick={() => applyPreset('flu', 0, 15, -10)}
                className={`border py-1.5 px-2 rounded-btn font-display text-[11px] font-bold uppercase tracking-wider transition-all ${
                  preset === 'flu' ? 'bg-brand-brown text-brand-gold border-brand-brown' : 'border-borderClean hover:bg-surfaceAlt text-brand-brown'
                }`}
              >
                Flu Outbreak
              </button>

              <button 
                onClick={() => applyPreset('weather', -10, 8, -15)}
                className={`border py-1.5 px-2 rounded-btn font-display text-[11px] font-bold uppercase tracking-wider transition-all ${
                  preset === 'weather' ? 'bg-brand-brown text-brand-gold border-brand-brown' : 'border-borderClean hover:bg-surfaceAlt text-brand-brown'
                }`}
              >
                Weather Delay
              </button>

              <button 
                onClick={() => applyPreset('normal', 15, 8, -5)}
                className={`border py-1.5 px-2 rounded-btn font-display text-[11px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                  preset === 'normal' ? 'bg-brand-gold text-brand-brown border-brand-gold' : 'border-borderClean hover:bg-surfaceAlt text-brand-brown'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-brand-gold"></span>
                <span>Normal Baseline</span>
              </button>
            </div>
          </div>

          {/* Sliders Block */}
          <div className="space-y-5 pt-2 border-t border-borderClean">
            {/* Slider 1 */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="font-ui text-brand-brown">Inbound Volume Shock</span>
                <span className="font-mono text-xs font-bold bg-surfaceAlt border border-borderClean px-2 py-0.5 rounded-badge text-brand-brown">
                  {surge > 0 ? `+${surge}` : surge}%
                </span>
              </div>
              <input 
                type="range" 
                min="-30" 
                max="50" 
                value={surge}
                onChange={(e) => { setPreset('custom'); setSurge(Number(e.target.value)); }}
                className="w-full h-1.5 bg-brand-brown/20 rounded-lg appearance-none cursor-pointer accent-brand-gold"
              />
              <div className="flex justify-between text-[10px] font-mono text-textMuted">
                <span>-30%</span>
                <span>+50%</span>
              </div>
            </div>

            {/* Slider 2 */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="font-ui text-brand-brown">Absenteeism</span>
                <span className="font-mono text-xs font-bold bg-surfaceAlt border border-borderClean px-2 py-0.5 rounded-badge text-brand-brown">
                  {absenteeism}%
                </span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="25" 
                value={absenteeism}
                onChange={(e) => { setPreset('custom'); setAbsenteeism(Number(e.target.value)); }}
                className="w-full h-1.5 bg-brand-brown/20 rounded-lg appearance-none cursor-pointer accent-brand-gold"
              />
              <div className="flex justify-between text-[10px] font-mono text-textMuted">
                <span>0%</span>
                <span>25%</span>
              </div>
            </div>

            {/* Slider 3 */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="font-ui text-brand-brown">Efficiency Variance</span>
                <span className="font-mono text-xs font-bold bg-surfaceAlt border border-borderClean px-2 py-0.5 rounded-badge text-brand-brown">
                  {variance > 0 ? `+${variance}` : variance}%
                </span>
              </div>
              <input 
                type="range" 
                min="-20" 
                max="20" 
                value={variance}
                onChange={(e) => { setPreset('custom'); setVariance(Number(e.target.value)); }}
                className="w-full h-1.5 bg-brand-brown/20 rounded-lg appearance-none cursor-pointer accent-brand-gold"
              />
              <div className="flex justify-between text-[10px] font-mono text-textMuted">
                <span>-20%</span>
                <span>+20%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Rail (8 cols): Projected Shift Impact & Directives */}
        <div className="lg:col-span-8 flex flex-col justify-between space-y-6">
          {/* Shift Impact Matrix */}
          <div className="bg-canvas border border-borderClean rounded-card p-5 shadow-sm">
            <h2 className="font-display text-sm font-bold uppercase tracking-wide text-brand-brown border-b border-borderClean pb-3 mb-4">
              PROJECTED SHIFT IMPACT MATRIX
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-surfaceAlt text-textMuted uppercase font-display text-[10px] font-bold tracking-wider border-b border-borderClean">
                    <th className="py-2.5 px-3">Metric</th>
                    <th className="py-2.5 px-3 text-right">Baseline</th>
                    <th className="py-2.5 px-3 text-right font-bold text-brand-brown">Simulated</th>
                    <th className="py-2.5 px-3 text-right font-bold">Delta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borderClean font-mono tabular-nums">
                  <tr className="hover:bg-surface">
                    <td className="py-2.5 px-3 font-ui font-semibold text-brand-brown">Headcount Required</td>
                    <td className="py-2.5 px-3 text-right text-textMuted">450</td>
                    <td className="py-2.5 px-3 text-right font-bold text-brand-brown">462</td>
                    <td className="py-2.5 px-3 text-right font-bold text-status-risk">
                      <span className="bg-status-risk text-white px-2 py-0.5 rounded-badge text-[10px] inline-block">+12</span>
                    </td>
                  </tr>

                  <tr className="hover:bg-surface">
                    <td className="py-2.5 px-3 font-ui font-semibold text-brand-brown">OEI Score</td>
                    <td className="py-2.5 px-3 text-right text-textMuted">92.4%</td>
                    <td className="py-2.5 px-3 text-right font-bold text-brand-brown">94.1%</td>
                    <td className="py-2.5 px-3 text-right font-bold text-brand-green">
                      <span className="bg-brand-green/15 text-brand-green border border-brand-green/30 px-2 py-0.5 rounded-badge text-[10px] inline-block">+1.7%</span>
                    </td>
                  </tr>

                  <tr className="hover:bg-surface">
                    <td className="py-2.5 px-3 font-ui font-semibold text-brand-brown">Clearance Time</td>
                    <td className="py-2.5 px-3 text-right text-textMuted">03:45 AM</td>
                    <td className="py-2.5 px-3 text-right font-bold text-brand-brown">03:15 AM</td>
                    <td className="py-2.5 px-3 text-right font-bold text-brand-green">
                      <span className="bg-brand-green/15 text-brand-green border border-brand-green/30 px-2 py-0.5 rounded-badge text-[10px] inline-block">-30m</span>
                    </td>
                  </tr>

                  <tr className="hover:bg-surface">
                    <td className="py-2.5 px-3 font-ui font-semibold text-brand-brown">Est. Shift Cost</td>
                    <td className="py-2.5 px-3 text-right text-textMuted">$42,500</td>
                    <td className="py-2.5 px-3 text-right font-bold text-brand-brown">$43,850</td>
                    <td className="py-2.5 px-3 text-right font-bold text-status-risk">
                      <span className="bg-status-risk text-white px-2 py-0.5 rounded-badge text-[10px] inline-block">+$1,350</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Actionable Directives Block */}
          <div className="bg-canvas border border-borderClean rounded-card p-5 shadow-sm space-y-4">
            <h2 className="font-display text-sm font-bold uppercase tracking-wide text-brand-brown border-b border-borderClean pb-3">
              ACTIONABLE WORKFORCE REBALANCING DIRECTIVES
            </h2>

            <div className="space-y-3">
              {/* Directive 1 */}
              <div className="border border-borderClean rounded-card p-3 bg-surfaceAlt flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-brand-gold text-brand-brown font-mono text-sm font-bold px-2.5 py-1 rounded-badge">
                    8
                  </div>
                  <div className="flex items-center gap-2 font-ui text-xs font-semibold text-brand-brown">
                    <span>Outbound Pack</span>
                    <ArrowRight className="w-4 h-4 text-textMuted" />
                    <span>Sort A</span>
                  </div>
                </div>
                <span className="font-eyebrow text-[10px] bg-brand-gold/15 text-brand-brown border border-brand-gold/30 px-2 py-0.5 rounded-badge uppercase font-bold tracking-widest">
                  High Impact
                </span>
              </div>

              {/* Directive 2 */}
              <div className="border border-borderClean rounded-card p-3 bg-surfaceAlt flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-brand-gold text-brand-brown font-mono text-sm font-bold px-2.5 py-1 rounded-badge">
                    4
                  </div>
                  <div className="flex items-center gap-2 font-ui text-xs font-semibold text-brand-brown">
                    <span>Unload Bay 2</span>
                    <ArrowRight className="w-4 h-4 text-textMuted" />
                    <span>Small Sort</span>
                  </div>
                </div>
                <span className="font-eyebrow text-[10px] bg-surfaceAlt text-textMuted border border-borderClean px-2 py-0.5 rounded-badge uppercase font-bold tracking-widest">
                  Medium Impact
                </span>
              </div>
            </div>

            <button 
              onClick={handleApplyPlan}
              className={`w-full font-display text-xs font-bold uppercase tracking-widest py-2.5 rounded-btn transition-all shadow-sm ${
                appliedPlan 
                  ? 'bg-brand-green/20 text-brand-green border border-brand-green/40' 
                  : 'bg-brand-gold text-brand-brown hover:bg-brand-gold600'
              }`}
            >
              {appliedPlan ? 'OPTIMIZATION PLAN APPLIED ✓' : 'APPLY OPTIMIZATION PLAN'}
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Section (12 cols): Zone-by-Zone Telemetry */}
      <div className="bg-canvas border border-borderClean rounded-card overflow-hidden shadow-sm">
        <div className="p-4 border-b border-borderClean bg-surfaceAlt flex justify-between items-center">
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-brand-brown">
            ZONE-BY-ZONE REBALANCING TELEMETRY
          </h2>
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 text-brand-brown hover:text-brand-gold transition-colors font-display text-xs font-bold uppercase tracking-wider"
          >
            <Download className="w-4 h-4" />
            <span>Export Data</span>
          </button>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[750px]">
            <thead>
              <tr className="bg-surface text-textMuted font-display text-[10px] font-bold uppercase tracking-wider border-b border-borderClean">
                <th className="p-3">Work Cell</th>
                <th className="p-3 text-right">Base HC</th>
                <th className="p-3 text-center">Rebalanced HC</th>
                <th className="p-3 text-right">Sim. Load (Vol)</th>
                <th className="p-3 text-right">Eff. UPH</th>
                <th className="p-3 text-right">Proj. Clearance</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums text-xs divide-y divide-borderClean">
              {telemetry.map((r: any, idx: number) => (
                <tr key={idx} className="hover:bg-surface transition-colors">
                  <td className="p-3 font-ui font-semibold text-brand-brown">{r.cell}</td>
                  <td className="p-3 text-right text-textMuted">{r.baseHc}</td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button 
                        onClick={() => handleAdjustHc(idx, -1)}
                        className="w-6 h-6 border border-borderClean rounded flex items-center justify-center hover:bg-surfaceAlt transition-colors font-bold text-brand-brown"
                      >
                        -
                      </button>
                      <span className="bg-brand-gold text-brand-brown px-2.5 py-0.5 rounded font-bold font-mono">
                        {r.rebalancedHc}
                      </span>
                      <button 
                        onClick={() => handleAdjustHc(idx, 1)}
                        className="w-6 h-6 border border-borderClean rounded flex items-center justify-center hover:bg-surfaceAlt transition-colors font-bold text-brand-brown"
                      >
                        +
                      </button>
                    </div>
                  </td>
                  <td className="p-3 text-right text-brand-brown font-semibold">{r.simLoad.toLocaleString()}</td>
                  <td className="p-3 text-right text-textMuted">{r.effUph}</td>
                  <td className="p-3 text-right font-semibold text-brand-brown">{r.clearance}</td>
                  <td className="p-3 text-center font-ui">
                    <span className={`px-2.5 py-0.5 rounded-badge text-[10px] font-display font-bold uppercase tracking-wider select-none inline-block ${
                      r.status === 'Optimized' 
                        ? 'bg-brand-green/15 text-brand-green border border-brand-green/30' 
                        : 'bg-surfaceAlt text-textMuted border border-borderClean'
                    }`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};


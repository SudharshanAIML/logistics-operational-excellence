import React, { useState, useEffect } from 'react';
import { CheckCircle2, Sliders, Download, ArrowRight, AlertTriangle } from 'lucide-react';
import { API_BASE_URL } from '../config';

export const OptimizationLab: React.FC = () => {
  const [surge, setSurge] = useState<number>(15);
  const [absenteeism, setAbsenteeism] = useState<number>(8);
  const [variance, setVariance] = useState<number>(-5);
  const [objective, setObjective] = useState<string>('cost_variance');
  const [preset, setPreset] = useState<string>('normal');
  const [simulation, setSimulation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [headcountOverrides, setHeadcountOverrides] = useState<Record<string, number>>({});
  const [appliedPlan, setAppliedPlan] = useState(false);

  // Fetch real simulation data when sliders change - no fallback constants
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`${API_BASE_URL}/api/optimization/simulate?surge_pct=${surge}&absenteeism_pct=${absenteeism}&variance_pct=${variance}`)
      .then(res => res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`)))
      .then(data => {
        setSimulation(data);
        setAppliedPlan(false);
      })
      .catch(err => {
        console.error("Error running simulation:", err);
        setError("Could not reach the Synapse Ops API. Confirm the backend is running.");
      })
      .finally(() => setLoading(false));
  }, [surge, absenteeism, variance]);

  const applyPreset = (presetName: string, surgeVal: number, absentVal: number, varVal: number) => {
    setPreset(presetName);
    setSurge(surgeVal);
    setAbsenteeism(absentVal);
    setVariance(varVal);
  };

  const handleAdjustHc = (process: string, base: number, delta: number) => {
    setHeadcountOverrides(prev => ({
      ...prev,
      [process]: Math.max(1, (prev[process] ?? base) + delta),
    }));
  };

  const handleApplyPlan = () => {
    setAppliedPlan(true);
  };

  const handleExportCSV = () => {
    if (!simulation) return;
    const csvRows = [
      ["Work Cell", "Base HC", "Rebalanced HC", "Standard UPH"],
      ...simulation.per_process.map((p: any) => [
        p.process, p.base_headcount, headcountOverrides[p.process] ?? p.actual_headcount, p.standard_uph
      ])
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

  if (loading && !simulation) {
    return (
      <div className="flex items-center justify-center h-[500px] text-textMuted font-display uppercase tracking-widest text-xs">
        Running Digital Twin Simulation...
      </div>
    );
  }

  if (error || !simulation) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] gap-3 text-center">
        <AlertTriangle className="w-8 h-8 text-status-risk" />
        <p className="text-sm text-brand-brown font-ui font-semibold">{error || "No simulation data available."}</p>
      </div>
    );
  }

  const m = simulation.metrics;

  // Real, data-driven coverage-gap directives: processes where absenteeism
  // dropped actual headcount below the base staffing plan, sorted by size of gap
  const coverageGaps = simulation.per_process
    .map((p: any) => ({ ...p, gap: p.base_headcount - p.actual_headcount }))
    .filter((p: any) => p.gap > 0)
    .sort((a: any, b: any) => b.gap - a.gap);

  return (
    <div className="space-y-6">
      {/* Engine Top Control Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-borderClean pb-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-brand-green shrink-0" />
          <span className="font-eyebrow text-xs uppercase font-bold tracking-widest text-textMuted">Engine Status:</span>
          <span className="font-display text-lg font-bold text-brand-green uppercase tracking-wide">
            SIMPY DIGITAL TWIN {loading ? '(RE-SIMULATING...)' : 'SOLVED'}
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
          {/* Shift Impact Matrix - real baseline vs scenario from the simulator */}
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
                    <td className="py-2.5 px-3 font-ui font-semibold text-brand-brown">Headcount (Active)</td>
                    <td className="py-2.5 px-3 text-right text-textMuted">{m.baseline_headcount}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-brand-brown">{m.scenario_headcount}</td>
                    <td className="py-2.5 px-3 text-right font-bold">
                      <span className={`px-2 py-0.5 rounded-badge text-[10px] inline-block ${m.scenario_headcount >= m.baseline_headcount ? 'bg-brand-green/15 text-brand-green' : 'bg-status-risk text-white'}`}>
                        {m.scenario_headcount - m.baseline_headcount >= 0 ? '+' : ''}{m.scenario_headcount - m.baseline_headcount}
                      </span>
                    </td>
                  </tr>

                  <tr className="hover:bg-surface">
                    <td className="py-2.5 px-3 font-ui font-semibold text-brand-brown">OEI Score</td>
                    <td className="py-2.5 px-3 text-right text-textMuted">{(m.baseline_oei * 100).toFixed(1)}%</td>
                    <td className="py-2.5 px-3 text-right font-bold text-brand-brown">{(m.projected_oei * 100).toFixed(1)}%</td>
                    <td className="py-2.5 px-3 text-right font-bold">
                      <span className={`px-2 py-0.5 rounded-badge text-[10px] inline-block ${m.oei_delta >= 0 ? 'bg-brand-green/15 text-brand-green border border-brand-green/30' : 'bg-status-risk text-white'}`}>
                        {m.oei_delta >= 0 ? '+' : ''}{(m.oei_delta * 100).toFixed(1)}%
                      </span>
                    </td>
                  </tr>

                  <tr className="hover:bg-surface">
                    <td className="py-2.5 px-3 font-ui font-semibold text-brand-brown">Avg Dock-to-Stock (min)</td>
                    <td className="py-2.5 px-3 text-right text-textMuted">{m.baseline_dock_to_stock_min}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-brand-brown">{m.average_dock_to_stock_min}</td>
                    <td className="py-2.5 px-3 text-right font-bold">
                      <span className={`px-2 py-0.5 rounded-badge text-[10px] inline-block ${m.cycle_time_delta_min <= 0 ? 'bg-brand-green/15 text-brand-green border border-brand-green/30' : 'bg-status-risk text-white'}`}>
                        {m.cycle_time_delta_min >= 0 ? '+' : ''}{m.cycle_time_delta_min}m
                      </span>
                    </td>
                  </tr>

                  <tr className="hover:bg-surface">
                    <td className="py-2.5 px-3 font-ui font-semibold text-brand-brown">Est. Shift Cost</td>
                    <td className="py-2.5 px-3 text-right text-textMuted">${m.baseline_cost.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-brand-brown">${m.simulated_cost.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right font-bold">
                      <span className={`px-2 py-0.5 rounded-badge text-[10px] inline-block ${m.projected_cost_delta_usd <= 0 ? 'bg-brand-green/15 text-brand-green border border-brand-green/30' : 'bg-status-risk text-white'}`}>
                        {m.projected_cost_delta_usd >= 0 ? '+' : ''}${m.projected_cost_delta_usd.toLocaleString()}
                      </span>
                    </td>
                  </tr>

                  <tr className="hover:bg-surface">
                    <td className="py-2.5 px-3 font-ui font-semibold text-brand-brown">SLA Breach Probability</td>
                    <td className="py-2.5 px-3 text-right text-textMuted">—</td>
                    <td className="py-2.5 px-3 text-right font-bold text-brand-brown">{(m.sla_breach_probability * 100).toFixed(0)}%</td>
                    <td className="py-2.5 px-3 text-right text-textMuted">—</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Actionable Directives Block - real coverage gaps from absenteeism, not fixed examples */}
          <div className="bg-canvas border border-borderClean rounded-card p-5 shadow-sm space-y-4">
            <h2 className="font-display text-sm font-bold uppercase tracking-wide text-brand-brown border-b border-borderClean pb-3">
              STAFFING COVERAGE GAPS (FROM SIMULATED ABSENTEEISM)
            </h2>

            <div className="space-y-3">
              {coverageGaps.length === 0 ? (
                <p className="text-xs text-textMuted italic py-2">No coverage gaps under this scenario - all processes are at full base staffing.</p>
              ) : (
                coverageGaps.map((p: any) => (
                  <div key={p.process} className="border border-borderClean rounded-card p-3 bg-surfaceAlt flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-brand-gold text-brand-brown font-mono text-sm font-bold px-2.5 py-1 rounded-badge">
                        -{p.gap}
                      </div>
                      <div className="flex items-center gap-2 font-ui text-xs font-semibold text-brand-brown uppercase">
                        <span>{p.process}</span>
                        <span className="text-textMuted font-mono normal-case">({p.actual_headcount}/{p.base_headcount} staffed)</span>
                      </div>
                    </div>
                    <span className={`font-eyebrow text-[10px] px-2 py-0.5 rounded-badge uppercase font-bold tracking-widest border ${
                      p.gap >= 2 ? 'bg-status-risk/15 text-status-risk border-status-risk/30' : 'bg-brand-gold/15 text-brand-brown border-brand-gold/30'
                    }`}>
                      {p.gap >= 2 ? 'High Impact' : 'Medium Impact'}
                    </span>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={handleApplyPlan}
              className={`w-full font-display text-xs font-bold uppercase tracking-widest py-2.5 rounded-btn transition-all shadow-sm ${
                appliedPlan
                  ? 'bg-brand-green/20 text-brand-green border border-brand-green/40'
                  : 'bg-brand-gold text-brand-brown hover:bg-brand-gold600'
              }`}
            >
              {appliedPlan ? 'SCENARIO ACKNOWLEDGED ✓' : 'ACKNOWLEDGE SCENARIO'}
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Section (12 cols): Zone-by-Zone Telemetry - real per-process simulation output */}
      <div className="bg-canvas border border-borderClean rounded-card overflow-hidden shadow-sm">
        <div className="p-4 border-b border-borderClean bg-surfaceAlt flex justify-between items-center">
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-brand-brown">
            ZONE-BY-ZONE HEADCOUNT TELEMETRY
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
          <table className="w-full text-left border-collapse min-w-[650px]">
            <thead>
              <tr className="bg-surface text-textMuted font-display text-[10px] font-bold uppercase tracking-wider border-b border-borderClean">
                <th className="p-3">Work Cell</th>
                <th className="p-3 text-right">Base HC</th>
                <th className="p-3 text-center">Simulated HC (adjustable)</th>
                <th className="p-3 text-right">Standard UPH</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums text-xs divide-y divide-borderClean">
              {simulation.per_process.map((p: any) => {
                const displayedHc = headcountOverrides[p.process] ?? p.actual_headcount;
                const isShort = displayedHc < p.base_headcount;
                return (
                  <tr key={p.process} className="hover:bg-surface transition-colors">
                    <td className="p-3 font-ui font-semibold text-brand-brown uppercase">{p.process}</td>
                    <td className="p-3 text-right text-textMuted">{p.base_headcount}</td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleAdjustHc(p.process, p.actual_headcount, -1)}
                          className="w-6 h-6 border border-borderClean rounded flex items-center justify-center hover:bg-surfaceAlt transition-colors font-bold text-brand-brown"
                        >
                          -
                        </button>
                        <span className="bg-brand-gold text-brand-brown px-2.5 py-0.5 rounded font-bold font-mono">
                          {displayedHc}
                        </span>
                        <button
                          onClick={() => handleAdjustHc(p.process, p.actual_headcount, 1)}
                          className="w-6 h-6 border border-borderClean rounded flex items-center justify-center hover:bg-surfaceAlt transition-colors font-bold text-brand-brown"
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="p-3 text-right text-textMuted">{p.standard_uph}</td>
                    <td className="p-3 text-center font-ui">
                      <span className={`px-2.5 py-0.5 rounded-badge text-[10px] font-display font-bold uppercase tracking-wider select-none inline-block ${
                        isShort
                          ? 'bg-status-risk/15 text-status-risk border border-status-risk/30'
                          : 'bg-brand-green/15 text-brand-green border border-brand-green/30'
                      }`}>
                        {isShort ? 'Short-staffed' : 'At/Above Base'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

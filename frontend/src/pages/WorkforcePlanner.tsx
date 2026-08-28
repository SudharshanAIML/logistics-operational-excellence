import React, { useState, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import { RosterGantt } from '../components/RosterGantt';
import { Clock, Users, AlertTriangle, RefreshCw, ArrowRight, ArrowLeftRight, CheckCircle2, Play, Coffee, ShieldAlert, Check } from 'lucide-react';
import { API_BASE_URL } from '../config';

// The API returns required/available headcounts and a gap, but not a
// pre-computed utilization_pct/isShortfall - derive those display-only
// fields from the real numbers rather than expecting the backend to fabricate them.
function withDerivedFields(row: any) {
  return {
    ...row,
    utilization_pct: row.available_headcount > 0
      ? Math.round((row.required_headcount / row.available_headcount) * 100)
      : 0,
    isShortfall: row.gap < 0,
  };
}

// Real, data-driven redistribution suggestions: greedily pair the process
// with the largest surplus against the process with the largest shortfall,
// computed from the actual gap numbers rather than fixed made-up examples.
function computeDispatchDirectives(processes: any[]) {
  const surplus = processes.filter(p => p.gap > 0).sort((a, b) => b.gap - a.gap);
  const deficit = processes.filter(p => p.gap < 0).sort((a, b) => a.gap - b.gap);
  const directives = [];
  let i = 0, j = 0;
  while (i < surplus.length && j < deficit.length) {
    const move = Math.min(surplus[i].gap, -deficit[j].gap);
    directives.push({
      id: `dir-${surplus[i].process}-${deficit[j].process}`,
      count: move,
      from: surplus[i].label,
      to: deficit[j].label,
      reason: `Relieves ${deficit[j].label} shortfall using ${surplus[i].label}'s surplus headcount.`,
    });
    surplus[i].gap -= move;
    deficit[j].gap += move;
    if (surplus[i].gap === 0) i++;
    if (deficit[j].gap === 0) j++;
  }
  return directives;
}

export const WorkforcePlanner: React.FC = () => {
  const { selectedDate, selectedShift } = useApp();
  const [gapData, setGapData] = useState<any>(null);
  const [ganttTasks, setGanttTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [executedDirectives, setExecutedDirectives] = useState<Record<string, boolean>>({});

  // Fetch real workforce gaps - no fallback constants
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`${API_BASE_URL}/api/workforce/gaps?date=${selectedDate}`)
      .then(res => res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`)))
      .then(data => {
        setGapData({
          ...data,
          total: withDerivedFields(data.total),
          processes: data.processes.map(withDerivedFields),
        });
      })
      .catch(err => {
        console.error("Error loading workforce gaps:", err);
        setError("Could not reach the Synapse Ops API. Confirm the backend is running.");
      })
      .finally(() => setLoading(false));
  }, [selectedDate]);

  // Run CP-SAT optimizer
  const handleGenerateRoster = () => {
    setOptimizing(true);
    const defaultRequirements = {
      "Day": {"unload": 5, "sort": 6, "stow": 5, "pick": 6, "pack": 5, "load": 5},
      "Twilight": {"unload": 6, "sort": 7, "stow": 6, "pick": 6, "pack": 5, "load": 5},
      "Night": {"unload": 3, "sort": 4, "stow": 3, "pick": 4, "pack": 3, "load": 3}
    };

    fetch(`${API_BASE_URL}/api/workforce/optimize?date=${selectedDate}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(defaultRequirements)
    })
      .then(res => res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`)))
      .then(data => {
        if (data.status === "success") {
          setGanttTasks(data.gantt_tasks ?? []);
        } else {
          alert(`Optimizer did not find a feasible roster: ${data.message ?? 'unknown reason'}`);
        }
      })
      .catch(err => alert(`Roster optimization failed: ${err.message}`))
      .finally(() => setOptimizing(false));
  };

  const handleExecuteDirective = (id: string) => {
    setExecutedDirectives(prev => ({ ...prev, [id]: true }));
  };

  const handleAutoBalanceAll = () => {
    // Rebalancing isn't a persisted backend action yet - rather than overwrite
    // the real gap numbers on screen with a fabricated "fully balanced" result,
    // point the user at the optimizer that actually recomputes a real roster.
    alert("Auto-balance isn't wired to a live rebalancing action yet - use \"Generate Roster\" to run the real CP-SAT optimizer against current gaps.");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[500px] text-textMuted font-display uppercase tracking-widest text-xs">
        Assembling Workforce Matrix...
      </div>
    );
  }

  if (error || !gapData) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] gap-3 text-center">
        <AlertTriangle className="w-8 h-8 text-status-risk" />
        <p className="text-sm text-brand-brown font-ui font-semibold">{error || "No workforce data available."}</p>
      </div>
    );
  }

  // Pass a deep copy - computeDispatchDirectives mutates gap values while pairing
  const dispatchDirectives = computeDispatchDirectives(
    gapData.processes.map((p: any) => ({ ...p }))
  );

  return (
    <div className="space-y-6">
      {/* Top Bar Summary Card */}
      <section className="bg-canvas border border-borderClean rounded-card p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-brand-brown text-brand-gold px-3 py-1 rounded-badge font-eyebrow text-xs tracking-widest uppercase flex items-center gap-1.5 font-bold">
            <Clock className="w-4 h-4 text-brand-gold" />
            <span>{selectedShift || "Day"} Shift 06:00–14:00</span>
          </div>
          <h1 className="font-display text-xl font-bold uppercase text-brand-brown tracking-wide m-0">
            WORKFORCE MATRIX & ALLOCATION
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 bg-surfaceAlt px-3 py-1 border border-borderClean rounded-badge font-mono text-xs font-semibold text-brand-brown">
            <Users className="w-4 h-4 text-brand-brown" />
            <span>{gapData.total.available_headcount}/{gapData.total.required_headcount} Assigned</span>
          </div>

          <div className="flex items-center gap-1.5 bg-status-risk/10 text-status-risk px-3 py-1 border border-status-risk/30 rounded-badge font-mono text-xs font-bold">
            <AlertTriangle className="w-4 h-4 text-status-risk" />
            <span>{gapData.total.gap} Shortfall</span>
          </div>

          <button 
            onClick={() => window.location.reload()}
            className="bg-brand-brown text-brand-gold border border-brand-brown hover:bg-brand-brown700 transition-all px-3 py-1 rounded-btn font-display text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Data</span>
          </button>
        </div>
      </section>

      {/* Workforce Matrix Table */}
      <section className="bg-canvas border border-borderClean rounded-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-surfaceAlt border-b border-borderClean text-textMuted font-display text-[10px] font-bold uppercase tracking-wider">
                <th className="p-3 border-r border-borderClean/50">Process Node</th>
                <th className="p-3 text-right border-r border-borderClean/50">Forecast Vol</th>
                <th className="p-3 text-right border-r border-borderClean/50">Std UPH</th>
                <th className="p-3 text-right border-r border-borderClean/50">Req Hours</th>
                <th className="p-3 text-right border-r border-borderClean/50">Req HC</th>
                <th className="p-3 text-right border-r border-borderClean/50">Avail HC</th>
                <th className="p-3 text-center border-r border-borderClean/50">Gap (Δ)</th>
                <th className="p-3 text-right border-r border-borderClean/50">Util %</th>
                <th className="p-3 text-center">Floor Actions</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums text-xs divide-y divide-borderClean">
              {gapData.processes.map((r: any, idx: number) => {
                const isShortfall = r.gap < 0 || r.isShortfall;
                return (
                  <tr 
                    key={idx} 
                    className={`transition-colors ${
                      isShortfall 
                        ? 'bg-status-risk/10 hover:bg-status-risk/15 border-l-4 border-l-status-risk' 
                        : 'hover:bg-surface border-l-4 border-l-transparent'
                    }`}
                  >
                    <td className="p-3 border-r border-borderClean/50 font-ui font-semibold text-brand-brown flex items-center gap-2">
                      {isShortfall && <AlertTriangle className="w-4 h-4 text-status-risk shrink-0" />}
                      <span>{r.label}</span>
                    </td>
                    <td className="p-3 text-right border-r border-borderClean/50 text-brand-brown font-semibold">{r.forecast_volume.toLocaleString()}</td>
                    <td className="p-3 text-right border-r border-borderClean/50 text-textMuted">{r.standard_uph}</td>
                    <td className="p-3 text-right border-r border-borderClean/50">{r.required_hours} h</td>
                    <td className="p-3 text-right border-r border-borderClean/50 font-bold text-brand-brown">{r.required_headcount}</td>
                    <td className={`p-3 text-right border-r border-borderClean/50 font-bold ${isShortfall ? 'text-status-risk' : 'text-brand-brown'}`}>
                      {r.available_headcount}
                    </td>
                    <td className="p-3 text-center border-r border-borderClean/50">
                      <span className={`inline-block px-2 py-0.5 rounded-badge text-[10px] font-bold ${
                        r.gap > 0 
                          ? 'bg-brand-green/15 text-brand-green border border-brand-green/30' 
                          : r.gap < 0 
                            ? 'bg-status-risk text-white border border-status-risk' 
                            : 'bg-surfaceAlt text-textMuted border border-borderClean'
                      }`}>
                        {r.gap > 0 ? `+${r.gap}` : r.gap}
                      </span>
                    </td>
                    <td className={`p-3 text-right border-r border-borderClean/50 font-bold ${r.utilization_pct > 100 ? 'text-status-risk' : 'text-brand-brown'}`}>
                      {r.utilization_pct}%
                    </td>
                    <td className="p-3 text-center font-ui">
                      {isShortfall ? (
                        <button 
                          onClick={() => handleExecuteDirective(`dir-${idx}`)}
                          className="bg-brand-brown text-brand-gold hover:bg-brand-brown700 transition-all px-2.5 py-1 rounded-btn text-[10.5px] font-display font-bold uppercase tracking-wider"
                        >
                          Rebalance
                        </button>
                      ) : (
                        <button className="text-textMuted hover:text-brand-brown transition-colors opacity-60">
                          <ArrowLeftRight className="w-4 h-4 mx-auto" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-brand-brown text-textInverse font-bold font-mono text-xs border-t-2 border-brand-gold">
                <td className="p-3 font-display font-bold uppercase tracking-wider text-xs border-r border-brand-brown700">Total Aggregates</td>
                <td className="p-3 text-right border-r border-brand-brown700">{gapData.total.forecast_volume.toLocaleString()}</td>
                <td className="p-3 text-right border-r border-brand-brown700 text-textInverse/60">—</td>
                <td className="p-3 text-right border-r border-brand-brown700">{gapData.total.required_hours} h</td>
                <td className="p-3 text-right border-r border-brand-brown700 text-brand-gold">{gapData.total.required_headcount}</td>
                <td className="p-3 text-right border-r border-brand-brown700 text-brand-gold">{gapData.total.available_headcount}</td>
                <td className="p-3 text-center border-r border-brand-brown700">
                  <span className="inline-block px-2 py-0.5 rounded-badge text-[10px] font-bold bg-status-risk text-white">
                    {gapData.total.gap > 0 ? `+${gapData.total.gap}` : gapData.total.gap}
                  </span>
                </td>
                <td className="p-3 text-right border-r border-brand-brown700">{gapData.total.utilization_pct}%</td>
                <td className="p-3 text-center font-ui">
                  <button 
                    onClick={handleAutoBalanceAll}
                    className="bg-brand-gold text-brand-brown hover:bg-brand-gold600 transition-all px-3 py-1 rounded-btn font-display text-[11px] uppercase tracking-wider font-bold shadow-sm whitespace-nowrap"
                  >
                    Auto-Balance All
                  </button>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* Bottom Grid (2 Panels) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel 1: Dispatch Directives */}
        <section className="bg-canvas border border-borderClean rounded-card flex flex-col justify-between p-5 space-y-4 shadow-sm">
          <div>
            <div className="flex items-center justify-between border-b border-borderClean pb-3 mb-4">
              <h3 className="font-display text-sm font-bold uppercase tracking-wide text-brand-brown flex items-center gap-2 m-0">
                <CheckCircle2 className="w-5 h-5 text-brand-brown" />
                <span>DISPATCH DIRECTIVES</span>
              </h3>
              <span className="font-eyebrow text-[10px] bg-brand-green/15 text-brand-green border border-brand-green/30 px-2 py-0.5 rounded-badge uppercase font-bold tracking-widest">
                {dispatchDirectives.length} Active Directive{dispatchDirectives.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="space-y-3">
              {dispatchDirectives.length === 0 ? (
                <p className="text-xs text-textMuted italic py-4 text-center">No redistribution needed - all processes are within their required headcount.</p>
              ) : (
                dispatchDirectives.map((d) => (
                  <div key={d.id} className="border border-borderClean border-l-4 border-l-brand-gold rounded-card p-3 bg-surfaceAlt flex justify-between items-start">
                    <div>
                      <p className="font-ui text-xs font-bold text-brand-brown mb-0.5">Reassign {d.count} worker{d.count === 1 ? '' : 's'}</p>
                      <p className="font-mono text-xs text-textMuted">
                        Move from <strong className="text-brand-brown">{d.from}</strong> &rarr; <strong className="text-status-risk">{d.to}</strong>
                      </p>
                      <p className="font-eyebrow text-[10px] uppercase tracking-wider text-brand-brown/80 mt-1">
                        {d.reason}
                      </p>
                    </div>
                    <button
                      onClick={() => handleExecuteDirective(d.id)}
                      disabled={executedDirectives[d.id]}
                      className={`font-display text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-btn transition-all shrink-0 ${
                        executedDirectives[d.id]
                          ? 'bg-brand-green/20 text-brand-green border border-brand-green/40 cursor-default'
                          : 'bg-brand-brown text-brand-gold hover:bg-brand-brown700'
                      }`}
                    >
                      {executedDirectives[d.id] ? 'Executed ✓' : 'Execute'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* Panel 2: Break Rotation Schedule & Roster Timeline */}
        <section className="bg-canvas border border-borderClean rounded-card p-5 space-y-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-borderClean pb-3 mb-4">
              <h3 className="font-display text-sm font-bold uppercase tracking-wide text-brand-brown flex items-center gap-2 m-0">
                <Coffee className="w-5 h-5 text-brand-brown" />
                <span>BREAK ROTATION TIMELINE & ROSTER SCHEDULER</span>
              </h3>

              <button 
                onClick={handleGenerateRoster}
                disabled={optimizing}
                className={`font-display text-[11px] font-bold uppercase tracking-wider text-brand-brown bg-brand-gold hover:bg-brand-gold600 py-1.5 px-3 rounded-btn transition-all flex items-center gap-1.5 ${
                  optimizing ? 'opacity-70 cursor-not-allowed' : ''
                }`}
              >
                <span>{optimizing ? 'SOLVING...' : 'GENERATE ROSTER'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Break Timeline Visualizer */}
            <div className="border border-borderClean rounded-card p-3 bg-surfaceAlt space-y-3 mb-4">
              <div className="flex border-b border-borderClean pb-1 font-mono text-[10px] text-textMuted justify-between relative px-2">
                <span className="w-1/4 font-display font-semibold uppercase">Process Area</span>
                <div className="w-3/4 flex justify-between relative">
                  <span>10:00</span>
                  <span>10:30</span>
                  <span>11:00</span>
                  <span>11:30</span>
                  {/* NOW Line */}
                  <div className="absolute left-1/3 top-0 bottom-[-80px] w-[2px] bg-status-risk z-10 pointer-events-none"></div>
                  <div className="absolute left-1/3 top-[-14px] -translate-x-1/2 bg-status-risk text-white font-mono text-[9px] px-1 rounded-sm z-20 font-bold">
                    NOW
                  </div>
                </div>
              </div>

              {/* Rows - break block positions are illustrative (no break-schedule
                  data exists in the schema), but the headcounts shown are real */}
              <div className="space-y-2 pt-1 font-ui text-xs">
                {(() => {
                  const byProcess = Object.fromEntries(gapData.processes.map((p: any) => [p.process, p]));
                  const unload = byProcess['unload'], sort = byProcess['sort'], stow = byProcess['stow'];
                  return (
                    <>
                <div className="flex items-center">
                  <span className="w-1/4 font-semibold text-brand-brown truncate pr-2">Unload</span>
                  <div className="w-3/4 h-6 bg-canvas rounded border border-borderClean relative flex items-center">
                    <div className="absolute left-0 w-1/4 h-full bg-surface-container-high border-r border-borderClean flex items-center justify-center font-eyebrow text-[9px] text-textMuted font-bold">
                      BREAK
                    </div>
                    <div className={`absolute left-1/4 w-3/4 h-full bg-canvas border-l border-borderClean flex items-center pl-2 font-mono text-[10px] font-semibold ${unload?.isShortfall ? 'text-status-risk' : 'text-brand-brown'}`}>
                      Active ({unload?.available_headcount ?? '—'}/{unload?.required_headcount ?? '—'}){unload?.isShortfall ? ' - Short' : ''}
                    </div>
                  </div>
                </div>

                <div className="flex items-center">
                  <span className="w-1/4 font-semibold text-brand-brown truncate pr-2">Sort</span>
                  <div className="w-3/4 h-6 bg-canvas rounded border border-borderClean relative flex items-center">
                    <div className={`absolute left-0 w-1/2 h-full bg-canvas border-r border-borderClean flex items-center pl-2 font-mono text-[10px] font-bold ${sort?.isShortfall ? 'text-status-risk' : 'text-brand-brown'}`}>
                      Active ({sort?.available_headcount ?? '—'}/{sort?.required_headcount ?? '—'}){sort?.isShortfall ? ' - Short' : ''}
                    </div>
                    <div className="absolute left-1/2 w-1/4 h-full bg-surface-container-high border-x border-borderClean flex items-center justify-center font-eyebrow text-[9px] text-textMuted font-bold">
                      BREAK
                    </div>
                  </div>
                </div>

                <div className="flex items-center">
                  <span className="w-1/4 font-semibold text-brand-brown truncate pr-2">Stow</span>
                  <div className="w-3/4 h-6 bg-canvas rounded border border-borderClean relative flex items-center">
                    <div className={`absolute left-1/4 w-1/2 h-full bg-canvas border-x border-borderClean flex items-center pl-2 font-mono text-[10px] font-semibold ${stow?.isShortfall ? 'text-status-risk' : 'text-brand-brown'}`}>
                      Active ({stow?.available_headcount ?? '—'}/{stow?.required_headcount ?? '—'}){stow?.isShortfall ? ' - Short' : ''}
                    </div>
                    <div className="absolute left-3/4 w-1/4 h-full bg-surface-container-high border-l border-borderClean flex items-center justify-center font-eyebrow text-[9px] text-textMuted font-bold">
                      BREAK
                    </div>
                  </div>
                </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Roster Timeline Gantt */}
          <RosterGantt tasks={ganttTasks} />
        </section>
      </div>
    </div>
  );
};


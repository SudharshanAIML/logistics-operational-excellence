import React, { useState, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import { ResponsiveContainer, ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
import { ArrowUp, ArrowDown, Minus, Activity, AlertTriangle } from 'lucide-react';
import { API_BASE_URL } from '../config';

const OEI_TARGET = 0.85; // stated goal, not measured data

export const EfficiencyDashboard: React.FC = () => {
  const { selectedDate, selectedShift } = useApp();
  const [summary, setSummary] = useState<any>(null);
  const [efficiency, setEfficiency] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedZoneModal, setSelectedZoneModal] = useState<any>(null);

  // Fetch real KPI data - no fallback constants
  useEffect(() => {
    setLoading(true);
    setError(null);
    const shiftQuery = selectedShift ? `&shift=${selectedShift}` : '';

    Promise.all([
      fetch(`${API_BASE_URL}/api/dashboard/summary?date=${selectedDate}${shiftQuery}`)
        .then(res => res.ok ? res.json() : Promise.reject(new Error(`summary: HTTP ${res.status}`))),
      fetch(`${API_BASE_URL}/api/dashboard/efficiency?date=${selectedDate}${shiftQuery}`)
        .then(res => res.ok ? res.json() : Promise.reject(new Error(`efficiency: HTTP ${res.status}`))),
    ])
      .then(([summaryData, efficiencyData]) => {
        setSummary(summaryData);
        setEfficiency(efficiencyData);
      })
      .catch(err => {
        console.error("Error loading Efficiency Dashboard data:", err);
        setError("Could not reach the Synapse Ops API. Confirm the backend is running.");
      })
      .finally(() => setLoading(false));
  }, [selectedDate, selectedShift]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[500px] text-textMuted font-display uppercase tracking-widest text-xs">
        Assembling Efficiency Analytics...
      </div>
    );
  }

  if (error || !summary || !efficiency) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] gap-3 text-center">
        <AlertTriangle className="w-8 h-8 text-status-risk" />
        <p className="text-sm text-brand-brown font-ui font-semibold">{error || "No efficiency data available."}</p>
      </div>
    );
  }

  // Real OEI loss decomposition - the OEI formula's own three sub-components,
  // not an invented downtime-reason breakdown with no data behind it
  const lossDecomposition = [
    { label: "Throughput Loss", pct: Math.round((1 - summary.throughput_ratio) * 1000) / 10 },
    { label: "Quality Loss", pct: Math.round((1 - summary.quality_ratio) * 1000) / 10 },
    { label: "Utilization Loss", pct: Math.round((1 - summary.utilization_ratio) * 1000) / 10 },
  ].sort((a, b) => b.pct - a.pct);
  const biggestLoss = lossDecomposition[0];

  return (
    <div className="space-y-6">
      {/* Context & Top Filters Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-borderClean pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-brand-brown leading-none">
            OPERATIONS EFFICIENCY & THROUGHPUT ANALYTICS
          </h1>
          <p className="font-ui text-xs text-textMuted mt-1">
            Real-time metrics & zone-level OEI audit for current operational shift.
          </p>
        </div>

        {/* OEI Target vs Actual Pill */}
        <div className="flex items-center gap-2 bg-canvas border border-borderClean p-1.5 rounded-card shadow-sm">
          <div className="flex items-center gap-1.5 px-3 border-r border-borderClean font-mono text-xs">
            <span className="font-eyebrow text-[10px] text-textMuted uppercase font-bold tracking-wider">OEI Target</span>
            <span className="font-bold text-brand-brown">{OEI_TARGET.toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 font-mono text-xs">
            <span className="font-eyebrow text-[10px] text-textMuted uppercase font-bold tracking-wider">Actual</span>
            <span className={`font-bold ${summary.oei_score >= OEI_TARGET ? 'text-brand-green' : 'text-status-risk'}`}>
              {summary.oei_score.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* KPI Cards Row (4 Cards) - real values, no fabricated trend arrows */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-canvas border border-borderClean p-5 rounded-card flex flex-col justify-between h-[120px] shadow-sm">
          <span className="font-eyebrow text-[11px] font-bold text-textMuted uppercase tracking-widest leading-none">
            AVG UPH
          </span>
          <div className="flex items-baseline">
            <span className="font-mono text-3xl font-bold text-brand-brown tracking-tight leading-none tabular-nums">
              {efficiency.avg_uph}
            </span>
            <span className="ml-1 text-xs font-display font-semibold text-textMuted uppercase">pk/hr</span>
          </div>
        </div>

        <div className="bg-canvas border border-borderClean p-5 rounded-card flex flex-col justify-between h-[120px] shadow-sm">
          <span className="font-eyebrow text-[11px] font-bold text-textMuted uppercase tracking-widest leading-none">
            DOCK-TO-DOOR
          </span>
          <div className="flex items-baseline">
            <span className="font-mono text-3xl font-bold text-brand-brown tracking-tight leading-none tabular-nums">
              {summary.avg_cycle_time_min}
            </span>
            <span className="ml-1 text-xs font-display font-semibold text-textMuted uppercase">m</span>
          </div>
        </div>

        <div className="bg-canvas border border-borderClean p-5 rounded-card flex flex-col justify-between h-[120px] shadow-sm">
          <span className="font-eyebrow text-[11px] font-bold text-textMuted uppercase tracking-widest leading-none">
            LOST TIME
          </span>
          <div className="flex items-baseline">
            <span className="font-mono text-3xl font-bold text-brand-brown tracking-tight leading-none tabular-nums">
              {efficiency.lost_time_hours}
            </span>
            <span className="ml-1 text-xs font-display font-semibold text-textMuted uppercase">hr</span>
          </div>
        </div>

        <div className="bg-canvas border border-borderClean p-5 rounded-card flex flex-col justify-between h-[120px] shadow-sm">
          <span className="font-eyebrow text-[11px] font-bold text-textMuted uppercase tracking-widest leading-none">
            COST/PKG
          </span>
          <div className="flex items-baseline">
            <span className="font-mono text-3xl font-bold text-brand-brown tracking-tight leading-none tabular-nums">
              ${efficiency.cost_per_pkg.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Row (8 cols Chart | 4 cols Loss Decomposition) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 8-col Process Throughput Chart */}
        <div className="lg:col-span-8 bg-canvas border border-borderClean rounded-card p-5 flex flex-col justify-between h-[360px] shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-display text-sm font-bold uppercase tracking-wide text-brand-brown">
              THROUGHPUT VS STANDARD (ALL PROCESSES, NORMALIZED)
            </h3>
            <div className="flex items-center gap-4 font-display text-[10px] font-bold tracking-wider text-textMuted uppercase">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 bg-brand-brown rounded-sm inline-block"></span>
                <span>ACTUAL (% OF STANDARD)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 border-t-2 border-dashed border-brand-gold inline-block"></span>
                <span>STANDARD (100%)</span>
              </div>
            </div>
          </div>

          <div className="flex-1 w-full min-h-0">
            {efficiency.throughput_series.length === 0 ? (
              <div className="flex items-center justify-center h-full text-xs text-textMuted italic">
                No scan events recorded for this date.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={efficiency.throughput_series} margin={{ top: 10, right: 10, bottom: 5, left: -20 }}>
                  <CartesianGrid stroke="#E3DCD6" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="time"
                    tick={{ fill: '#504441', fontSize: 11, fontFamily: 'IBM Plex Mono, monospace' }}
                    axisLine={false}
                    tickLine={false}
                    dy={8}
                  />
                  <YAxis
                    domain={[0, 150]}
                    tick={{ fill: '#504441', fontSize: 11, fontFamily: 'IBM Plex Mono, monospace' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#351C15', color: '#FAF8F6', borderRadius: '6px', border: 'none', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px' }}
                    itemStyle={{ color: '#FFB500' }}
                  />
                  <Bar dataKey="actual" fill="#351C15" barSize={16} radius={[3, 3, 0, 0]} />
                  <ReferenceLine y={100} stroke="#FFB500" strokeWidth={2} strokeDasharray="4 4" />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* 4-col OEI Loss Decomposition */}
        <div className="lg:col-span-4 bg-canvas border border-borderClean rounded-card p-5 flex flex-col justify-between h-[360px] shadow-sm">
          <div>
            <div className="flex justify-between items-center border-b border-borderClean pb-3 mb-4">
              <h3 className="font-display text-sm font-bold uppercase tracking-wide text-brand-brown">
                OEI LOSS DECOMPOSITION
              </h3>
              <Activity className="w-4 h-4 text-brand-brown" />
            </div>
            <p className="text-xs text-textMuted font-ui mb-5">
              Real breakdown of the OEI formula's own three components: Throughput × Quality × Utilization.
            </p>

            <div className="space-y-5">
              {lossDecomposition.map((loss, idx) => (
                <div key={loss.label} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-brand-brown font-ui">{loss.label}</span>
                    <span className={`font-mono text-xs font-bold ${idx === 0 ? 'text-status-risk' : idx === 1 ? 'text-brand-gold' : 'text-brand-brown'}`}>
                      {loss.pct}%
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-surfaceAlt rounded-full overflow-hidden border border-borderClean">
                    <div
                      className={`h-full rounded-full ${idx === 0 ? 'bg-status-risk' : idx === 1 ? 'bg-brand-gold' : 'bg-brand-brown'}`}
                      style={{ width: `${Math.min(100, Math.max(0, loss.pct))}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 bg-surfaceAlt rounded-card border border-borderClean text-[11px] text-textMuted font-ui leading-tight mt-4">
            💡 <strong className="text-brand-brown">Focus area:</strong> {biggestLoss.label} is the largest efficiency loss today ({biggestLoss.pct}%) - prioritize improvements there for the biggest OEI gain.
          </div>
        </div>
      </div>

      {/* Bottom Section - Zone Efficiency Audit Table */}
      <div className="bg-canvas border border-borderClean rounded-card overflow-hidden shadow-sm">
        <div className="p-4 border-b border-borderClean bg-surfaceAlt flex justify-between items-center">
          <h3 className="font-display text-sm font-bold uppercase tracking-wide text-brand-brown">
            ZONE EFFICIENCY AUDIT
          </h3>
          <span className="font-mono text-xs text-textMuted">{efficiency.zone_audit.length} Zones Active</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-surface text-textMuted font-display text-[10px] font-bold uppercase tracking-wider border-b border-borderClean">
                <th className="p-3">BELT / ZONE</th>
                <th className="p-3 text-right">STANDARD (UPH)</th>
                <th className="p-3 text-right">ACTUAL (UPH)</th>
                <th className="p-3 text-center">OEI SCORE</th>
                <th className="p-3 text-right">QUALITY LOSS %</th>
                <th className="p-3 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums text-xs divide-y divide-borderClean">
              {efficiency.zone_audit.map((r: any) => {
                const isRisk = r.status === 'risk';
                const isWatch = r.status === 'watch';
                const isRedacted = r.status === 'redacted';

                return (
                  <tr
                    key={r.process}
                    className={`transition-colors ${
                      isRisk
                        ? 'bg-status-risk/10 hover:bg-status-risk/15'
                        : isWatch
                          ? 'bg-brand-gold/10 hover:bg-brand-gold/15'
                          : 'hover:bg-surface'
                    }`}
                  >
                    <td className="p-3 font-ui font-semibold text-brand-brown">{r.belt}</td>
                    <td className="p-3 text-right text-textMuted">{r.standard}</td>
                    <td className="p-3 text-right font-bold text-brand-brown">{r.actual ?? '—'}</td>
                    <td className="p-3 text-center">
                      {isRedacted ? (
                        <span className="inline-flex items-center justify-center font-bold px-2 py-0.5 rounded text-[10px] text-textMuted bg-surfaceAlt border border-borderClean min-w-[42px]">
                          N/A
                        </span>
                      ) : (
                        <span className={`inline-flex items-center justify-center font-bold px-2 py-0.5 rounded text-xs text-white min-w-[42px] ${
                          isRisk ? 'bg-status-risk' : isWatch ? 'bg-brand-gold text-brand-brown' : 'bg-brand-green'
                        }`}>
                          .{Math.round(r.oei * 100)}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right font-bold text-textMuted">
                      {r.quality_loss_pct !== null ? `${r.quality_loss_pct}%` : '—'}
                    </td>
                    <td className="p-3 text-right font-ui">
                      <button
                        onClick={() => setSelectedZoneModal(r)}
                        className="font-display text-[11px] font-bold uppercase tracking-wider px-3 py-1 border border-borderClean rounded-btn hover:bg-brand-brown hover:text-textInverse transition-all"
                      >
                        Deep Dive
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Deep Dive Modal - shows the real numbers behind the row, no fabricated sensor readings */}
      {selectedZoneModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-canvas border border-borderClean rounded-card max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-borderClean pb-3">
              <h3 className="font-display text-lg font-bold uppercase tracking-wide text-brand-brown">
                Deep Dive: {selectedZoneModal.belt}
              </h3>
              <button onClick={() => setSelectedZoneModal(null)} className="text-textMuted hover:text-brand-brown font-bold text-sm">✕</button>
            </div>
            <div className="space-y-3 text-xs font-ui text-textMuted">
              <div className="p-3 bg-surfaceAlt border border-borderClean rounded-card space-y-2 font-mono text-[11px]">
                <div className="flex justify-between"><span className="text-textMuted">Standard UPH:</span><span className="text-brand-brown font-bold">{selectedZoneModal.standard}</span></div>
                <div className="flex justify-between"><span className="text-textMuted">Actual UPH:</span><span className="text-brand-brown font-bold">{selectedZoneModal.actual ?? 'N/A'}</span></div>
                <div className="flex justify-between"><span className="text-textMuted">OEI Score:</span><span className="text-brand-brown font-bold">{selectedZoneModal.oei !== null ? selectedZoneModal.oei.toFixed(2) : 'Redacted (below privacy floor)'}</span></div>
                <div className="flex justify-between"><span className="text-textMuted">Quality Loss:</span><span className="text-brand-brown font-bold">{selectedZoneModal.quality_loss_pct !== null ? `${selectedZoneModal.quality_loss_pct}%` : 'N/A'}</span></div>
              </div>
            </div>
            <button
              onClick={() => setSelectedZoneModal(null)}
              className="w-full bg-brand-brown text-textInverse font-display text-xs font-bold uppercase tracking-widest py-2 rounded-btn hover:bg-brand-brown700 transition-all"
            >
              Close Diagnostic Panel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

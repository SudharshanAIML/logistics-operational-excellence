import React, { useState, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import { ResponsiveContainer, ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
import { ArrowUp, ArrowDown, Minus, Activity, ShieldCheck, AlertCircle, ChevronRight, Filter } from 'lucide-react';

const FALLBACK_THROUGHPUT_DATA = [
  { time: '08:00', actual: 280, target: 300 },
  { time: '09:00', actual: 295, target: 300 },
  { time: '10:00', actual: 310, target: 300 },
  { time: '11:00', actual: 285, target: 300 },
  { time: '12:00', actual: 270, target: 300 },
  { time: '13:00', actual: 320, target: 300 },
  { time: '14:00', actual: 335, target: 300 },
];

const FALLBACK_ZONE_AUDIT = [
  { belt: 'Primary Sort A', standard: 300, actual: 315, oei: 0.92, jamPct: 1.2, recircPct: 4.5, status: 'ok' },
  { belt: 'Secondary Belt B', standard: 250, actual: 240, oei: 0.82, jamPct: 3.4, recircPct: 6.1, status: 'watch' },
  { belt: 'Small Sort C', standard: 450, actual: 380, oei: 0.74, jamPct: 8.2, recircPct: 5.0, status: 'risk' },
  { belt: 'Outbound Pack D', standard: 400, actual: 392, oei: 0.89, jamPct: 0.8, recircPct: 2.1, status: 'ok' },
];

export const EfficiencyDashboard: React.FC = () => {
  const { selectedDate, selectedShift } = useApp();
  const [throughputData, setThroughputData] = useState<any[]>(FALLBACK_THROUGHPUT_DATA);
  const [zoneAudit, setZoneAudit] = useState<any[]>(FALLBACK_ZONE_AUDIT);
  const [selectedZoneModal, setSelectedZoneModal] = useState<string | null>(null);

  // Fetch KPI data with fallback
  useEffect(() => {
    const shiftQuery = selectedShift ? `?shift=${selectedShift}` : '';
    fetch(`http://localhost:8000/api/dashboard/trends?start_date=2026-08-20&end_date=2026-08-28`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (Array.isArray(data) && data.length) {
          // Map to throughput format if available
        }
      })
      .catch(() => {});
  }, [selectedDate, selectedShift]);

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
            <span className="font-bold text-brand-brown">0.85</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 font-mono text-xs">
            <span className="font-eyebrow text-[10px] text-textMuted uppercase font-bold tracking-wider">Actual</span>
            <span className="font-bold text-brand-green">0.87</span>
          </div>
        </div>
      </div>

      {/* KPI Cards Row (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* AVG UPH */}
        <div className="bg-canvas border border-borderClean p-5 rounded-card flex flex-col justify-between h-[120px] shadow-sm">
          <span className="font-eyebrow text-[11px] font-bold text-textMuted uppercase tracking-widest leading-none">
            AVG UPH
          </span>
          <div className="flex items-end justify-between">
            <div className="flex items-baseline">
              <span className="font-mono text-3xl font-bold text-brand-brown tracking-tight leading-none tabular-nums">
                312
              </span>
              <span className="ml-1 text-xs font-display font-semibold text-textMuted uppercase">pk</span>
            </div>
            <span className="bg-brand-green text-white font-display text-[10px] font-bold px-2 py-0.5 rounded-badge uppercase flex items-center gap-0.5">
              <ArrowUp className="w-3 h-3" />
              <span>4%</span>
            </span>
          </div>
        </div>

        {/* DOCK-TO-DOOR */}
        <div className="bg-canvas border border-borderClean p-5 rounded-card flex flex-col justify-between h-[120px] shadow-sm">
          <span className="font-eyebrow text-[11px] font-bold text-textMuted uppercase tracking-widest leading-none">
            DOCK-TO-DOOR
          </span>
          <div className="flex items-end justify-between">
            <div className="flex items-baseline">
              <span className="font-mono text-3xl font-bold text-brand-brown tracking-tight leading-none tabular-nums">
                38.4
              </span>
              <span className="ml-1 text-xs font-display font-semibold text-textMuted uppercase">m</span>
            </div>
            <span className="bg-surfaceAlt text-textMuted border border-borderClean font-display text-[10px] font-bold px-2 py-0.5 rounded-badge uppercase flex items-center gap-0.5">
              <Minus className="w-3 h-3" />
              <span>0%</span>
            </span>
          </div>
        </div>

        {/* LOST TIME */}
        <div className="bg-canvas border border-borderClean p-5 rounded-card flex flex-col justify-between h-[120px] shadow-sm">
          <span className="font-eyebrow text-[11px] font-bold text-textMuted uppercase tracking-widest leading-none">
            LOST TIME
          </span>
          <div className="flex items-end justify-between">
            <div className="flex items-baseline">
              <span className="font-mono text-3xl font-bold text-brand-brown tracking-tight leading-none tabular-nums">
                18.2
              </span>
              <span className="ml-1 text-xs font-display font-semibold text-textMuted uppercase">hr</span>
            </div>
            <span className="bg-status-risk text-white font-display text-[10px] font-bold px-2 py-0.5 rounded-badge uppercase flex items-center gap-0.5">
              <ArrowUp className="w-3 h-3" />
              <span>2.1%</span>
            </span>
          </div>
        </div>

        {/* COST/PKG */}
        <div className="bg-canvas border border-borderClean p-5 rounded-card flex flex-col justify-between h-[120px] shadow-sm">
          <span className="font-eyebrow text-[11px] font-bold text-textMuted uppercase tracking-widest leading-none">
            COST/PKG
          </span>
          <div className="flex items-end justify-between">
            <div className="flex items-baseline">
              <span className="font-mono text-3xl font-bold text-brand-brown tracking-tight leading-none tabular-nums">
                $0.42
              </span>
            </div>
            <span className="bg-brand-green text-white font-display text-[10px] font-bold px-2 py-0.5 rounded-badge uppercase flex items-center gap-0.5">
              <ArrowDown className="w-3 h-3" />
              <span>0.03</span>
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
              PROCESS THROUGHPUT VS STANDARD
            </h3>
            <div className="flex items-center gap-4 font-display text-[10px] font-bold tracking-wider text-textMuted uppercase">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 bg-brand-brown rounded-sm inline-block"></span>
                <span>ACTUAL (UPH)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 border-t-2 border-dashed border-brand-gold inline-block"></span>
                <span>TARGET (300 UPH)</span>
              </div>
            </div>
          </div>

          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={throughputData} margin={{ top: 10, right: 10, bottom: 5, left: -20 }}>
                <CartesianGrid stroke="#E3DCD6" strokeDasharray="3 3" vertical={false} />
                <XAxis 
                  dataKey="time" 
                  tick={{ fill: '#504441', fontSize: 11, fontFamily: 'IBM Plex Mono, monospace' }}
                  axisLine={false}
                  tickLine={false}
                  dy={8}
                />
                <YAxis 
                  domain={[0, 400]}
                  tick={{ fill: '#504441', fontSize: 11, fontFamily: 'IBM Plex Mono, monospace' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#351C15', color: '#FAF8F6', borderRadius: '6px', border: 'none', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px' }}
                  itemStyle={{ color: '#FFB500' }}
                />
                <Bar dataKey="actual" fill="#351C15" barSize={24} radius={[3, 3, 0, 0]} />
                <ReferenceLine y={300} stroke="#FFB500" strokeWidth={2} strokeDasharray="4 4" />
              </ComposedChart>
            </ResponsiveContainer>
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
              Root-cause attribution for shift downtime and efficiency losses.
            </p>

            <div className="space-y-5">
              {/* Loss 1 */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-brand-brown font-ui">Unplanned Stops</span>
                  <span className="font-mono text-xs font-bold text-status-risk">42%</span>
                </div>
                <div className="h-2.5 w-full bg-surfaceAlt rounded-full overflow-hidden border border-borderClean">
                  <div className="h-full bg-status-risk rounded-full" style={{ width: '42%' }}></div>
                </div>
              </div>

              {/* Loss 2 */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-brand-brown font-ui">Chute Jams</span>
                  <span className="font-mono text-xs font-bold text-brand-gold">35%</span>
                </div>
                <div className="h-2.5 w-full bg-surfaceAlt rounded-full overflow-hidden border border-borderClean">
                  <div className="h-full bg-brand-gold rounded-full" style={{ width: '35%' }}></div>
                </div>
              </div>

              {/* Loss 3 */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-brand-brown font-ui">Staff Starvation</span>
                  <span className="font-mono text-xs font-bold text-brand-brown">23%</span>
                </div>
                <div className="h-2.5 w-full bg-surfaceAlt rounded-full overflow-hidden border border-borderClean">
                  <div className="h-full bg-brand-brown rounded-full" style={{ width: '23%' }}></div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 bg-surfaceAlt rounded-card border border-borderClean text-[11px] text-textMuted font-ui leading-tight mt-4">
            💡 <strong className="text-brand-brown">Recommendation:</strong> Clearing Chute Jam on Secondary Belt B reduces Unplanned Stops loss by 18%.
          </div>
        </div>
      </div>

      {/* Bottom Section - Zone Efficiency Audit Table */}
      <div className="bg-canvas border border-borderClean rounded-card overflow-hidden shadow-sm">
        <div className="p-4 border-b border-borderClean bg-surfaceAlt flex justify-between items-center">
          <h3 className="font-display text-sm font-bold uppercase tracking-wide text-brand-brown">
            ZONE EFFICIENCY AUDIT
          </h3>
          <span className="font-mono text-xs text-textMuted">4 Zones Active</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[750px]">
            <thead>
              <tr className="bg-surface text-textMuted font-display text-[10px] font-bold uppercase tracking-wider border-b border-borderClean">
                <th className="p-3">BELT / ZONE</th>
                <th className="p-3 text-right">STANDARD (UPH)</th>
                <th className="p-3 text-right">ACTUAL (UPH)</th>
                <th className="p-3 text-center">OEI SCORE</th>
                <th className="p-3 text-right">CHUTE JAM %</th>
                <th className="p-3 text-right">RECIRC %</th>
                <th className="p-3 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums text-xs divide-y divide-borderClean">
              {zoneAudit.map((r: any, idx: number) => {
                const isRisk = r.status === 'risk';
                const isWatch = r.status === 'watch';

                return (
                  <tr 
                    key={idx} 
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
                    <td className="p-3 text-right font-bold text-brand-brown">{r.actual}</td>
                    <td className="p-3 text-center">
                      <span className={`inline-flex items-center justify-center font-bold px-2 py-0.5 rounded text-xs text-white min-w-[42px] ${
                        isRisk ? 'bg-status-risk' : isWatch ? 'bg-brand-gold text-brand-brown' : 'bg-brand-green'
                      }`}>
                        .{Math.round(r.oei * 100)}
                      </span>
                    </td>
                    <td className={`p-3 text-right font-bold ${isRisk ? 'text-status-risk' : 'text-textMuted'}`}>
                      {r.jamPct}%
                    </td>
                    <td className="p-3 text-right text-textMuted">{r.recircPct}%</td>
                    <td className="p-3 text-right font-ui">
                      <button 
                        onClick={() => setSelectedZoneModal(r.belt)}
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

      {/* Deep Dive Modal */}
      {selectedZoneModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-canvas border border-borderClean rounded-card max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-borderClean pb-3">
              <h3 className="font-display text-lg font-bold uppercase tracking-wide text-brand-brown">
                Deep Dive: {selectedZoneModal}
              </h3>
              <button onClick={() => setSelectedZoneModal(null)} className="text-textMuted hover:text-brand-brown font-bold text-sm">✕</button>
            </div>
            <div className="space-y-3 text-xs font-ui text-textMuted">
              <p>Telemetry diagnostic trace for <strong className="text-brand-brown">{selectedZoneModal}</strong>.</p>
              <div className="p-3 bg-surfaceAlt border border-borderClean rounded-card space-y-2 font-mono text-[11px]">
                <div className="flex justify-between"><span className="text-textMuted">Sensor Status:</span><span className="text-brand-green font-bold">ONLINE</span></div>
                <div className="flex justify-between"><span className="text-textMuted">Photo Eye Recirc Rate:</span><span className="text-brand-brown font-bold">4.2%</span></div>
                <div className="flex justify-between"><span className="text-textMuted">Chute Blockage Alert:</span><span className="text-status-risk font-bold">2 DETECTED</span></div>
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


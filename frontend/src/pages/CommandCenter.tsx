import React, { useState, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import { ShieldGauge } from '../components/ShieldGauge';
import { KpiCard } from '../components/KpiCard';
import { VolumeBurnDown } from '../components/VolumeBurnDown';
import { ZoneHeatmap } from '../components/ZoneHeatmap';
import { AlertCircle, Clock, TrendingUp, Users, AlertTriangle, ShieldCheck, ArrowUpRight, Wrench, ChevronRight } from 'lucide-react';

const FALLBACK_SUMMARY = {
  oei_score: 0.87,
  utilization_ratio: 0.78,
  staffing_gap: -6,
  process_kpis: [
    { process: 'unload', zone: 'Unload Dock', oei: 0.85, throughput_ratio: 0.94, quality_ratio: 0.98, utilization_ratio: 0.94 },
    { process: 'sort_a', zone: 'Primary Sort A', oei: 0.72, throughput_ratio: 0.80, quality_ratio: 0.95, utilization_ratio: 0.98 },
    { process: 'sort_b', zone: 'Secondary Sort B', oei: 0.89, throughput_ratio: 0.91, quality_ratio: 0.99, utilization_ratio: 0.71 },
    { process: 'pack', zone: 'Outbound Pack', oei: 0.92, throughput_ratio: 0.88, quality_ratio: 0.97, utilization_ratio: 0.48 },
  ]
};

const FALLBACK_CHART = [
  { timestamp: "2026-08-28 06:00", hour: 6, actual: 4200, p10: 3800, p50: 4400, p90: 5100 },
  { timestamp: "2026-08-28 07:00", hour: 7, actual: 8100, p10: 7200, p50: 8000, p90: 8900 },
  { timestamp: "2026-08-28 08:00", hour: 8, actual: 12400, p10: 10500, p50: 11800, p90: 13200 },
  { timestamp: "2026-08-28 09:00", hour: 9, actual: 13800, p10: 12000, p50: 13500, p90: 14800 },
  { timestamp: "2026-08-28 10:00", hour: 10, actual: 14200, p10: 12800, p50: 14000, p90: 15500 },
  { timestamp: "2026-08-28 11:00", hour: 11, actual: null, p10: 11000, p50: 12500, p90: 14000 },
  { timestamp: "2026-08-28 12:00", hour: 12, actual: null, p10: 8500, p50: 9800, p90: 11200 },
  { timestamp: "2026-08-28 13:00", hour: 13, actual: null, p10: 5000, p50: 6200, p90: 7500 },
];

const FALLBACK_HEATMAP = [
  { zone: "Unload Dock", process: "Inbound Unload", utilization: 94, state: "watch", active_workers: 18 },
  { zone: "Primary Sort A", process: "High-Speed Sort", utilization: 98, state: "risk", active_workers: 24 },
  { zone: "Secondary Sort B", process: "Manual Parcel Sort", utilization: 71, state: "ok", active_workers: 14 },
  { zone: "Outbound Pack", process: "Palletization", utilization: 48, state: "idle", active_workers: 10 },
  { zone: "Load Bay 4", process: "Trailer Staging", utilization: 84, state: "ok", active_workers: 12 },
  { zone: "Gate Ramp", process: "Security Scan", utilization: 89, state: "watch", active_workers: 6 },
];

export const CommandCenter: React.FC = () => {
  const { selectedDate, selectedShift, wsData, alerts, setAlerts, setActiveTab } = useApp();
  const [summaryData, setSummaryData] = useState<any>(FALLBACK_SUMMARY);
  const [chartData, setChartData] = useState<any[]>(FALLBACK_CHART);
  const [heatmapData, setHeatmapData] = useState<any[]>(FALLBACK_HEATMAP);
  const [dispatchedAlerts, setDispatchedAlerts] = useState<Record<string, boolean>>({});

  // Fetch summary and chart data with fallback protection
  useEffect(() => {
    const shiftQuery = selectedShift ? `&shift=${selectedShift}` : '';
    
    // Fetch summary
    fetch(`http://localhost:8000/api/dashboard/summary?date=${selectedDate}${shiftQuery}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) setSummaryData(data);
      })
      .catch(() => {});

    // Fetch forecast chart
    fetch(`http://localhost:8000/api/forecast/studio?horizon=1D&process=unload`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.chart_data?.length) setChartData(data.chart_data);
      })
      .catch(() => {});

    // Fetch heatmap
    fetch(`http://localhost:8000/api/dashboard/heatmap?date=${selectedDate}${shiftQuery}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (Array.isArray(data) && data.length) setHeatmapData(data);
      })
      .catch(() => {});

  }, [selectedDate, selectedShift]);

  // Live telemetry overlay values
  const activeUnloadUph = wsData ? wsData.unload_uph : 1240;

  const handleDispatch = (alertId: string, alertType: string) => {
    setDispatchedAlerts(prev => ({ ...prev, [alertId]: true }));
  };

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-borderClean pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-brand-brown m-0">
              COMMAND CENTER
            </h1>
            <span className="font-eyebrow text-[10px] bg-brand-gold/15 text-brand-brown border border-brand-gold/30 px-2 py-0.5 rounded-badge uppercase font-bold tracking-widest">
              UPS GROUND
            </span>
          </div>
          <div className="font-mono text-xs text-textMuted mt-1 tabular-nums">
            Fri 28 Aug · {selectedShift || "Night"} Shift · 06:00–14:00 (EST)
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-brand-green/10 border border-brand-green/30 px-3 py-1.5 rounded-badge">
            <span className="w-2.5 h-2.5 rounded-full bg-brand-green animate-pulse"></span>
            <span className="font-eyebrow text-xs text-brand-green uppercase font-bold tracking-widest">
              System Nominal
            </span>
          </div>
          <button 
            onClick={() => setActiveTab('health')}
            className="text-xs font-display font-semibold uppercase tracking-wider text-brand-brown bg-canvas border border-borderClean px-3 py-1.5 rounded-btn hover:bg-surfaceAlt transition-all"
          >
            Telemetry Logs
          </button>
        </div>
      </header>

      {/* Row 1 (4 cols | 8 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Shield Gauge (4 cols) */}
        <div className="lg:col-span-4">
          <ShieldGauge score={summaryData.oei_score} delta={0.04} />
        </div>

        {/* Hourly Volume Ingestion Chart (8 cols) */}
        <div className="lg:col-span-8">
          <VolumeBurnDown data={chartData} title="HOURLY VOLUME INGESTION (ACTUAL VS P10-P90 FORECAST)" />
        </div>
      </div>

      {/* Row 2 (4 KPI Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard 
          label="AGGREGATE THROUGHPUT" 
          value={activeUnloadUph} 
          unit="pk/hr" 
          delta={3.2} 
        />
        <KpiCard 
          label="DOCK-TO-DOOR CYCLE" 
          value="42" 
          unit="min" 
          delta={-5.0} 
        />
        <KpiCard 
          label="PRIMARY BELT UTILIZATION" 
          value={`${Math.round(summaryData.utilization_ratio * 100)}%`} 
          unit="prod" 
          delta={2.0} 
        />
        <KpiCard 
          label="SHIFT HEADCOUNT GAP" 
          value={summaryData.staffing_gap} 
          unit="short" 
          statusText={summaryData.staffing_gap < 0 ? "CRITICAL RISK" : "ON TARGET"}
          statusColor={summaryData.staffing_gap < 0 ? "risk" : "ok"}
        />
      </div>

      {/* Row 3 (7 cols | 5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Zone Bottleneck Heatmap (7 cols) */}
        <div className="lg:col-span-7">
          <ZoneHeatmap data={heatmapData} />
        </div>

        {/* Live Operational Alerts (5 cols) */}
        <div className="lg:col-span-5 bg-canvas border border-borderClean rounded-card p-0 flex flex-col justify-between overflow-hidden min-h-[320px]">
          <div>
            <div className="p-4 border-b border-borderClean bg-surfaceAlt flex justify-between items-center">
              <span className="font-eyebrow text-xs uppercase tracking-widest font-bold text-brand-brown">
                LIVE OPERATIONAL ALERTS
              </span>
              <span className="bg-brand-brown text-brand-gold text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
                {alerts.length} Active
              </span>
            </div>

            <div className="divide-y divide-borderClean max-h-[260px] overflow-y-auto">
              {alerts.length === 0 ? (
                <p className="text-xs text-textMuted italic p-4">No active operational alerts.</p>
              ) : (
                alerts.map((a: any) => {
                  const isDispatched = dispatchedAlerts[a.alert_id];
                  return (
                    <div 
                      key={a.alert_id} 
                      className={`p-4 transition-colors flex flex-col gap-2 ${
                        a.severity === 'risk' 
                          ? 'bg-status-risk/5 hover:bg-status-risk/10' 
                          : 'bg-brand-gold/5 hover:bg-brand-gold/10'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className={`w-4 h-4 shrink-0 ${
                            a.severity === 'risk' ? 'text-status-risk' : 'text-brand-gold600'
                          }`} />
                          <span className="font-display text-xs font-bold text-brand-brown uppercase">
                            {a.alert_type}
                          </span>
                        </div>
                        <span className="font-mono text-[10px] text-textMuted">
                          {a.timestamp.includes(' ') ? a.timestamp.split(' ')[1] : a.timestamp}
                        </span>
                      </div>

                      <p className="text-xs text-textMuted font-ui leading-normal">
                        {a.message}
                      </p>

                      <div className="flex justify-between items-center pt-1">
                        <span className="text-[10px] font-mono text-textMuted uppercase">
                          Zone: {a.zone}
                        </span>
                        
                        <button 
                          onClick={() => handleDispatch(a.alert_id, a.alert_type)}
                          disabled={isDispatched}
                          className={`font-display text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-btn transition-all ${
                            isDispatched
                              ? 'bg-brand-green/20 text-brand-green border border-brand-green/40 cursor-default'
                              : a.severity === 'risk'
                                ? 'bg-brand-brown text-textInverse hover:bg-brand-brown700'
                                : 'bg-canvas border border-borderClean text-brand-brown hover:bg-surfaceAlt'
                          }`}
                        >
                          {isDispatched ? 'Dispatched ✓' : 'Dispatch'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="p-3 border-t border-borderClean bg-surfaceAlt flex justify-between items-center text-xs">
            <button 
              onClick={() => setActiveTab('alerts')}
              className="w-full text-center font-display text-[11px] font-bold uppercase tracking-widest text-brand-brown hover:text-brand-gold600 transition-colors flex items-center justify-center gap-1 py-1"
            >
              <span>View Full Audit Log & Copilot</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


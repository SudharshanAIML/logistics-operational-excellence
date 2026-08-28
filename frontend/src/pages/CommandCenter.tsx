import React, { useState, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import { ShieldGauge } from '../components/ShieldGauge';
import { KpiCard } from '../components/KpiCard';
import { VolumeBurnDown } from '../components/VolumeBurnDown';
import { ZoneHeatmap } from '../components/ZoneHeatmap';
import { AlertCircle, Clock, TrendingUp, Users, AlertTriangle, ShieldCheck, ArrowUpRight, Wrench, ChevronRight } from 'lucide-react';
import { API_BASE_URL } from '../config';

export const CommandCenter: React.FC = () => {
  const { selectedDate, selectedShift, wsData, alerts, setAlerts, setActiveTab } = useApp();
  const [summaryData, setSummaryData] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [heatmapData, setHeatmapData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dispatchedAlerts, setDispatchedAlerts] = useState<Record<string, boolean>>({});

  // Fetch real summary, forecast chart, and heatmap data - no fallback constants
  useEffect(() => {
    setLoading(true);
    setError(null);
    const shiftQuery = selectedShift ? `&shift=${selectedShift}` : '';

    Promise.all([
      fetch(`${API_BASE_URL}/api/dashboard/summary?date=${selectedDate}${shiftQuery}`)
        .then(res => res.ok ? res.json() : Promise.reject(new Error(`summary: HTTP ${res.status}`))),
      fetch(`${API_BASE_URL}/api/forecast/studio?horizon=1D&process=unload`)
        .then(res => res.ok ? res.json() : Promise.reject(new Error(`forecast: HTTP ${res.status}`))),
      fetch(`${API_BASE_URL}/api/dashboard/heatmap?date=${selectedDate}${shiftQuery}`)
        .then(res => res.ok ? res.json() : Promise.reject(new Error(`heatmap: HTTP ${res.status}`))),
    ])
      .then(([summary, forecast, heatmap]) => {
        setSummaryData(summary);
        setChartData(forecast?.chart_data ?? []);
        setHeatmapData(Array.isArray(heatmap) ? heatmap : []);
      })
      .catch(err => {
        console.error("Error loading Command Center data:", err);
        setError("Could not reach the Synapse Ops API. Confirm the backend is running.");
      })
      .finally(() => setLoading(false));
  }, [selectedDate, selectedShift]);

  // Live telemetry overlay - real recent UPH from the backend WebSocket, no synthetic fallback number
  const activeUnloadUph = wsData ? wsData.unload_uph : null;

  const handleDispatch = (alertId: string, alertType: string) => {
    setDispatchedAlerts(prev => ({ ...prev, [alertId]: true }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[500px] text-textMuted font-display uppercase tracking-widest text-xs">
        Assembling Command Center Telemetry...
      </div>
    );
  }

  if (error || !summaryData) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] gap-3 text-center">
        <AlertTriangle className="w-8 h-8 text-status-risk" />
        <p className="text-sm text-brand-brown font-ui font-semibold">{error || "No data available."}</p>
      </div>
    );
  }

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
          <ShieldGauge score={summaryData.oei_score} delta={summaryData.oei_delta_vs_last_week} />
        </div>

        {/* Hourly Volume Ingestion Chart (8 cols) */}
        <div className="lg:col-span-8">
          <VolumeBurnDown data={chartData} title="HOURLY VOLUME INGESTION (ACTUAL VS P10-P90 FORECAST)" />
        </div>
      </div>

      {/* Row 2 (4 KPI Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard
          label="UNLOAD THROUGHPUT (LIVE)"
          value={activeUnloadUph !== null ? activeUnloadUph : '—'}
          unit="pk/hr"
        />
        <KpiCard
          label="DOCK-TO-DOOR CYCLE"
          value={summaryData.avg_cycle_time_min}
          unit="min"
        />
        <KpiCard
          label="PRIMARY BELT UTILIZATION"
          value={`${Math.round(summaryData.utilization_ratio * 100)}%`}
          unit="prod"
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


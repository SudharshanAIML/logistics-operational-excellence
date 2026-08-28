import React, { useState, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import { ShieldGauge } from '../components/ShieldGauge';
import { KpiCard } from '../components/KpiCard';
import { VolumeBurnDown } from '../components/VolumeBurnDown';
import { ZoneHeatmap } from '../components/ZoneHeatmap';
import { AlertCircle, Clock, TrendingUp, Users } from 'lucide-react';

export const CommandCenter: React.FC = () => {
  const { selectedDate, selectedShift, wsData, alerts } = useApp();
  const [summaryData, setSummaryData] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [heatmapData, setHeatmapData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch summary and chart data
  useEffect(() => {
    setLoading(true);
    const shiftQuery = selectedShift ? `&shift=${selectedShift}` : '';
    
    // Fetch summary
    fetch(`http://localhost:8000/api/dashboard/summary?date=${selectedDate}${shiftQuery}`)
      .then(res => res.json())
      .then(data => {
        setSummaryData(data);
      })
      .catch(err => console.error("Error fetching summary:", err));

    // Fetch forecast chart (unload process default for CC)
    fetch(`http://localhost:8000/api/forecast/studio?horizon=1D&process=unload`)
      .then(res => res.json())
      .then(data => {
        setChartData(data.chart_data || []);
      })
      .catch(err => console.error("Error fetching forecast:", err));

    // Fetch heatmap
    fetch(`http://localhost:8000/api/dashboard/heatmap?date=${selectedDate}${shiftQuery}`)
      .then(res => res.json())
      .then(data => {
        setHeatmapData(data || []);
      })
      .catch(err => console.error("Error fetching heatmap:", err))
      .finally(() => setLoading(false));

  }, [selectedDate, selectedShift]);

  if (loading || !summaryData) {
    return (
      <div className="flex items-center justify-center h-[500px] text-textMuted font-display uppercase tracking-widest text-xs">
        Syncing Hub Telemetry...
      </div>
    );
  }

  // Live telemetry overlay values
  const activeUnloadUph = wsData ? wsData.unload_uph : 138.5;
  const activeSortUph = wsData ? wsData.sort_uph : 322.0;
  
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-baseline border-b border-borderClean pb-4">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-wide text-brand-brown">Command Center</h2>
          <p className="text-xs text-textMuted">Operational intelligence landing console for UPS Ground Hub services.</p>
        </div>
        <div className="font-mono text-xs text-textMuted bg-surfaceAlt px-3 py-1.5 rounded-badge border border-borderClean">
          {selectedDate} · {selectedShift || "All Shifts"} · 06:00–14:00 (EST)
        </div>
      </div>

      {/* Top Section - Shield & Volume Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4">
          <ShieldGauge score={summaryData.oei_score} delta={0.04} />
        </div>
        <div className="lg:col-span-8">
          <VolumeBurnDown data={chartData} />
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard 
          label="Throughput" 
          value={activeUnloadUph} 
          unit="UPH" 
          delta={3.2} 
        />
        <KpiCard 
          label="Cycle Time" 
          value="42" 
          unit="MIN" 
          delta={-5.0} 
        />
        <KpiCard 
          label="Utilization" 
          value={`${summaryData.utilization_ratio * 100}%`} 
          unit="PROD" 
          delta={2.0} 
        />
        <KpiCard 
          label="Staffing Gap" 
          value={summaryData.staffing_gap} 
          unit="HEADCOUNT" 
          statusText={summaryData.staffing_gap < 0 ? "UNDERSTAFFED" : "ON TARGET"}
          statusColor={summaryData.staffing_gap < 0 ? "risk" : "ok"}
        />
      </div>

      {/* Heatmap & Alerts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <ZoneHeatmap data={heatmapData} />
        </div>
        
        {/* Alerts panel */}
        <div className="lg:col-span-4 bg-canvas border border-borderClean rounded-card p-5 flex flex-col justify-between min-h-[300px]">
          <div>
            <h3 className="font-display text-[15px] tracking-wide text-brand-brown mb-3">Active Alerts</h3>
            <div className="space-y-3.5 max-h-[220px] overflow-y-auto pr-1">
              {alerts.length === 0 ? (
                <p className="text-xs text-textMuted italic py-4">No active anomalies or alerts logged.</p>
              ) : (
                alerts.map((a: any) => (
                  <div key={a.alert_id} className={`flex items-start gap-3 p-3 border rounded-card ${
                    a.severity === 'risk' 
                      ? 'bg-status-risk/5 border-status-risk/30 text-status-risk' 
                      : 'bg-brand-gold/5 border-brand-gold/30 text-brand-brown'
                  }`}>
                    <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                    <div>
                      <div className="font-display text-xs font-bold uppercase tracking-wider flex items-center justify-between">
                        <span>{a.alert_type} ({a.process})</span>
                        <span className="font-mono text-[9px] opacity-75">{a.timestamp.split(' ')[1]}</span>
                      </div>
                      <p className="text-xs font-ui mt-1 text-textMain">{a.message}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          
          <button 
            onClick={() => {}} 
            className="w-full text-center font-display text-[11px] font-bold uppercase tracking-widest text-brand-brown bg-surfaceAlt border border-borderClean rounded-btn py-2 hover:bg-brand-brown hover:text-textInverse transition-all mt-4"
          >
            Review Audit Log
          </button>
        </div>
      </div>
    </div>
  );
};

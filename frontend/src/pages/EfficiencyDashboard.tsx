import React, { useState, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { TrendingUp, BarChart3, Clock, Milestone } from 'lucide-react';

export const EfficiencyDashboard: React.FC = () => {
  const { selectedDate, selectedShift } = useApp();
  const [trends, setTrends] = useState<any[]>([]);
  const [waterfall, setWaterfall] = useState<any[]>([]);
  const [kpis, setKpis] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch KPI/OEI rollups
  useEffect(() => {
    setLoading(true);
    
    // Fetch trends (last 7 days)
    fetch(`http://localhost:8000/api/dashboard/trends?start_date=2026-08-20&end_date=2026-08-28`)
      .then(res => res.json())
      .then(data => {
        setTrends(data || []);
      })
      .catch(err => console.error("Error fetching OEI trends:", err));

    // Fetch waterfall
    const shiftQuery = selectedShift ? `?shift=${selectedShift}` : '';
    fetch(`http://localhost:8000/api/dashboard/waterfall${shiftQuery}`)
      .then(res => res.json())
      .then(data => {
        setWaterfall(data || []);
      })
      .catch(err => console.error("Error fetching waterfall:", err));

    // Fetch process list details from summary
    fetch(`http://localhost:8000/api/dashboard/summary?date=${selectedDate}${shiftQuery ? '&' + shiftQuery.slice(1) : ''}`)
      .then(res => res.json())
      .then(data => {
        setKpis(data.process_kpis || []);
      })
      .catch(err => console.error("Error fetching summary KPIs:", err))
      .finally(() => setLoading(false));

  }, [selectedDate, selectedShift]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[500px] text-textMuted font-display uppercase tracking-widest text-xs">
        Compiling Ops Efficiency Index...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-baseline border-b border-borderClean pb-4">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-wide text-brand-brown">Efficiency Dashboard</h2>
          <p className="text-xs text-textMuted font-ui">
            Detailed performance tracking and benchmark metrics for overall Ops Efficiency Index (OEI).
          </p>
        </div>
        <div className="font-mono text-xs text-textMuted bg-surfaceAlt px-3 py-1.5 rounded-badge border border-borderClean">
          Active Shift: {selectedShift || "All Shifts"}
        </div>
      </div>

      {/* Row 1 - OEI Trend Chart & Cycle Waterfall */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Trend line chart */}
        <div className="lg:col-span-7 bg-canvas border border-borderClean rounded-card p-5 h-[340px] flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-display text-[15px] tracking-wide text-brand-brown">OEI Trend: Rolling 7-Day</h3>
            <div className="flex items-center gap-1.5 text-[10px] font-display font-semibold tracking-wider text-textMuted">
              <span className="w-2.5 h-0.5 bg-brand-brown inline-block"></span>
              <span>OEI SCORE</span>
              <span className="w-2.5 h-0.5 bg-brand-green inline-block"></span>
              <span>TARGET (0.87)</span>
            </div>
          </div>
          
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trends} margin={{ top: 5, right: 5, bottom: 5, left: -25 }}>
                <CartesianGrid stroke="#E3DCD6" strokeDasharray="3 3" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(d) => d.slice(5)} // MM-DD
                  tick={{ fill: '#6B5D55', fontSize: 10, fontFamily: 'Barlow, sans-serif' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  domain={[0.5, 1.0]} 
                  tick={{ fill: '#6B5D55', fontSize: 10, fontFamily: 'IBM Plex Mono, monospace' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip />
                <Line type="monotone" dataKey="oei" stroke="#351C15" strokeWidth={2.5} dot={{ r: 3, fill: '#351C15' }} />
                <Line type="monotone" dataKey="target" stroke="#64A70B" strokeDasharray="5 5" strokeWidth={1.5} dot={false} defaultValue={0.87} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cycle time waterfall */}
        <div className="lg:col-span-5 bg-canvas border border-borderClean rounded-card p-5 h-[340px] flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-display text-[15px] tracking-wide text-brand-brown">Cycle Time Waterfall (Flow Path)</h3>
            <Clock className="w-4 h-4 text-brand-brown" />
          </div>
          
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={waterfall} layout="vertical" margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
                <CartesianGrid stroke="#E3DCD6" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#6B5D55', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="label" type="category" tick={{ fill: '#6B5D55', fontSize: 10, fontFamily: 'Barlow Condensed' }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="cycle_time" fill="#FFB500" radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2 - Process KPI Grid */}
      <div className="space-y-4">
        <h3 className="font-display text-[15px] tracking-wide text-brand-brown">Process node OEI decomposition</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {kpis.map((kpi: any, idx) => (
            <div key={idx} className="bg-canvas border border-borderClean rounded-card p-5 space-y-4">
              {/* Header */}
              <div className="flex justify-between items-start border-b border-borderClean pb-2">
                <span className="font-display text-sm font-bold text-brand-brown uppercase">{kpi.process}</span>
                <span className="font-mono text-xs text-textMuted bg-surfaceAlt px-2 py-0.5 rounded-badge uppercase">{kpi.zone}</span>
              </div>
              
              {/* OEI Score */}
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-textMuted font-ui">OEI Score</span>
                <span className="font-mono text-2xl font-bold text-brand-brown">{kpi.oei !== null ? kpi.oei.toFixed(2) : 'REDACTED'}</span>
              </div>
              
              {/* Ratios */}
              <div className="grid grid-cols-3 gap-2 pt-2 text-center text-[10px] font-display font-semibold text-textMuted uppercase tracking-wider">
                <div className="bg-surfaceAlt p-2 rounded-badge">
                  <p className="opacity-75">Throughput</p>
                  <p className="font-mono text-xs font-bold text-brand-brown mt-1">
                    {kpi.throughput_ratio !== null ? `${(kpi.throughput_ratio * 100).toFixed(0)}%` : 'REDACT'}
                  </p>
                </div>
                <div className="bg-surfaceAlt p-2 rounded-badge">
                  <p className="opacity-75">Quality</p>
                  <p className="font-mono text-xs font-bold text-brand-brown mt-1">
                    {kpi.quality_ratio !== null ? `${(kpi.quality_ratio * 100).toFixed(0)}%` : 'REDACT'}
                  </p>
                </div>
                <div className="bg-surfaceAlt p-2 rounded-badge">
                  <p className="opacity-75">Utilization</p>
                  <p className="font-mono text-xs font-bold text-brand-brown mt-1">
                    {kpi.utilization_ratio !== null ? `${(kpi.utilization_ratio * 100).toFixed(0)}%` : 'REDACT'}
                  </p>
                </div>
              </div>
              
              {/* Aggregation Floor Warning */}
              {kpi.privacy_redacted && (
                <p className="text-[10px] text-status-risk/80 font-ui leading-tight pt-1">
                  ⚠ {kpi.privacy_message}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

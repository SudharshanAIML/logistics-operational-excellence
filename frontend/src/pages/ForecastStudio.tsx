import React, { useState, useEffect } from 'react';
import { VolumeBurnDown } from '../components/VolumeBurnDown';
import { BarChart3, HelpCircle, Activity } from 'lucide-react';

export const ForecastStudio: React.FC = () => {
  const [horizon, setHorizon] = useState<string>('1D');
  const [process, setProcess] = useState<string>('unload');
  const [chartData, setChartData] = useState<any[]>([]);
  const [accuracy, setAccuracy] = useState<any>(null);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch forecast data and drivers
  useEffect(() => {
    setLoading(true);
    fetch(`http://localhost:8000/api/forecast/studio?horizon=${horizon}&process=${process}`)
      .then(res => res.json())
      .then(data => {
        setChartData(data.chart_data || []);
        setAccuracy(data.accuracy);
      })
      .catch(err => console.error("Error fetching forecast:", err));

    fetch(`http://localhost:8000/api/forecast/drivers`)
      .then(res => res.json())
      .then(data => {
        setDrivers(data || []);
      })
      .catch(err => console.error("Error fetching drivers:", err))
      .finally(() => setLoading(false));

  }, [horizon, process]);

  // Retrain Trigger
  const handleRetrain = () => {
    alert("LightGBM Model Retraining initiated via Background Worker...");
    fetch(`http://localhost:8000/api/forecast/train?process=${process}`, { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        alert(`Retraining complete! WAPE: ${data.wape}%, Baseline: ${data.baseline_wape}%`);
      })
      .catch(err => console.error("Error retraining model:", err));
  };

  if (loading || !accuracy) {
    return (
      <div className="flex items-center justify-center h-[500px] text-textMuted font-display uppercase tracking-widest text-xs">
        Compiling Forecast Models...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header with Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-borderClean pb-4">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-wide text-brand-brown">Forecast Studio</h2>
          <p className="text-xs text-textMuted font-ui">Time-series forecasting controls. Configured using LightGBM quantile regression.</p>
        </div>
        
        {/* Controls Block */}
        <div className="flex flex-wrap items-center gap-3.5">
          {/* Horizon Selection */}
          <div className="flex bg-surfaceAlt border border-borderClean p-1 rounded-badge">
            {['4H', '1D', '1W', '1M'].map((h) => (
              <button
                key={h}
                onClick={() => setHorizon(h)}
                className={`px-3 py-1 font-display text-[11px] font-bold rounded-badge uppercase tracking-wider transition-all ${
                  horizon === h 
                    ? 'bg-brand-gold text-brand-brown' 
                    : 'text-textMuted hover:text-brand-brown'
                }`}
              >
                {h}
              </button>
            ))}
          </div>

          {/* Process Stream Select */}
          <select
            value={process}
            onChange={(e) => setProcess(e.target.value)}
            className="bg-canvas border border-borderClean font-display text-[11px] font-bold uppercase tracking-wider text-brand-brown px-3 py-1.5 rounded-btn outline-none cursor-pointer focus:border-brand-gold"
          >
            <option value="unload">Inbound Unload</option>
            <option value="sort">Conveyor Sort</option>
            <option value="stow">Zone Stow</option>
            <option value="pick">Pick Station</option>
            <option value="pack">Pack Station</option>
            <option value="load">Outbound Load</option>
          </select>
        </div>
      </div>

      {/* Main Grid - Chart & Model Accuracy */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <VolumeBurnDown data={chartData} title={`Forecast Horizon: ${horizon} - ${process.toUpperCase()}`} />
        </div>
        
        {/* Model Accuracy Summary Card */}
        <div className="lg:col-span-4 bg-canvas border border-borderClean rounded-card p-5 flex flex-col justify-between min-h-[360px]">
          <div>
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-display text-[15px] tracking-wide text-brand-brown">Model Performance</h3>
              <Activity className="w-5 h-5 text-brand-brown" />
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-baseline border-b border-borderClean pb-2">
                <span className="text-xs text-textMuted font-ui">LightGBM WAPE</span>
                <span className="font-mono text-2xl font-bold text-brand-brown">{accuracy.lgbm_wape}%</span>
              </div>
              <div className="flex justify-between items-baseline border-b border-borderClean pb-2">
                <span className="text-xs text-textMuted font-ui">Naive Baseline WAPE</span>
                <span className="font-mono text-base font-semibold text-textMuted">{accuracy.naive_wape}%</span>
              </div>
              
              <div className="bg-brand-green/10 border border-brand-green/20 rounded-card p-4 text-center">
                <span className="font-display text-[10px] font-bold tracking-widest text-brand-green uppercase">
                  Prediction Improvement
                </span>
                <p className="font-mono text-2xl font-bold text-brand-green mt-1">
                  {accuracy.improvement_pct}% Better
                </p>
                <p className="text-[10px] text-brand-green/80 mt-0.5">
                  Compared to historical seasonal naive baseline.
                </p>
              </div>
            </div>
          </div>
          
          <button 
            onClick={handleRetrain}
            className="w-full font-display text-[11px] font-bold uppercase tracking-widest text-textInverse bg-brand-brown hover:bg-brand-brown700 rounded-btn py-2.5 transition-all"
          >
            Retrain Model
          </button>
        </div>
      </div>

      {/* Section 2 - SHAP Explanation & Data breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* SHAP Explanation Board */}
        <div className="lg:col-span-5 bg-canvas border border-borderClean rounded-card p-5 flex flex-col justify-between">
          <div>
            <h3 className="font-display text-[15px] tracking-wide text-brand-brown mb-1">Explainable Forecast (SHAP Drivers)</h3>
            <p className="text-[11px] text-textMuted font-ui mb-4">
              Relative impact weights explaining why predictions deviate from naive historical averages.
            </p>
            
            <div className="space-y-4">
              {drivers.map((d: any, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-brand-brown font-ui">{d.driver}</span>
                    <span className={`font-mono text-[11px] ${
                      d.direction === 'positive' 
                        ? 'text-brand-green' 
                        : d.direction === 'negative' 
                          ? 'text-status-risk' 
                          : 'text-textMuted'
                    }`}>
                      {d.direction === 'positive' ? '+' : ''}{d.impact}%
                    </span>
                  </div>
                  
                  {/* Bar indicator */}
                  <div className="w-full h-2 bg-surfaceAlt rounded-full overflow-hidden">
                    <div 
                      style={{ width: `${Math.min(100, Math.abs(d.impact))}%` }} 
                      className={`h-full rounded-full ${
                        d.direction === 'positive' 
                          ? 'bg-brand-green' 
                          : d.direction === 'negative' 
                            ? 'bg-status-risk' 
                            : 'bg-status-idle'
                      }`}
                    ></div>
                  </div>
                  <p className="text-[10px] text-textMuted leading-tight">{d.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Hourly Breakdown Table */}
        <div className="lg:col-span-7 bg-canvas border border-borderClean rounded-card p-5">
          <h3 className="font-display text-[15px] tracking-wide text-brand-brown mb-1">Hourly Breakdown Table</h3>
          <p className="text-[11px] text-textMuted font-ui mb-4">
            Quantile prediction intervals for active staffing plan. All volumes are right-aligned.
          </p>
          
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-surfaceAlt text-textMuted uppercase font-display text-[10px] font-bold tracking-wider border-b border-borderClean">
                  <th className="py-2.5 px-3">Hour</th>
                  <th className="py-2.5 px-3 text-right">P10 (Low)</th>
                  <th className="py-2.5 px-3 text-right">P50 (Expected)</th>
                  <th className="py-2.5 px-3 text-right">P90 (High)</th>
                  <th className="py-2.5 px-3 text-right">Actual</th>
                  <th className="py-2.5 px-3 text-right">Var</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderClean font-mono tabular-nums">
                {chartData.slice(0, 10).map((r, idx) => {
                  const variance = r.actual !== null ? r.actual - r.p50 : 0;
                  const varPct = r.actual !== null && r.p50 > 0 ? (variance / r.p50) * 100 : 0;
                  
                  return (
                    <tr key={idx} className="hover:bg-surface">
                      <td className="py-2 px-3 font-ui font-semibold text-brand-brown">{r.timestamp.split(' ')[1]}</td>
                      <td className="py-2 px-3 text-right text-textMuted">{r.p10}</td>
                      <td className="py-2 px-3 text-right font-bold text-brand-brown">{r.p50}</td>
                      <td className="py-2 px-3 text-right text-textMuted">{r.p90}</td>
                      <td className="py-2 px-3 text-right text-brand-gold font-bold">{r.actual !== null ? r.actual : '—'}</td>
                      <td className={`py-2 px-3 text-right font-bold ${
                        variance > 0 
                          ? 'text-brand-green' 
                          : variance < 0 
                            ? 'text-status-risk' 
                            : 'text-textMuted'
                      }`}>
                        {r.actual !== null ? `${variance > 0 ? '+' : ''}${variance} (${varPct.toFixed(1)}%)` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

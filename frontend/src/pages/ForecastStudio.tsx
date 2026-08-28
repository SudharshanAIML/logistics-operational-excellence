import React, { useState, useEffect } from 'react';
import { VolumeBurnDown } from '../components/VolumeBurnDown';
import { Download, Activity, HelpCircle, Sliders, ArrowUpRight, ChevronDown, RefreshCw, Zap, AlertTriangle } from 'lucide-react';
import { API_BASE_URL } from '../config';

export const ForecastStudio: React.FC = () => {
  const [horizon, setHorizon] = useState<string>('1D');
  const [process, setProcess] = useState<string>('unload');
  const [chartData, setChartData] = useState<any[]>([]);
  const [accuracy, setAccuracy] = useState<any>(null);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retraining, setRetraining] = useState(false);

  // Fetch real forecast data and real SHAP drivers - no fallback constants
  useEffect(() => {
    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`${API_BASE_URL}/api/forecast/studio?horizon=${horizon}&process=${process}`)
        .then(res => res.ok ? res.json() : Promise.reject(new Error(`studio: HTTP ${res.status}`))),
      fetch(`${API_BASE_URL}/api/forecast/drivers?process=${process}`)
        .then(res => res.ok ? res.json() : Promise.reject(new Error(`drivers: HTTP ${res.status}`))),
    ])
      .then(([studio, driverList]) => {
        setChartData(studio?.chart_data ?? []);
        setAccuracy(studio?.accuracy ?? null);
        setDrivers(Array.isArray(driverList) ? driverList : []);
      })
      .catch(err => {
        console.error("Error loading Forecast Studio data:", err);
        setError("Could not reach the Synapse Ops API. Confirm the backend is running.");
      })
      .finally(() => setLoading(false));
  }, [horizon, process]);

  // Retrain Trigger
  const handleRetrain = () => {
    setRetraining(true);
    fetch(`${API_BASE_URL}/api/forecast/train?process=${process}`, { method: 'POST' })
      .then(res => res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`)))
      .then(data => {
        alert(`LightGBM Retraining Complete! WAPE: ${data.wape}%, Baseline: ${data.baseline_wape}%`);
      })
      .catch(err => alert(`Retraining failed: ${err.message}`))
      .finally(() => setRetraining(false));
  };

  // Export CSV handler
  const handleExportCSV = () => {
    const csvRows = [
      ["Hour", "P10", "P50_Model", "P90", "Actual", "Variance", "Status"],
      ...chartData.map(r => {
        const v = r.actual !== null ? r.actual - r.p50 : 0;
        return [
          r.timestamp.split(' ')[1] || r.timestamp,
          r.p10,
          r.p50,
          r.p90,
          r.actual !== null ? r.actual : "",
          v,
          r.status || (r.actual !== null ? "NOMINAL" : "PENDING")
        ];
      })
    ];
    const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `forecast_matrix_${process}_${horizon}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[500px] text-textMuted font-display uppercase tracking-widest text-xs">
        Assembling Forecast Matrix...
      </div>
    );
  }

  if (error || !accuracy) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] gap-3 text-center">
        <AlertTriangle className="w-8 h-8 text-status-risk" />
        <p className="text-sm text-brand-brown font-ui font-semibold">{error || "No forecast data available."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header with Controls */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-borderClean pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-brand-brown leading-none">
            FORECAST MATRIX
          </h1>
          <p className="font-ui text-xs text-textMuted mt-1">
            Ingestion Dynamics & Quantile Time-Series Prediction (LightGBM Regression)
          </p>
        </div>

        {/* Controls Block */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Horizon Selection */}
          <div className="flex bg-canvas border border-borderClean p-0.5 rounded-btn shadow-sm">
            {['4H', '1D', '1W', '1M'].map((h) => (
              <button
                key={h}
                onClick={() => setHorizon(h)}
                className={`px-3 py-1 font-display text-[11px] font-bold rounded-badge uppercase tracking-wider transition-all ${
                  horizon === h 
                    ? 'bg-brand-brown text-brand-gold shadow-sm' 
                    : 'text-textMuted hover:text-brand-brown hover:bg-surfaceAlt'
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
            className="bg-canvas border border-borderClean font-display text-xs font-bold uppercase tracking-wider text-brand-brown px-3 py-1.5 rounded-btn outline-none cursor-pointer focus:border-brand-gold shadow-sm"
          >
            <option value="unload">Feed: Inbound Unload</option>
            <option value="sort">Feed: Conveyor Sort</option>
            <option value="stow">Feed: Zone Stow</option>
            <option value="pick">Feed: Pick Station</option>
            <option value="pack">Feed: Pack Station</option>
            <option value="load">Feed: Outbound Load</option>
          </select>
        </div>
      </div>

      {/* Main Grid - Fan Chart & Model Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Forecast Fan Chart (8 cols) */}
        <div className="lg:col-span-8">
          <VolumeBurnDown 
            data={chartData} 
            title={`FORECAST FAN CHART & CONFIDENCE SPREAD (${process.toUpperCase()} · ${horizon})`} 
          />
        </div>

        {/* Model Accuracy & Telemetry Cards (4 cols) */}
        <div className="lg:col-span-4 flex flex-col justify-between gap-6">
          {/* Accuracy Card */}
          <div className="bg-canvas border border-borderClean rounded-card p-5 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start border-b border-borderClean pb-3 mb-4">
                <div>
                  <span className="font-eyebrow text-xs uppercase font-bold text-brand-brown tracking-widest block">
                    MODEL TELEMETRY
                  </span>
                  <span className="text-[10px] text-textMuted font-mono uppercase">LightGBM Quantile Regressor</span>
                </div>
                <Activity className="w-5 h-5 text-brand-brown" />
              </div>

              <div className="space-y-4">
                <div>
                  <p className="font-display text-[11px] font-semibold text-textMuted uppercase tracking-wider mb-1">
                    CURRENT MAPE / WAPE (LIGHTGBM)
                  </p>
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-3xl font-bold text-brand-brown tabular-nums">
                      {accuracy.lgbm_wape}%
                    </span>
                    <span className={`font-display text-[11px] font-bold px-2 py-0.5 rounded-badge uppercase tracking-wider border ${
                      accuracy.improvement_pct >= 0
                        ? 'bg-brand-green/15 text-brand-green border-brand-green/30'
                        : 'bg-status-risk/15 text-status-risk border-status-risk/30'
                    }`}>
                      {accuracy.improvement_pct >= 0 ? '+' : ''}{accuracy.improvement_pct}% {accuracy.improvement_pct >= 0 ? 'LIFT' : 'WORSE'}
                    </span>
                  </div>
                </div>

                <div className="border-t border-borderClean pt-3">
                  <p className="font-display text-[11px] font-semibold text-textMuted uppercase tracking-wider mb-1">
                    BASELINE (HISTORICAL NAIVE)
                  </p>
                  <span className="font-mono text-lg text-textMuted line-through tabular-nums">
                    {accuracy.naive_wape}%
                  </span>
                </div>
              </div>
            </div>

            <button 
              onClick={handleRetrain}
              disabled={retraining}
              className={`w-full font-display text-xs font-bold uppercase tracking-widest text-textInverse bg-brand-brown hover:bg-brand-brown700 rounded-btn py-2.5 transition-all mt-4 flex items-center justify-center gap-2 ${
                retraining ? 'opacity-75 cursor-not-allowed' : ''
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${retraining ? 'animate-spin' : ''}`} />
              <span>{retraining ? 'RETRAINING MODEL...' : 'RETRAIN FORECAST MODEL'}</span>
            </button>
          </div>

          {/* Prediction Bias Meter Card */}
          <div className="bg-canvas border border-borderClean rounded-card p-4">
            <div className="flex justify-between items-end mb-2">
              <span className="font-eyebrow text-xs uppercase font-bold text-brand-brown tracking-widest">
                PREDICTION BIAS METER
              </span>
              <span className="font-mono text-xs font-bold text-brand-gold">
                {accuracy.bias_pct}%
              </span>
            </div>

            {/* Custom Horizontal Meter */}
            <div className="relative h-3 bg-surfaceAlt rounded-full overflow-hidden border border-borderClean">
              {/* Zero center marker line */}
              <div className="absolute left-1/2 top-0 bottom-0 w-[2px] bg-brand-brown/40 z-10"></div>
              {/* Bias Offset Fill */}
              <div
                className="absolute top-0 bottom-0 bg-brand-gold rounded-full"
                style={{
                  left: `${Math.max(0, Math.min(100, 50 + accuracy.bias_pct * 2))}%`,
                  right: `${Math.max(0, Math.min(100, 50 - accuracy.bias_pct * 2))}%`
                }}
              ></div>
            </div>

            <div className="flex justify-between mt-1.5 font-display text-[10px] font-semibold text-textMuted uppercase tracking-wider">
              <span>UNDER-PREDICTING</span>
              <span>BALANCED (0.0)</span>
              <span>OVER-PREDICTING</span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2 - SHAP Drivers & Hourly Breakdown Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* SHAP Explanation Board (5 cols) */}
        <div className="lg:col-span-5 bg-canvas border border-borderClean rounded-card p-5 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center border-b border-borderClean pb-3 mb-3">
              <h3 className="font-display text-sm font-bold uppercase tracking-wide text-brand-brown">
                EXPLAINABLE FORECAST (SHAP IMPACT DRIVERS)
              </h3>
              <Zap className="w-4 h-4 text-brand-gold" />
            </div>
            <p className="text-xs text-textMuted font-ui mb-4">
              Feature attribution weights explaining deviations from baseline volume averages.
            </p>

            <div className="space-y-4">
              {drivers.map((d: any, idx: number) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-brand-brown font-ui">{d.driver}</span>
                    <span className={`font-mono text-[11px] font-bold ${
                      d.direction === 'positive' 
                        ? 'text-brand-green' 
                        : d.direction === 'negative' 
                          ? 'text-status-risk' 
                          : 'text-textMuted'
                    }`}>
                      {d.direction === 'positive' ? '+' : ''}{d.impact}%
                    </span>
                  </div>

                  {/* Impact Progress Bar */}
                  <div className="w-full h-2 bg-surfaceAlt rounded-full overflow-hidden">
                    <div 
                      style={{ width: `${Math.min(100, Math.abs(d.impact) * 12)}%` }} 
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

        {/* Hourly Breakdown & Variance Audit Table (7 cols) */}
        <div className="lg:col-span-7 bg-canvas border border-borderClean rounded-card p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-borderClean pb-3 mb-3">
            <div>
              <h3 className="font-display text-sm font-bold uppercase tracking-wide text-brand-brown">
                HOURLY BREAKDOWN & VARIANCE AUDIT
              </h3>
              <p className="text-[11px] text-textMuted font-ui">
                Quantile prediction intervals for active shift planning.
              </p>
            </div>

            <button 
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 font-display text-[11px] font-bold uppercase tracking-wider text-brand-brown bg-surfaceAlt border border-borderClean px-3 py-1 rounded-btn hover:bg-brand-brown hover:text-textInverse transition-all shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-surfaceAlt text-textMuted uppercase font-display text-[10px] font-bold tracking-wider border-b border-borderClean">
                  <th className="py-2.5 px-3">Hour</th>
                  <th className="py-2.5 px-3 text-right">P10</th>
                  <th className="py-2.5 px-3 text-right text-brand-brown font-bold bg-brand-gold/10">P50 (Model)</th>
                  <th className="py-2.5 px-3 text-right">P90</th>
                  <th className="py-2.5 px-3 text-right font-bold text-brand-brown">Actual</th>
                  <th className="py-2.5 px-3 text-right font-bold">Var (Δ)</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderClean font-mono tabular-nums">
                {chartData.map((r: any, idx: number) => {
                  const variance = r.actual !== null ? r.actual - r.p50 : 0;
                  // Anomaly = actual fell outside the model's own P10-P90 forecast interval,
                  // a threshold that scales with the process instead of a fixed unit count
                  const isAnomaly = r.actual !== null && (r.actual < r.p10 || r.actual > r.p90);
                  const isCurrent = idx === chartData.findIndex(p => p.actual === null);

                  return (
                    <tr 
                      key={idx} 
                      className={`transition-colors ${
                        isAnomaly 
                          ? 'bg-status-risk/10 hover:bg-status-risk/15' 
                          : isCurrent
                            ? 'bg-brand-gold/10 hover:bg-brand-gold/15'
                            : 'hover:bg-surface'
                      }`}
                    >
                      <td className="py-2.5 px-3 font-ui font-semibold text-brand-brown flex items-center gap-1.5">
                        {isCurrent && <span className="w-2 h-2 rounded-full bg-brand-gold animate-pulse"></span>}
                        <span>{r.timestamp.includes(' ') ? r.timestamp.split(' ')[1] : r.timestamp}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right text-textMuted">{r.p10.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-brand-brown bg-brand-gold/5">{r.p50.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right text-textMuted">{r.p90.toLocaleString()}</td>
                      <td className={`py-2.5 px-3 text-right font-bold ${
                        isAnomaly ? 'text-status-risk' : r.actual !== null ? 'text-brand-brown' : 'text-textMuted'
                      }`}>
                        {r.actual !== null ? r.actual.toLocaleString() : '—'}
                      </td>
                      <td className={`py-2.5 px-3 text-right font-bold ${
                        variance > 0 
                          ? isAnomaly ? 'text-status-risk' : 'text-brand-green'
                          : variance < 0 
                            ? 'text-status-risk' 
                            : 'text-textMuted'
                      }`}>
                        {r.actual !== null ? `${variance > 0 ? '+' : ''}${variance.toLocaleString()}` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-badge text-[9.5px] font-display font-bold uppercase tracking-wider select-none inline-block ${
                          isAnomaly 
                            ? 'bg-status-risk text-white border border-status-risk' 
                            : r.actual !== null
                              ? 'bg-brand-green/15 text-brand-green border border-brand-green/30'
                              : 'bg-surfaceAlt text-textMuted border border-borderClean'
                        }`}>
                          {isAnomaly ? 'ANOMALY' : r.actual !== null ? 'NOMINAL' : 'PENDING'}
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
    </div>
  );
};


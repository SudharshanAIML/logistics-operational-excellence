import React, { useState, useEffect } from 'react';
import { Database, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';

export const ModelDataHealth: React.FC = () => {
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [driftLogs, setDriftLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(false);

  // Fetch health data
  useEffect(() => {
    fetchHealthData();
  }, []);

  const fetchHealthData = () => {
    setLoading(true);
    fetch(`http://localhost:8000/api/data-health/status`)
      .then(res => res.json())
      .then(data => {
        setHealthStatus(data);
      })
      .catch(err => console.error("Error fetching health status:", err));

    fetch(`http://localhost:8000/api/data-health/drift`)
      .then(res => res.json())
      .then(data => {
        setDriftLogs(data || []);
      })
      .catch(err => console.error("Error fetching model drift:", err))
      .finally(() => setLoading(false));
  };

  const handleRetrainAll = () => {
    setRecomputing(true);
    // Retrain in background
    fetch(`http://localhost:8000/api/forecast/train?process=unload`, { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        alert("LightGBM volume forecast retraining triggered!");
        fetchHealthData();
      })
      .catch(err => console.error("Error retraining models:", err))
      .finally(() => setRecomputing(false));
  };

  if (loading || !healthStatus) {
    return (
      <div className="flex items-center justify-center h-[500px] text-textMuted font-display uppercase tracking-widest text-xs">
        Connecting to Data Quality Pipelines...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-baseline border-b border-borderClean pb-4">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-wide text-brand-brown">Model & Data Health</h2>
          <p className="text-xs text-textMuted font-ui">
            Monitor ingestion freshness, data quality thresholds, model drift, and retraining logs.
          </p>
        </div>
        
        <button 
          onClick={handleRetrainAll}
          disabled={recomputing}
          className={`font-display text-[10px] font-bold uppercase tracking-widest text-textInverse bg-brand-brown hover:bg-brand-brown700 py-2 px-4 rounded-btn transition-all flex items-center gap-1.5 ${
            recomputing ? 'opacity-70 cursor-not-allowed' : ''
          }`}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {recomputing ? 'RETRAINING...' : 'FORCE RE-TRAIN ALL'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Quality Controls Status Left Panel */}
        <div className="lg:col-span-4 bg-canvas border border-borderClean rounded-card p-5 space-y-5">
          <div className="flex justify-between items-center border-b border-borderClean pb-2">
            <h3 className="font-display text-[15px] tracking-wide text-brand-brown">Data Pipelines Summary</h3>
            <Database className="w-4 h-4 text-brand-brown" />
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-textMuted font-ui">Pipeline Status</span>
              <span className="font-display text-xs font-bold text-brand-green uppercase bg-brand-green/10 px-2 py-0.5 rounded-badge">
                {healthStatus.status}
              </span>
            </div>
            
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-textMuted font-ui">Ingestion Freshness</span>
              <span className="font-ui text-xs font-semibold text-brand-brown">{healthStatus.pipeline_freshness}</span>
            </div>
            
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-textMuted font-ui">Total Scan Events Loaded</span>
              <span className="font-mono text-xs font-semibold text-brand-brown">
                {healthStatus.total_scan_events_count.toLocaleString()}
              </span>
            </div>
            
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-textMuted font-ui">Validation Checks Passed</span>
              <span className="font-mono text-xs font-bold text-brand-green">
                {healthStatus.checks_passed} / {healthStatus.checks_passed + healthStatus.checks_failed}
              </span>
            </div>
          </div>
          
          {/* Rules Checked list */}
          <div className="space-y-3.5 pt-4 border-t border-borderClean">
            <span className="font-display text-[10px] font-bold tracking-widest text-textMuted uppercase">
              Ingestion Validation Rules
            </span>
            <div className="space-y-2.5">
              {healthStatus.rules.map((r: any, idx: number) => (
                <div key={idx} className="flex gap-2 items-start text-xs font-ui">
                  <CheckCircle className="w-4 h-4 mt-0.5 text-brand-green shrink-0" />
                  <div>
                    <span className="font-semibold text-brand-brown font-mono">{r.rule_name}</span>
                    <p className="text-[10px] text-textMuted leading-tight mt-0.5">{r.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Model Drift Log Right Panel */}
        <div className="lg:col-span-8 bg-canvas border border-borderClean rounded-card p-5">
          <h3 className="font-display text-[15px] tracking-wide text-brand-brown mb-1">Model Drift Log</h3>
          <p className="text-[11px] text-textMuted font-ui mb-4">
            Evaluates prediction variance compared to benchmark thresholds. Retraining auto-triggers when drift exceeds limit (&gt;0.02).
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-surfaceAlt text-textMuted uppercase font-display text-[10px] font-bold tracking-wider border-b border-borderClean">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Model Name</th>
                  <th className="py-2.5 px-3 text-right">WAPE</th>
                  <th className="py-2.5 px-3 text-right">Baseline WAPE</th>
                  <th className="py-2.5 px-3 text-right">Drift Delta</th>
                  <th className="py-2.5 px-3 text-center">Drift Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderClean font-mono tabular-nums">
                {driftLogs.map((d: any, idx: number) => {
                  const isDrifting = d.status === 'drift_detected';
                  return (
                    <tr key={idx} className="hover:bg-surface">
                      <td className="py-2.5 px-3 font-ui font-semibold text-brand-brown">{d.date}</td>
                      <td className="py-2.5 px-3 font-ui text-textMuted">{d.model_name}</td>
                      <td className="py-2.5 px-3 text-right font-semibold text-brand-brown">{(d.wape * 100).toFixed(2)}%</td>
                      <td className="py-2.5 px-3 text-right text-textMuted">{(d.baseline_wape * 100).toFixed(2)}%</td>
                      <td className="py-2.5 px-3 text-right font-bold">{d.drift_score.toFixed(4)}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-badge text-[10px] font-bold uppercase tracking-wider select-none inline-block ${
                          isDrifting 
                            ? 'bg-status-risk/10 text-status-risk' 
                            : 'bg-brand-green/10 text-brand-green'
                        }`}>
                          {isDrifting ? 'DRIFT ALERT' : 'STABLE'}
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

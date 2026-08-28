import React, { useState, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import { AlertCircle, MessageSquare, Send, HelpCircle, FileText } from 'lucide-react';

export const AlertsInsights: React.FC = () => {
  const { selectedDate, alerts } = useApp();
  const [query, setQuery] = useState('');
  const [copilotResponse, setCopilotResponse] = useState<string>('');
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [narrativeSummary, setNarrativeSummary] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Fetch initial summary narrative
  useEffect(() => {
    setLoading(true);
    // Fetch deterministic ops narrative for selectedDate
    fetch(`http://localhost:8000/api/copilot/ask?query=Summarize%20ops%20status%20for%20today`)
      .then(res => res.json())
      .then(data => {
        setNarrativeSummary(data.response);
      })
      .catch(err => console.error("Error fetching narrative summary:", err))
      .finally(() => setLoading(false));
  }, [selectedDate]);

  // Submit query to Copilot
  const handleAskCopilot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setCopilotLoading(true);
    setCopilotResponse('');

    fetch(`http://localhost:8000/api/copilot/ask?query=${encodeURIComponent(query)}`)
      .then(res => res.json())
      .then(data => {
        setCopilotResponse(data.response);
      })
      .catch(err => {
        console.error("Error questioning copilot:", err);
        setCopilotResponse("Error connecting to Synapse Copilot services. Please verify backend running status.");
      })
      .finally(() => setCopilotLoading(false));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[500px] text-textMuted font-display uppercase tracking-widest text-xs">
        Assembling Anomalies Logs...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-baseline border-b border-borderClean pb-4">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-wide text-brand-brown">Alerts & Insights</h2>
          <p className="text-xs text-textMuted font-ui">
            Anomalies audit trail, forecast mismatch warnings, and natural-language copilot.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Alerts Audit Trail Left Panel */}
        <div className="lg:col-span-5 bg-canvas border border-borderClean rounded-card p-5 space-y-4">
          <div className="flex justify-between items-center border-b border-borderClean pb-2">
            <h3 className="font-display text-[15px] tracking-wide text-brand-brown">Anomalies Audit Trail</h3>
            <span className="font-mono text-xs text-textMuted">{alerts.length} Active</span>
          </div>

          <div className="space-y-3.5 max-h-[420px] overflow-y-auto pr-1">
            {alerts.length === 0 ? (
              <p className="text-xs text-textMuted italic py-4">No active anomalies detected.</p>
            ) : (
              alerts.map((a: any) => (
                <div key={a.alert_id} className={`flex items-start gap-3 p-3 border rounded-card ${
                  a.severity === 'risk' 
                    ? 'bg-status-risk/5 border-status-risk/30' 
                    : 'bg-brand-gold/5 border-brand-gold/30'
                }`}>
                  <AlertCircle className={`w-5 h-5 mt-0.5 shrink-0 ${
                    a.severity === 'risk' ? 'text-status-risk' : 'text-brand-gold600'
                  }`} />
                  <div className="flex-1">
                    <div className="font-display text-xs font-bold uppercase tracking-wider flex justify-between text-brand-brown">
                      <span>{a.alert_type} ({a.process})</span>
                      <span className="font-mono text-[9px] text-textMuted">{a.timestamp}</span>
                    </div>
                    <p className="text-xs font-ui mt-1 text-textMain">{a.message}</p>
                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-borderClean/40 text-[9px] text-textMuted font-display uppercase tracking-wider">
                      <span>Location: {a.zone}</span>
                      <span className={a.status === 'active' ? 'text-status-risk font-bold' : 'text-brand-green'}>{a.status}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Narrative & Copilot Right Panel */}
        <div className="lg:col-span-7 space-y-6">
          {/* Automated Daily Narrative Summary */}
          <div className="bg-canvas border border-borderClean rounded-card p-5">
            <div className="flex items-center gap-2 mb-3 text-brand-brown border-b border-borderClean pb-2">
              <FileText className="w-5 h-5" />
              <h3 className="font-display text-[15px] tracking-wide font-bold uppercase">Auto-Generated Shift Narrative</h3>
            </div>
            <div className="text-xs text-textMuted font-ui leading-relaxed space-y-2 prose max-w-none">
              {narrativeSummary.split('\n\n').map((para, i) => (
                <p key={i} className={para.startsWith('###') ? 'font-display text-sm font-bold text-brand-brown uppercase pt-2' : ''}>
                  {para.startsWith('###') ? para.replace('###', '') : para}
                </p>
              ))}
            </div>
          </div>

          {/* Ops Copilot agent panel */}
          <div className="bg-canvas border border-borderClean rounded-card p-5 space-y-4">
            <div className="flex items-center gap-2 text-brand-brown">
              <MessageSquare className="w-5 h-5" />
              <h3 className="font-display text-[15px] tracking-wide font-bold uppercase">Synapse Ops Copilot</h3>
            </div>
            <p className="text-xs text-textMuted font-ui">
              Query the semantic KPI database. Try: <em>"Why did cycle times spike last Tuesday?"</em> or <em>"Show OEI stats for unload."</em>
            </p>

            <form onSubmit={handleAskCopilot} className="relative">
              <input
                type="text"
                placeholder="Ask about shift performance, weather impacts, or roster gaps..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-surface border border-borderClean text-xs px-4 py-3 pr-12 rounded-btn outline-none font-ui text-brand-brown focus:border-brand-gold focus:bg-canvas"
              />
              <button
                type="submit"
                disabled={copilotLoading}
                className="absolute right-2.5 top-2.5 text-brand-brown hover:text-brand-gold transition-all"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>

            {/* Answer Display */}
            {(copilotLoading || copilotResponse) && (
              <div className="border border-borderClean rounded-card p-4 bg-surfaceAlt min-h-[120px] max-h-[220px] overflow-y-auto">
                <span className="font-display text-[10px] font-bold tracking-widest text-textMuted uppercase block mb-2">
                  Copilot Narrative Output
                </span>
                {copilotLoading ? (
                  <p className="text-xs text-textMuted font-ui italic">Analyzing telemetry patterns and weather logs...</p>
                ) : (
                  <div className="text-xs text-textMuted font-ui leading-relaxed space-y-2 whitespace-pre-line">
                    {copilotResponse}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { useApp } from '../store/AppContext';
import { AlertCircle, Bot, Send, FileText, AlertTriangle, Sparkles, User } from 'lucide-react';
import { API_BASE_URL } from '../config';

const SourceBadge: React.FC<{ source: string }> = ({ source }) => (
  source === 'gemini' ? (
    <span className="flex items-center gap-1 font-eyebrow text-[9px] bg-brand-gold/15 text-brand-brown border border-brand-gold/30 px-1.5 py-0.5 rounded-badge uppercase font-bold tracking-widest shrink-0">
      <Sparkles className="w-2.5 h-2.5" /> Gemini
    </span>
  ) : source === 'deterministic' ? (
    <span className="font-eyebrow text-[9px] bg-surfaceAlt text-textMuted border border-borderClean px-1.5 py-0.5 rounded-badge uppercase font-bold tracking-widest shrink-0">
      Deterministic
    </span>
  ) : null
);

const markdownComponents = {
  p: (props: any) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
  strong: (props: any) => <strong className="font-bold text-brand-brown" {...props} />,
  em: (props: any) => <em className="italic" {...props} />,
  ul: (props: any) => <ul className="list-disc pl-4 space-y-1 mb-2" {...props} />,
  ol: (props: any) => <ol className="list-decimal pl-4 space-y-1 mb-2" {...props} />,
  li: (props: any) => <li className="leading-relaxed" {...props} />,
  h1: (props: any) => <h3 className="font-display text-sm font-bold text-brand-brown uppercase mt-3 mb-1.5 first:mt-0 tracking-wide" {...props} />,
  h2: (props: any) => <h3 className="font-display text-sm font-bold text-brand-brown uppercase mt-3 mb-1.5 first:mt-0 tracking-wide" {...props} />,
  h3: (props: any) => <h3 className="font-display text-sm font-bold text-brand-brown uppercase mt-3 mb-1.5 first:mt-0 tracking-wide" {...props} />,
  code: (props: any) => <code className="font-mono text-[11px] bg-surfaceAlt px-1 py-0.5 rounded" {...props} />,
};

const MarkdownText: React.FC<{ text: string }> = ({ text }) => (
  <ReactMarkdown components={markdownComponents}>{text}</ReactMarkdown>
);

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  source?: string;
}

export const AlertsInsights: React.FC = () => {
  const { selectedDate, alerts, alertsLoading } = useApp();
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [narrativeSummary, setNarrativeSummary] = useState<string>('');
  const [narrativeSource, setNarrativeSource] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Fetch initial summary narrative
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`${API_BASE_URL}/api/copilot/ask?query=Summarize%20ops%20status%20for%20today`)
      .then(res => res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`)))
      .then(data => {
        setNarrativeSummary(data.response);
        setNarrativeSource(data.source);
      })
      .catch(err => {
        console.error("Error fetching narrative summary:", err);
        setError("Could not reach the Synapse Ops Copilot. Confirm the backend is running.");
      })
      .finally(() => setLoading(false));
  }, [selectedDate]);

  // Auto-scroll the chat thread to the newest message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, copilotLoading]);

  // Submit query to Copilot - appends to the thread instead of replacing a single answer box
  const handleAskCopilot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || copilotLoading) return;

    const userMessage: ChatMessage = { id: `u-${Date.now()}`, role: 'user', text: query };
    setMessages(prev => [...prev, userMessage]);
    setCopilotLoading(true);
    const askedQuery = query;
    setQuery('');

    fetch(`${API_BASE_URL}/api/copilot/ask?query=${encodeURIComponent(askedQuery)}`)
      .then(res => res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`)))
      .then(data => {
        setMessages(prev => [...prev, { id: `a-${Date.now()}`, role: 'assistant', text: data.response, source: data.source }]);
      })
      .catch(err => {
        console.error("Error questioning copilot:", err);
        setMessages(prev => [...prev, {
          id: `a-${Date.now()}`, role: 'assistant',
          text: `Unable to reach the Synapse Ops Copilot (${err.message}). Please verify the backend is running.`,
        }]);
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

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] gap-3 text-center">
        <AlertTriangle className="w-8 h-8 text-status-risk" />
        <p className="text-sm text-brand-brown font-ui font-semibold">{error}</p>
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
            {alertsLoading ? (
              <p className="text-xs text-textMuted italic py-4">Loading alerts...</p>
            ) : alerts.length === 0 ? (
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
            <div className="flex items-center justify-between gap-2 mb-3 text-brand-brown border-b border-borderClean pb-2">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                <h3 className="font-display text-[15px] tracking-wide font-bold uppercase">Auto-Generated Shift Narrative</h3>
              </div>
              <SourceBadge source={narrativeSource} />
            </div>
            <div className="text-xs text-textMuted font-ui">
              <MarkdownText text={narrativeSummary} />
            </div>
          </div>

          {/* Ops Copilot agent panel - a proper chat thread, not a single overwritten answer box */}
          <div className="bg-canvas border border-borderClean rounded-card overflow-hidden shadow-sm flex flex-col">
            <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-b border-borderClean bg-surfaceAlt">
              <div className="flex items-center gap-2 text-brand-brown">
                <Bot className="w-5 h-5" />
                <h3 className="font-display text-[15px] tracking-wide font-bold uppercase">Synapse Ops Copilot</h3>
              </div>
              <span className="font-eyebrow text-[9px] bg-brand-green/15 text-brand-green border border-brand-green/30 px-1.5 py-0.5 rounded-badge uppercase font-bold tracking-widest">
                Online
              </span>
            </div>

            {/* Chat thread - scrolls independently, newest message always visible at the bottom */}
            <div className="h-[340px] overflow-y-auto px-5 py-4 space-y-4 bg-surface/40">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center gap-2 px-6">
                  <Bot className="w-8 h-8 text-brand-brown/30" />
                  <p className="text-xs text-textMuted font-ui">
                    Ask about shift performance, weather impacts, or roster gaps. Try{' '}
                    <em>"Why did cycle times spike last Tuesday?"</em> or <em>"Show OEI stats for unload."</em>
                  </p>
                </div>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className={`flex gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      m.role === 'user' ? 'bg-brand-brown text-brand-gold' : 'bg-brand-gold/15 text-brand-brown'
                    }`}>
                      {m.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                    </div>
                    <div className={`max-w-[85%] rounded-card px-3.5 py-2.5 text-xs font-ui leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-brand-brown text-textInverse'
                        : 'bg-canvas border border-borderClean text-textMuted'
                    }`}>
                      {m.role === 'assistant' && m.source && (
                        <div className="mb-1.5"><SourceBadge source={m.source} /></div>
                      )}
                      {m.role === 'assistant' ? <MarkdownText text={m.text} /> : <p>{m.text}</p>}
                    </div>
                  </div>
                ))
              )}

              {copilotLoading && (
                <div className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-brand-gold/15 text-brand-brown">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                  <div className="bg-canvas border border-borderClean rounded-card px-3.5 py-2.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-brown/40 animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-brown/40 animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-brown/40 animate-bounce"></span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input - pinned below the scrolling thread, always visible */}
            <form onSubmit={handleAskCopilot} className="relative border-t border-borderClean p-3 bg-canvas">
              <input
                type="text"
                placeholder="Ask about shift performance, weather impacts, or roster gaps..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={copilotLoading}
                className="w-full bg-surface border border-borderClean text-xs px-4 py-3 pr-12 rounded-btn outline-none font-ui text-brand-brown focus:border-brand-gold focus:bg-canvas disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={copilotLoading || !query.trim()}
                className="absolute right-5 top-1/2 -translate-y-1/2 text-brand-brown hover:text-brand-gold transition-all disabled:opacity-30 disabled:hover:text-brand-brown"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

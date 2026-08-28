import React from 'react';

interface HeatmapCell {
  zone: string;
  process: string;
  utilization: number;
  state: 'idle' | 'ok' | 'watch' | 'risk';
  active_workers: number;
}

interface ZoneHeatmapProps {
  data: HeatmapCell[];
}

export const ZoneHeatmap: React.FC<ZoneHeatmapProps> = ({ data }) => {
  // Styles based on state
  const stateStyles = {
    idle: {
      bg: 'bg-status-idle/10',
      border: 'border-status-idle/40',
      text: 'text-status-idle',
      label: 'IDLE (<60%)'
    },
    ok: {
      bg: 'bg-brand-green/10',
      border: 'border-brand-green/40',
      text: 'text-brand-green',
      label: 'TARGET (60-85%)'
    },
    watch: {
      bg: 'bg-brand-gold/10',
      border: 'border-brand-gold/40',
      text: 'text-brand-gold600',
      label: 'CONGESTED (85-95%)'
    },
    risk: {
      bg: 'bg-status-risk/10',
      border: 'border-status-risk/40',
      text: 'text-status-risk',
      label: 'CRITICAL (>95%)'
    }
  };

  return (
    <div className="bg-canvas border border-borderClean rounded-card p-5 h-full flex flex-col justify-between">
      <div>
        <h3 className="font-display text-[15px] tracking-wide text-brand-brown mb-1">Zone Utilization Heatmap</h3>
        <p className="text-[11px] text-textMuted font-ui mb-4">
          Real-time supervisor floor load balances. Actionable thresholds based on active headcount.
        </p>
      </div>
      
      {/* Grid of Cells */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 mb-4">
        {data.map((cell) => {
          const style = stateStyles[cell.state];
          
          return (
            <div 
              key={cell.zone} 
              className={`flex flex-col justify-between p-3 border rounded-card h-[88px] transition-all duration-300 hover:scale-[1.02] ${style.bg} ${style.border}`}
            >
              <div className="flex justify-between items-start">
                <span className="font-display text-[10px] font-bold tracking-widest text-textMuted uppercase">
                  {cell.zone}
                </span>
                <span className="font-display text-[9px] font-semibold text-textMuted uppercase opacity-80">
                  {cell.process}
                </span>
              </div>
              
              <div className="flex items-baseline justify-between mt-1">
                <span className="tabular-nums font-mono text-2xl font-bold leading-none text-brand-brown">
                  {cell.utilization}%
                </span>
                <span className="font-mono text-[10px] text-textMuted">
                  {cell.active_workers} HC
                </span>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Legend Block */}
      <div className="flex flex-wrap items-center gap-4 border-t border-borderClean pt-3 text-[10px] font-display font-semibold tracking-wider text-textMuted">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 bg-status-idle/20 border border-status-idle/40 rounded-sm"></span>
          <span>UNDERUTILIZED (&lt;60%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 bg-brand-green/20 border border-brand-green/40 rounded-sm"></span>
          <span>OPTIMAL (60–85%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 bg-brand-gold/20 border border-brand-gold/40 rounded-sm"></span>
          <span>CONGESTION WATCH (85–95%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 bg-status-risk/20 border border-status-risk/40 rounded-sm"></span>
          <span>CRITICAL RISK (&gt;95%)</span>
        </div>
      </div>
    </div>
  );
};

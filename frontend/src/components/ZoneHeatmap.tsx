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
      bg: 'bg-canvas',
      border: 'border-borderClean',
      badge: 'bg-surfaceAlt text-textMuted border border-borderClean',
      bar: 'bg-textMuted/40',
      label: 'IDLE (<60%)'
    },
    ok: {
      bg: 'bg-brand-green/5',
      border: 'border-brand-green/30',
      badge: 'bg-brand-green/15 text-brand-green border border-brand-green/30 font-bold',
      bar: 'bg-brand-green',
      label: 'OPTIMAL (60-85%)'
    },
    watch: {
      bg: 'bg-brand-gold/10',
      border: 'border-brand-gold/40',
      badge: 'bg-brand-gold text-brand-brown border border-brand-gold/40 font-bold',
      bar: 'bg-brand-gold',
      label: 'CONGESTED (85-95%)'
    },
    risk: {
      bg: 'bg-status-risk/10',
      border: 'border-status-risk/40',
      badge: 'bg-status-risk text-white border border-status-risk font-bold',
      bar: 'bg-status-risk',
      label: 'CRITICAL (>95%)'
    }
  };

  return (
    <div className="bg-canvas border border-borderClean rounded-card p-5 h-full flex flex-col justify-between shadow-sm">
      <div>
        <div className="flex justify-between items-center mb-1">
          <h3 className="font-display text-sm font-bold uppercase tracking-wide text-brand-brown m-0">
            ZONE BOTTLENECK HEATMAP
          </h3>
          <span className="font-mono text-[10px] text-textMuted uppercase font-semibold">
            Real-Time Floor Load
          </span>
        </div>
        <p className="text-xs text-textMuted font-ui mb-4">
          Real-time supervisor floor load balances & active headcount allocation.
        </p>
      </div>
      
      {/* Grid of Cells - 3 columns for spacious, clear layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 mb-4">
        {data.map((cell) => {
          const style = stateStyles[cell.state] || stateStyles.ok;
          
          return (
            <div 
              key={cell.zone} 
              className={`flex flex-col justify-between p-3.5 border rounded-card transition-all duration-200 hover:shadow-md ${style.bg} ${style.border}`}
            >
              {/* Header Row: Zone Name & Status Badge */}
              <div className="flex justify-between items-start gap-2 mb-2">
                <div className="overflow-hidden">
                  <span className="font-display text-xs font-bold uppercase tracking-wider text-brand-brown block truncate">
                    {cell.zone}
                  </span>
                  <span className="font-eyebrow text-[9.5px] uppercase tracking-wider text-textMuted block truncate">
                    {cell.process}
                  </span>
                </div>

                <span className={`px-2 py-0.5 rounded-badge text-[9.5px] font-display uppercase tracking-wider shrink-0 ${style.badge}`}>
                  {cell.state === 'risk' ? 'Critical' : cell.state === 'watch' ? 'Congested' : cell.state === 'ok' ? 'Nominal' : 'Idle'}
                </span>
              </div>
              
              {/* Metrics Row: Percentage & Headcount */}
              <div className="flex items-baseline justify-between mt-1 mb-2">
                <span className="tabular-nums font-mono text-2xl font-bold leading-none text-brand-brown">
                  {cell.utilization}%
                </span>
                <span className="font-mono text-[11px] font-semibold text-textMuted bg-canvas border border-borderClean px-2 py-0.5 rounded-badge">
                  {cell.active_workers} HC
                </span>
              </div>

              {/* Capacity Progress Bar */}
              <div className="w-full h-1.5 bg-surfaceAlt rounded-full overflow-hidden border border-borderClean/50">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${style.bar}`}
                  style={{ width: `${Math.min(100, cell.utilization)}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Legend Block */}
      <div className="flex flex-wrap items-center gap-4 border-t border-borderClean pt-3 text-[10px] font-display font-semibold tracking-wider text-textMuted select-none">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 bg-surfaceAlt border border-borderClean rounded-sm"></span>
          <span>UNDERUTILIZED (&lt;60%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 bg-brand-green/20 border border-brand-green/40 rounded-sm"></span>
          <span>OPTIMAL (60–85%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 bg-brand-gold/30 border border-brand-gold/50 rounded-sm"></span>
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


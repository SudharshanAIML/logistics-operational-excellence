import React from 'react';

interface KpiCardProps {
  label: string;
  value: string | number;
  unit?: string;
  delta?: number; // percentage change, e.g. +3.2 or -5
  deltaType?: 'percentage' | 'units' | 'status';
  statusText?: string;
  statusColor?: 'ok' | 'watch' | 'risk' | 'idle';
}

export const KpiCard: React.FC<KpiCardProps> = ({ 
  label, 
  value, 
  unit, 
  delta, 
  deltaType = 'percentage',
  statusText,
  statusColor 
}) => {
  const isPositive = delta !== undefined && delta >= 0;
  
  // Render right delta badge
  const renderDelta = () => {
    if (statusText && statusColor) {
      const colorClasses = {
        ok: 'bg-brand-green/10 text-brand-green',
        watch: 'bg-brand-gold/10 text-brand-gold',
        risk: 'bg-status-risk/10 text-status-risk',
        idle: 'bg-status-idle/10 text-status-idle',
      }[statusColor];
      
      return (
        <span className={`text-xs px-2 py-0.5 rounded-badge uppercase font-display tracking-wider ${colorClasses}`}>
          {statusText}
        </span>
      );
    }
    
    if (delta === undefined) return null;
    
    const deltaStr = deltaType === 'percentage' 
      ? `${isPositive ? '+' : ''}${delta.toFixed(1)}%`
      : `${isPositive ? '+' : ''}${delta}`;
      
    const colorClass = isPositive 
      ? 'bg-brand-green/12 text-brand-green' 
      : 'bg-status-risk/12 text-status-risk';
      
    return (
      <span className={`text-[12px] font-medium px-2 py-0.5 rounded-badge tabular-nums ${colorClass}`}>
        {isPositive ? '▲' : '▼'} {deltaStr.replace('+', '').replace('-', '')}
      </span>
    );
  };

  return (
    <div className="flex flex-col justify-between h-[120px] bg-canvas border border-borderClean rounded-card p-4">
      {/* Header Row */}
      <div className="flex justify-between items-start">
        <span className="font-display text-[11px] font-semibold uppercase tracking-widest text-textMuted leading-none">
          {label}
        </span>
        {renderDelta()}
      </div>
      
      {/* Metric Value Row */}
      <div className="flex items-baseline mb-1">
        <span className="tabular-nums font-mono text-3xl font-semibold tracking-tight text-brand-brown">
          {value}
        </span>
        {unit && (
          <span className="ml-1 text-xs font-semibold text-textMuted font-display uppercase tracking-wider">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
};

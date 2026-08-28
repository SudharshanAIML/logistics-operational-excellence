import React from 'react';
import { 
  ResponsiveContainer, 
  ComposedChart, 
  Area, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ReferenceLine 
} from 'recharts';

interface ChartPoint {
  timestamp: string;
  hour: number;
  actual: number | null;
  p10: number;
  p50: number;
  p90: number;
}

interface VolumeBurnDownProps {
  data: ChartPoint[];
  title?: string;
}

export const VolumeBurnDown: React.FC<VolumeBurnDownProps> = ({ data, title = "Hourly Volume: Forecast vs Actual" }) => {
  // Find current hour to place the now-line (represented by the transition between actual and future)
  // Let's assume now is August 28, 2026 10:00.
  // We look for the last point that has an actual value
  const nowPoint = [...data].reverse().find(p => p.actual !== null);
  const nowTimestamp = nowPoint ? nowPoint.timestamp : null;

  // Custom Tooltip component
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      return (
        <div className="bg-canvas border border-borderClean rounded-card p-3 shadow-[0_8px_24px_rgba(53,28,21,0.12)] text-xs text-brand-brown">
          <p className="font-semibold mb-1">{dataPoint.timestamp}</p>
          <div className="space-y-1 font-mono">
            {dataPoint.actual !== null && (
              <p className="flex justify-between gap-4 text-brand-gold">
                <span>ACTUALS:</span>
                <span>{dataPoint.actual} units</span>
              </p>
            )}
            <p className="flex justify-between gap-4 text-brand-brown">
              <span>EXPECTED (P50):</span>
              <span>{dataPoint.p50} units</span>
            </p>
            <p className="flex justify-between gap-4 text-textMuted">
              <span>P10–P90 RANGE:</span>
              <span>{dataPoint.p10} – {dataPoint.p90}</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-canvas border border-borderClean rounded-card p-5 h-[360px] flex flex-col justify-between shadow-sm">
      {/* Title & Custom Legend Header */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-display text-sm font-bold uppercase tracking-wide text-brand-brown">{title}</h3>
        
        {/* Custom Legend */}
        <div className="flex items-center gap-4 text-xs font-display font-bold tracking-wider text-brand-brown uppercase">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-brand-gold rounded-sm inline-block"></span>
            <span>ACTUAL UNITS</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-brand-brown rounded-sm inline-block"></span>
            <span>EXPECTED (P50)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-brand-brown/15 border border-brand-brown/30 rounded-sm inline-block"></span>
            <span>CONFIDENCE BAND (P10-P90)</span>
          </div>
          {nowTimestamp && (
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 border-t-2 border-dashed border-brand-brown inline-block"></span>
              <span>NOW LINE</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Chart container */}
      <div className="flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
            <CartesianGrid 
              stroke="#E3DCD6" 
              strokeDasharray="3 3" 
              vertical={false} 
            />
            <XAxis 
              dataKey="timestamp" 
              tickFormatter={(ts) => ts.split(' ')[1] || ts} 
              tick={{ fill: '#351C15', fontSize: 11, fontWeight: 600, fontFamily: 'IBM Plex Mono, monospace' }}
              axisLine={false}
              tickLine={false}
              dy={8}
            />
            <YAxis 
              tick={{ fill: '#351C15', fontSize: 11, fontWeight: 600, fontFamily: 'IBM Plex Mono, monospace' }}
              axisLine={false}
              tickLine={false}
              dx={-8}
            />
            <Tooltip content={<CustomTooltip />} />
            
            {/* P10 - P90 Area Band */}
            <Area 
              type="monotone" 
              dataKey="p90" 
              dataKey2="p10" // Custom Recharts area range properties
              fill="rgba(53, 28, 21, 0.12)" 
              stroke="none" 
              connectNulls 
            />
            
            {/* Area backing range for standard recharts compatibility */}
            <Area 
              type="monotone" 
              dataKey="p90" 
              fill="none" 
              stroke="none" 
            />
            
            {/* P50 Median Line */}
            <Line 
              type="monotone" 
              dataKey="p50" 
              stroke="#351C15" 
              strokeWidth={2.5} 
              dot={false} 
              activeDot={{ r: 4, stroke: '#351C15', strokeWidth: 1 }} 
            />
            
            {/* Actual Volume Line */}
            <Line 
              type="monotone" 
              dataKey="actual" 
              stroke="#FFB500" 
              strokeWidth={3.5} 
              dot={{ r: 3, fill: '#FFB500', stroke: '#351C15', strokeWidth: 1 }}
              activeDot={{ r: 6, fill: '#FFB500', stroke: '#351C15', strokeWidth: 2 }} 
            />
            
            {/* Vertical Now-Line marker */}
            {nowTimestamp && (
              <ReferenceLine 
                x={nowTimestamp} 
                stroke="#351C15" 
                strokeWidth={2}
                strokeDasharray="4 4" 
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

import React from 'react';

interface ShieldGaugeProps {
  score: number; // OEI score from 0.0 to 1.0
  delta: number; // Comparison delta, e.g. +0.04
}

export const ShieldGauge: React.FC<ShieldGaugeProps> = ({ score, delta }) => {
  // Clamp score between 0 and 1
  const clampedScore = Math.max(0, Math.min(1, score));
  const fillPercentage = clampedScore * 100;
  
  // Calculate y position for SVG rect (100 is top, 0 is bottom in standard, but SVG coordinate has 0 at top, 100 at bottom)
  // Height should be fillPercentage, and y should be 100 - fillPercentage.
  const rectHeight = fillPercentage;
  const rectY = 100 - fillPercentage;

  const isPositive = delta >= 0;

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-canvas border border-borderClean rounded-card text-center min-h-[220px] shadow-sm">
      <span className="font-display text-xs font-bold uppercase tracking-wider text-brand-brown mb-2">
        OPS EFFICIENCY INDEX (OEI)
      </span>
      
      <div className="relative w-36 h-36">
        <svg viewBox="0 0 100 100" className="w-full h-full filter drop-shadow-[0_4px_12px_rgba(53,28,21,0.08)]">
          <defs>
            {/* UPS Shield clip path */}
            <clipPath id="shieldClip">
              <path d="M50 5 L88 18 V55 C88 77, 50 95, 50 95 C50 95, 12 77, 12 55 V18 Z" />
            </clipPath>
          </defs>
          
          {/* Base Background Shield (Warm Muted off-white/brown) */}
          <path 
            d="M50 5 L88 18 V55 C88 77, 50 95, 50 95 C50 95, 12 77, 12 55 V18 Z" 
            fill="#F2EEEA" 
            stroke="#351C15" 
            strokeWidth="3"
          />
          
          {/* Gold filling level (clipped by shield shape) */}
          <g clipPath="url(#shieldClip)">
            <rect 
              x="5" 
              y={rectY} 
              width="90" 
              height={rectHeight} 
              fill="#FFB500" 
              className="transition-all duration-1000 ease-out"
            />
          </g>
          
          {/* Inner Border to draw over the gold fill */}
          <path 
            d="M50 5 L88 18 V55 C88 77, 50 95, 50 95 C50 95, 12 77, 12 55 V18 Z" 
            fill="none" 
            stroke="#351C15" 
            strokeWidth="3.5"
            strokeLinejoin="miter"
          />
          
          {/* OEI Numerical Overlay inside the shield */}
          <text 
            x="50" 
            y="56" 
            textAnchor="middle" 
            fill="#351C15" 
            fontWeight="bold" 
            fontSize="21" 
            fontFamily="'IBM Plex Mono', monospace"
            className="select-none"
          >
            {clampedScore.toFixed(2)}
          </text>
        </svg>
      </div>
      
      {/* Delta Badge */}
      <div className="flex items-center mt-3 text-xs font-bold">
        <span className={`flex items-center tabular-nums px-2 py-0.5 rounded-badge ${
          isPositive 
            ? 'bg-brand-green/15 text-brand-green border border-brand-green/30' 
            : 'bg-status-risk/15 text-status-risk border border-status-risk/30'
        }`}>
          {isPositive ? '▲' : '▼'} {Math.abs(delta).toFixed(2)}
        </span>
        <span className="text-brand-brown/80 ml-1.5 font-display text-xs tracking-wider uppercase font-semibold">
          vs last week
        </span>
      </div>
    </div>
  );
};

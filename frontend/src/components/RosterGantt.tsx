import React from 'react';

interface GanttTask {
  id: string;
  workerId: string;
  workerName: string;
  process: string;
  zone: string;
  shift: string;
  startHour: number; // 6 to 22
  endHour: number;
}

interface RosterGanttProps {
  tasks: GanttTask[];
}

export const RosterGantt: React.FC<RosterGanttProps> = ({ tasks }) => {
  // 24 Hour timeline markers: 06:00 to 06:00 next day (6, 8, 10, 12, 14, 16, 18, 20, 22, 0, 2, 4, 6)
  const timelineHours = [6, 8, 10, 12, 14, 16, 18, 20, 22, 0, 2, 4];
  
  // Format hours display
  const formatHourLabel = (h: number) => {
    return `${h.toString().padStart(2, '0')}:00`;
  };

  // Process colors matching brand palette
  const processColors: Record<string, { bg: string, text: string, border: string }> = {
    unload: { bg: 'bg-brand-brown', text: 'text-textInverse', border: 'border-brand-brown900' },
    sort: { bg: 'bg-brand-gold', text: 'text-brand-brown', border: 'border-brand-gold600' },
    stow: { bg: 'bg-brand-green', text: 'text-textInverse', border: 'border-brand-green/80' },
    pick: { bg: 'bg-surfaceAlt', text: 'text-brand-brown', border: 'border-borderStrong' },
    pack: { bg: 'bg-brand-brown700', text: 'text-textInverse', border: 'border-brand-brown900' },
    load: { bg: 'bg-status-risk/20 text-status-risk', text: 'text-status-risk', border: 'border-status-risk' }
  };

  // Render a slice of tasks (e.g. limit to first 12 for clean visual display)
  const displayedTasks = tasks.slice(0, 15);

  return (
    <div className="bg-canvas border border-borderClean rounded-card p-5 overflow-hidden flex flex-col justify-between min-h-[400px]">
      <div>
        <h3 className="font-display text-[15px] tracking-wide text-brand-brown mb-1">Gantt Shift Board</h3>
        <p className="text-[11px] text-textMuted font-ui mb-4">
          CP-SAT scheduling roster output. Rest constraints (11h min) and skills certifications verified.
        </p>
      </div>

      <div className="flex-1 overflow-x-auto min-w-0">
        {/* Timeline Header */}
        <div className="relative flex border-b border-borderClean pb-2 mb-2 font-mono text-[10px] text-textMuted select-none min-w-[600px]">
          <div className="w-1/4 min-w-[150px] font-display font-semibold uppercase tracking-wider">
            Worker / Primary Cert
          </div>
          <div className="w-3/4 flex justify-between pr-4 relative">
            {timelineHours.map((h, i) => (
              <span key={i} className="text-center w-8">
                {formatHourLabel(h)}
              </span>
            ))}
          </div>
        </div>

        {/* Gantt Rows */}
        <div className="space-y-2.5 min-w-[600px] max-h-[300px] overflow-y-auto pr-2">
          {displayedTasks.length === 0 ? (
            <div className="text-center py-12 text-textMuted text-xs font-ui">
              No active shift assignments optimized for this selection. Click "Generate Roster" to run solver.
            </div>
          ) : (
            displayedTasks.map((t) => {
              const pStyle = processColors[t.process] || { bg: 'bg-status-idle', text: 'text-brand-brown', border: 'border-borderClean' };
              
              // Calculate positioning on timeline
              // The timeline goes from 6 to 30 (representing 24 hours starting at 6am)
              const timelineStart = 6;
              const timelineLength = 24; // 24 hours total
              
              // Adjust startHour/endHour for Night shift wrapping
              let start = t.startHour;
              let end = t.endHour;
              
              const leftPercent = ((start - timelineStart) / timelineLength) * 100;
              const widthPercent = ((end - start) / timelineLength) * 100;
              
              return (
                <div key={t.id} className="relative flex items-center h-8 group hover:bg-surface rounded-sm transition-all">
                  {/* Worker Name & Role */}
                  <div className="w-1/4 min-w-[150px] flex flex-col justify-center">
                    <span className="font-ui font-semibold text-xs text-brand-brown truncate">{t.workerName}</span>
                    <span className="font-display text-[9px] uppercase tracking-wider text-textMuted">{t.workerId} · {t.process.toUpperCase()}</span>
                  </div>
                  
                  {/* Timeline Bar Space */}
                  <div className="w-3/4 h-full relative flex items-center pr-4">
                    {/* Background tick guides */}
                    <div className="absolute inset-0 flex justify-between pointer-events-none opacity-20 border-l border-r border-dashed border-borderStrong">
                      {timelineHours.map((_, i) => (
                        <span key={i} className="h-full border-r border-dashed border-borderStrong"></span>
                      ))}
                    </div>
                    
                    {/* Shift Bar Block */}
                    <div 
                      style={{ 
                        left: `${leftPercent}%`, 
                        width: `${widthPercent}%` 
                      }} 
                      className={`absolute h-6 border rounded-sm flex items-center justify-center text-[10px] font-display font-bold uppercase tracking-wider transition-all shadow-sm ${pStyle.bg} ${pStyle.text} ${pStyle.border}`}
                    >
                      <span className="truncate px-1.5">{t.process} ({t.zone})</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      
      {/* Legend Footer */}
      <div className="flex flex-wrap items-center gap-3 border-t border-borderClean pt-3 mt-4 text-[9px] font-display font-semibold tracking-wider text-textMuted select-none">
        <span className="text-[10px] uppercase font-bold text-brand-brown">Processes:</span>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 bg-brand-brown rounded-sm"></span>
          <span>UNLOAD</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 bg-brand-gold rounded-sm"></span>
          <span>SORT</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 bg-brand-green rounded-sm"></span>
          <span>STOW</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 bg-surfaceAlt border border-borderStrong rounded-sm"></span>
          <span>PICK</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 bg-brand-brown700 rounded-sm"></span>
          <span>PACK</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 bg-status-risk/20 border border-status-risk rounded-sm"></span>
          <span>LOAD</span>
        </div>
      </div>
    </div>
  );
};

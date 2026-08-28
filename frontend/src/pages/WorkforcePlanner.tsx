import React, { useState, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import { RosterGantt } from '../components/RosterGantt';
import { Calendar, UserCheck, Users, HelpCircle, ArrowRight } from 'lucide-react';

export const WorkforcePlanner: React.FC = () => {
  const { selectedDate, selectedShift } = useApp();
  const [gapData, setGapData] = useState<any>(null);
  const [ganttTasks, setGanttTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);

  // Fetch workforce gaps
  useEffect(() => {
    setLoading(true);
    fetch(`http://localhost:8000/api/workforce/gaps?date=${selectedDate}`)
      .then(res => res.json())
      .then(data => {
        setGapData(data);
      })
      .catch(err => console.error("Error fetching workforce gaps:", err))
      .finally(() => setLoading(false));
  }, [selectedDate]);

  // Run CP-SAT optimizer
  const handleGenerateRoster = () => {
    setOptimizing(true);
    
    // Assemble requirement matrix based on current table requirements
    // For simplicity, we pass default requirements which maps to current gap table state
    const defaultRequirements = {
      "Day": {"unload": 5, "sort": 6, "stow": 5, "pick": 6, "pack": 5, "load": 5},
      "Twilight": {"unload": 6, "sort": 7, "stow": 6, "pick": 6, "pack": 5, "load": 5},
      "Night": {"unload": 3, "sort": 4, "stow": 3, "pick": 4, "pack": 3, "load": 3}
    };
    
    fetch(`http://localhost:8000/api/workforce/optimize?date=${selectedDate}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: json_payload := JSON.stringify(defaultRequirements)
    })
      .then(res => res.json())
      .then(data => {
        if (data.status === "success") {
          setGanttTasks(data.gantt_tasks || []);
        } else {
          alert("Optimizer was unable to find optimal solution: " + data.message);
        }
      })
      .catch(err => console.error("Error running optimizer:", err))
      .finally(() => setOptimizing(false));
  };

  if (loading || !gapData) {
    return (
      <div className="flex items-center justify-center h-[500px] text-textMuted font-display uppercase tracking-widest text-xs">
        Formulating Workforce Requirements...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-baseline border-b border-borderClean pb-4">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-wide text-brand-brown">Workforce Planner</h2>
          <p className="text-xs text-textMuted font-ui">
            Convert forecasted volume to labor hours and headcount. Auto-roster scheduled shifts.
          </p>
        </div>
        <div className="font-mono text-xs text-textMuted bg-surfaceAlt px-3 py-1.5 rounded-badge border border-borderClean">
          Roster Date: {selectedDate}
        </div>
      </div>

      {/* Workforce gap table */}
      <div className="bg-canvas border border-borderClean rounded-card overflow-hidden">
        <div className="p-4 border-b border-borderClean bg-surfaceAlt flex justify-between items-center">
          <h3 className="font-display text-sm tracking-wide text-brand-brown">Labor Demand Gap Analysis</h3>
          <span className="text-[11px] text-textMuted font-ui">Required hours = Forecast Volume ÷ UPH Standard</span>
        </div>
        
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="bg-surface text-textMuted uppercase font-display text-[10px] font-bold tracking-wider border-b border-borderClean">
              <th className="py-2.5 px-4">Process Node</th>
              <th className="py-2.5 px-4 text-right">Forecast Volume</th>
              <th className="py-2.5 px-4 text-right">Std UPH</th>
              <th className="py-2.5 px-4 text-right">Req. Hours</th>
              <th className="py-2.5 px-4 text-right">Req. Headcount</th>
              <th className="py-2.5 px-4 text-right">Avail. Headcount</th>
              <th className="py-2.5 px-4 text-center">Roster Gap</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borderClean font-mono tabular-nums">
            {gapData.processes.map((row: any, idx: number) => {
              const hasDeficit = row.gap < 0;
              return (
                <tr 
                  key={idx} 
                  className={`hover:bg-surface ${hasDeficit ? 'border-l-[3.5px] border-status-risk' : ''}`}
                >
                  <td className="py-3 px-4 font-ui font-semibold text-brand-brown">{row.label}</td>
                  <td className="py-3 px-4 text-right">{row.forecast_volume.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-textMuted">{row.standard_uph}</td>
                  <td className="py-3 px-4 text-right">{row.required_hours} h</td>
                  <td className="py-3 px-4 text-right font-bold text-brand-brown">{row.required_headcount}</td>
                  <td className="py-3 px-4 text-right">{row.available_headcount}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`px-2 py-0.5 rounded-badge text-[10.5px] font-bold select-none inline-block min-w-[36px] ${
                      row.gap > 0 
                        ? 'bg-brand-green/10 text-brand-green' 
                        : row.gap < 0 
                          ? 'bg-status-risk/10 text-status-risk' 
                          : 'bg-status-idle/10 text-status-idle'
                    }`}>
                      {row.gap > 0 ? `+${row.gap}` : row.gap}
                    </span>
                  </td>
                </tr>
              );
            })}
            
            {/* Total Row */}
            <tr className="bg-brand-brown text-textInverse font-bold font-mono">
              <td className="py-3 px-4 font-display font-bold uppercase tracking-wider text-[11px]">Total Hub Demand</td>
              <td className="py-3 px-4 text-right">{gapData.total.forecast_volume.toLocaleString()}</td>
              <td className="py-3 px-4 text-right text-textInverse/60">—</td>
              <td className="py-3 px-4 text-right">{gapData.total.required_hours} h</td>
              <td className="py-3 px-4 text-right">{gapData.total.required_headcount}</td>
              <td className="py-3 px-4 text-right">{gapData.total.available_headcount}</td>
              <td className="py-3 px-4 text-center">
                <span className={`px-2 py-0.5 rounded-badge text-[10.5px] font-bold bg-white/20 text-textInverse`}>
                  {gapData.total.gap > 0 ? `+${gapData.total.gap}` : gapData.total.gap}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Roster Optimization Trigger & Gantt */}
      <div className="space-y-4">
        <div className="flex justify-between items-center bg-canvas border border-borderClean p-4 rounded-card">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-brand-brown" />
            <div>
              <h4 className="font-display text-sm tracking-wide text-brand-brown">Roster Scheduler</h4>
              <p className="text-[11px] text-textMuted font-ui">Assign available certified workers to shift zones under labor laws.</p>
            </div>
          </div>
          
          <button 
            onClick={handleGenerateRoster}
            disabled={optimizing}
            className={`font-display text-[11px] font-bold uppercase tracking-widest text-brand-brown bg-brand-gold hover:bg-brand-gold600 py-2.5 px-6 rounded-btn transition-all flex items-center gap-2 ${
              optimizing ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            {optimizing ? 'SOLVING ROSTER...' : 'GENERATE ROSTER'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        
        {/* Roster Timeline Gantt */}
        <RosterGantt tasks={ganttTasks} />
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { AppProvider, useApp, type TabType } from './store/AppContext';
import { CommandCenter } from './pages/CommandCenter';
import { ForecastStudio } from './pages/ForecastStudio';
import { WorkforcePlanner } from './pages/WorkforcePlanner';
import { EfficiencyDashboard } from './pages/EfficiencyDashboard';
import { OptimizationLab } from './pages/OptimizationLab';
import { AlertsInsights } from './pages/AlertsInsights';
import { ModelDataHealth } from './pages/ModelDataHealth';
import { 
  LayoutDashboard, 
  TrendingUp, 
  Users, 
  Gauge, 
  FlaskConical, 
  Bell, 
  Database, 
  Search, 
  Settings, 
  HelpCircle, 
  ShieldCheck, 
  Activity, 
  Sliders, 
  Building2, 
  X,
  Check
} from 'lucide-react';

const HubSelectorModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { selectedHub, setSelectedHub, selectedShift, setSelectedShift } = useApp();

  if (!isOpen) return null;

  const hubs = [
    { id: 'Hub 402-ATL', name: 'Atlanta Primary Hub (ATL)', region: 'East Coast US', capacity: '1.2M pk/day' },
    { id: 'Hub 108-ORD', name: 'Chicago O\'Hare Gateway (ORD)', region: 'Midwest US', capacity: '950K pk/day' },
    { id: 'Hub 501-DFW', name: 'Dallas Fort Worth Hub (DFW)', region: 'South US', capacity: '880K pk/day' },
    { id: 'Chennai GH-01', name: 'Chennai Hub Facility (GH-01)', region: 'Asia-Pacific', capacity: '650K pk/day' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-canvas border border-borderClean rounded-card max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
        <div className="flex justify-between items-center border-b border-borderClean pb-3">
          <div className="flex items-center gap-2 text-brand-brown">
            <Building2 className="w-5 h-5 text-brand-gold" />
            <h3 className="font-display text-lg font-bold uppercase tracking-wide">Switch Operational Facility</h3>
          </div>
          <button onClick={onClose} className="text-textMuted hover:text-brand-brown transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <label className="font-display text-xs font-semibold uppercase tracking-wider text-textMuted block">Select Facility</label>
          <div className="space-y-2">
            {hubs.map((hub) => (
              <div 
                key={hub.id}
                onClick={() => {
                  setSelectedHub(hub.id);
                }}
                className={`p-3 border rounded-card cursor-pointer transition-all flex items-center justify-between ${
                  selectedHub === hub.id 
                    ? 'border-brand-gold bg-brand-gold/10 text-brand-brown font-semibold' 
                    : 'border-borderClean hover:bg-surfaceAlt text-textMain'
                }`}
              >
                <div>
                  <div className="font-display text-xs uppercase font-bold flex items-center gap-2">
                    <span>{hub.id}</span>
                    <span className="text-[10px] text-textMuted font-mono font-normal">({hub.region})</span>
                  </div>
                  <div className="text-[11px] text-textMuted font-ui mt-0.5">{hub.name}</div>
                </div>
                {selectedHub === hub.id && <Check className="w-4 h-4 text-brand-gold" />}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t border-borderClean">
          <label className="font-display text-xs font-semibold uppercase tracking-wider text-textMuted block">Select Active Shift</label>
          <div className="grid grid-cols-3 gap-2">
            {['Day', 'Twilight', 'Night'].map((shift) => (
              <button
                key={shift}
                onClick={() => setSelectedShift(shift)}
                className={`py-2 text-xs font-display font-semibold uppercase tracking-wider rounded-btn transition-all ${
                  selectedShift === shift
                    ? 'bg-brand-brown text-brand-gold border border-brand-brown'
                    : 'bg-surface border border-borderClean text-brand-brown hover:bg-surfaceAlt'
                }`}
              >
                {shift} Shift
              </button>
            ))}
          </div>
        </div>

        <button 
          onClick={onClose}
          className="w-full bg-brand-brown hover:bg-brand-brown700 text-textInverse font-display text-xs font-bold uppercase tracking-widest py-2.5 rounded-btn transition-all mt-4"
        >
          Confirm Hub Configuration
        </button>
      </div>
    </div>
  );
};

const MainContent: React.FC = () => {
  const { activeTab, setActiveTab, selectedHub, selectedShift, alerts, privacyFloor, setPrivacyFloor } = useApp();
  const [isHubModalOpen, setIsHubModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const navItems: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'command-center', label: 'Command Center', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'forecast', label: 'Forecast Studio', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'workforce', label: 'Workforce Planner', icon: <Users className="w-4 h-4" /> },
    { id: 'efficiency', label: 'Efficiency Dashboard', icon: <Gauge className="w-4 h-4" /> },
    { id: 'optimization', label: 'Optimization Lab', icon: <FlaskConical className="w-4 h-4" /> },
    { id: 'alerts', label: 'Alerts & Copilot', icon: <Bell className="w-4 h-4" /> },
    { id: 'health', label: 'Model & Data Health', icon: <Database className="w-4 h-4" /> },
  ];

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'command-center':
        return <CommandCenter />;
      case 'forecast':
        return <ForecastStudio />;
      case 'workforce':
        return <WorkforcePlanner />;
      case 'efficiency':
        return <EfficiencyDashboard />;
      case 'optimization':
        return <OptimizationLab />;
      case 'alerts':
        return <AlertsInsights />;
      case 'health':
        return <ModelDataHealth />;
      default:
        return <CommandCenter />;
    }
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col">
      {/* Top Navigation Bar (UPS Chrome Header) */}
      <nav className="bg-primary text-secondary-fixed fixed top-0 left-0 w-full h-header-height z-50 border-b border-outline flex items-center justify-between px-6 shadow-md">
        {/* 3px UPS Gold Top Stripe */}
        <div className="absolute top-0 left-0 w-full h-[3px] bg-brand-gold"></div>

        {/* Brand Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-sm bg-brand-gold flex items-center justify-center text-brand-brown font-display font-bold text-lg shadow-sm">
            UPS
          </div>
          <span className="font-display text-2xl font-extrabold text-brand-gold tracking-tight select-none">
            SYNAPSE OPS
          </span>
        </div>

        {/* Search Bar & Action Utilities */}
        <div className="flex items-center gap-4">
          {/* Global Hub Search Bar */}
          <div className="relative hidden md:block w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant" />
            <input 
              type="text" 
              placeholder="Search package, lane, or hub..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-primary-container border border-outline text-surface-bright pl-9 pr-3 py-1.5 rounded-btn text-xs focus:border-brand-gold focus:ring-1 focus:ring-brand-gold outline-none transition-colors"
            />
          </div>

          {/* Quick Action Buttons */}
          <button 
            onClick={() => setActiveTab('alerts')}
            title="Active Alerts Feed"
            className="relative text-on-primary-container hover:text-brand-gold p-2 rounded-btn hover:bg-primary-container transition-colors"
          >
            <Bell className="w-5 h-5" />
            {alerts.length > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-status-risk text-white font-mono text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse">
                {alerts.length}
              </span>
            )}
          </button>

          <button 
            onClick={() => setActiveTab('health')}
            title="System & Data Health"
            className="text-on-primary-container hover:text-brand-gold p-2 rounded-btn hover:bg-primary-container transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>

          <button 
            onClick={() => setActiveTab('alerts')}
            title="Copilot Help Assistant"
            className="text-on-primary-container hover:text-brand-gold p-2 rounded-btn hover:bg-primary-container transition-colors"
          >
            <HelpCircle className="w-5 h-5" />
          </button>

          {/* User Profile Avatar */}
          <div className="flex items-center gap-2 pl-2 border-l border-outline/50">
            <div className="w-8 h-8 rounded-full bg-surface-container-highest overflow-hidden border border-brand-gold/60">
              <img 
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80" 
                alt="Hub Manager" 
                className="w-full h-full object-cover"
              />
            </div>
            <div className="hidden lg:block text-left">
              <div className="font-display text-xs font-bold text-brand-gold leading-tight uppercase">J. Miller</div>
              <div className="font-eyebrow text-[10px] text-on-primary-container uppercase">Hub Operations Director</div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Body Shell (Side Navigation + Viewport) */}
      <div className="flex flex-1 pt-header-height">
        {/* Side Navigation Bar (UPS Dark Sidebar) */}
        <aside className="bg-primary-container fixed left-0 top-header-height h-[calc(100vh-64px)] w-sidebar-width border-r border-outline flex flex-col py-4 z-40 hidden md:flex">
          {/* Facility Selector Card */}
          <div className="px-4 mb-5">
            <div className="flex items-center gap-3 mb-2 bg-primary p-2.5 rounded-card border border-outline/60">
              <div className="w-9 h-9 bg-surface-container rounded-sm border border-outline flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5 text-brand-brown" />
              </div>
              <div className="overflow-hidden">
                <div className="font-mono text-xs font-bold text-brand-gold truncate">{selectedHub}</div>
                <div className="font-eyebrow text-[10px] text-on-primary-container uppercase tracking-widest">
                  Shift: {selectedShift || "Night"} Sort
                </div>
              </div>
            </div>
            <button 
              onClick={() => setIsHubModalOpen(true)}
              className="w-full border border-outline text-on-primary-container py-1.5 rounded-btn text-xs font-display font-semibold uppercase tracking-wider hover:bg-primary hover:text-brand-gold transition-all"
            >
              Switch Facility
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 space-y-1 px-2">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-btn cursor-pointer transition-all font-display text-xs font-bold uppercase tracking-wider border-l-4 ${
                    isActive 
                      ? 'bg-primary text-brand-gold border-brand-gold font-semibold shadow-inner' 
                      : 'text-on-surface-variant border-transparent hover:bg-primary/50 hover:text-brand-gold'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Sidebar Footer - Privacy & System Health */}
          <div className="mt-auto border-t border-outline/60 pt-3 px-4 space-y-2">
            {/* Privacy Floor Selector */}
            <div className="flex items-center justify-between text-[11px] font-display uppercase tracking-wider text-on-primary-container">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-brand-green" />
                <span>Privacy Floor</span>
              </span>
              <select 
                value={privacyFloor}
                onChange={(e) => setPrivacyFloor(Number(e.target.value))}
                className="bg-primary text-brand-gold font-mono text-[10px] px-1.5 py-0.5 rounded border border-outline outline-none cursor-pointer"
              >
                <option value={5}>k ≥ 5</option>
                <option value={10}>k ≥ 10</option>
                <option value={20}>k ≥ 20</option>
              </select>
            </div>

            {/* System Health */}
            <button 
              onClick={() => setActiveTab('health')}
              className="w-full flex items-center justify-between text-[11px] font-display uppercase tracking-wider text-on-primary-container hover:text-brand-gold transition-colors py-1"
            >
              <span className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-brand-gold" />
                <span>System Health</span>
              </span>
              <span className="w-2 h-2 rounded-full bg-brand-green"></span>
            </button>
          </div>
        </aside>

        {/* Main Canvas Viewport */}
        <main className="ml-0 md:ml-sidebar-width flex-1 p-6 md:p-8 max-w-max-content-width mx-auto w-full min-h-[calc(100vh-64px)] overflow-y-auto">
          {renderActiveTab()}
        </main>
      </div>

      {/* Hub Switcher Modal */}
      <HubSelectorModal isOpen={isHubModalOpen} onClose={() => setIsHubModalOpen(false)} />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
}


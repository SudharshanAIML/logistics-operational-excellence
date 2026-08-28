import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_BASE_URL, WS_BASE_URL } from '../config';

export type TabType = 
  | 'command-center' 
  | 'forecast' 
  | 'workforce' 
  | 'efficiency' 
  | 'optimization' 
  | 'alerts' 
  | 'health' 
  | 'admin';

export interface AlertItem {
  alert_id: string;
  timestamp: string;
  process: string;
  zone: string;
  severity: 'risk' | 'watch';
  alert_type: string;
  message: string;
  status: 'active' | 'resolved';
}

interface AppContextType {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  selectedHub: string;
  setSelectedHub: (hub: string) => void;
  selectedShift: string;
  setSelectedShift: (shift: string) => void;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  alerts: AlertItem[];
  setAlerts: React.Dispatch<React.SetStateAction<AlertItem[]>>;
  alertsLoading: boolean;
  privacyFloor: number;
  setPrivacyFloor: (floor: number) => void;
  wsData: any;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<TabType>('command-center');
  const [selectedHub, setSelectedHub] = useState<string>('Hub 402-ATL');
  const [selectedShift, setSelectedShift] = useState<string>('Day');
  const [selectedDate, setSelectedDate] = useState<string>('2026-08-28');
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [alertsLoading, setAlertsLoading] = useState<boolean>(true);
  const [privacyFloor, setPrivacyFloor] = useState<number>(5);
  const [wsData, setWsData] = useState<any>(null);

  // WebSocket Connection
  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimer: any;

    const connectWS = () => {
      ws = new WebSocket(`${WS_BASE_URL}/ws/live`);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'live_telemetry') {
            setWsData(data.metrics);
          }
        } catch (e) {
          console.error("Error parsing WS telemetry:", e);
        }
      };

      ws.onclose = () => {
        console.log("WebSocket telemetry closed, reconnecting...");
        reconnectTimer = setTimeout(connectWS, 3000);
      };

      ws.onerror = (err) => {
        console.error("WebSocket telemetry error:", err);
        ws.close();
      };
    };

    connectWS();

    return () => {
      if (ws) ws.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []);

  // Fetch real alerts - no hardcoded seed data shown while this is in flight
  useEffect(() => {
    setAlertsLoading(true);
    fetch(`${API_BASE_URL}/api/dashboard/summary?date=${selectedDate}`)
      .then(res => res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`)))
      .then(data => {
        setAlerts(data?.alerts ?? []);
      })
      .catch(err => {
        console.error("Error fetching initial alerts:", err);
        setAlerts([]);
      })
      .finally(() => setAlertsLoading(false));
  }, [selectedDate]);

  return (
    <AppContext.Provider value={{
      activeTab,
      setActiveTab,
      selectedHub,
      setSelectedHub,
      selectedShift,
      setSelectedShift,
      selectedDate,
      setSelectedDate,
      alerts,
      setAlerts,
      alertsLoading,
      privacyFloor,
      setPrivacyFloor,
      wsData
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

import React, { useState, useCallback, useEffect } from 'react';
import { sendWorkflowAlert, getProjectTopology } from './services/apiService';
import { WorkflowRequest, LogEntry, ConnectionStatus, AppSettings, Device } from './types';
import { 
  WORKFLOW_UUID, CREATOR_ID, DEFAULT_LAT, DEFAULT_LNG, 
  DEFAULT_LEVEL, DEFAULT_DESC, USER_TOKEN, PROJECT_UUID, API_URL 
} from './constants';
import { StatusBadge } from './components/StatusBadge';
import { ConsoleLog } from './components/ConsoleLog';
import { MapPicker } from './components/MapPicker';
import { SettingsModal } from './components/SettingsModal';
import { DeviceList } from './components/DeviceList';

const App: React.FC = () => {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.IDLE);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Device/Topology State
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  
  // Settings State
  const [appSettings, setAppSettings] = useState<AppSettings>({
    userToken: USER_TOKEN,
    projectUuid: PROJECT_UUID,
    workflowUuid: WORKFLOW_UUID,
    creatorId: CREATOR_ID,
    apiUrl: API_URL
  });

  // Local state for editable fields
  const [latitude, setLatitude] = useState(DEFAULT_LAT);
  const [longitude, setLongitude] = useState(DEFAULT_LNG);
  const [desc, setDesc] = useState(DEFAULT_DESC);
  const [level, setLevel] = useState(DEFAULT_LEVEL);
  const [requesterName, setRequesterName] = useState("");

  const addLog = useCallback((type: LogEntry['type'], message: string, details?: unknown) => {
    const newLog: LogEntry = {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
      details
    };
    setLogs(prev => [...prev, newLog]);
  }, []);

  // Fetch Topology
  const fetchDevices = useCallback(async () => {
    setIsLoadingDevices(true);
    try {
      const response = await getProjectTopology(appSettings);
      if (response && response.data) {
        setDevices(response.data);
        addLog('info', `Topology Updated: ${response.data.length} devices found.`);
        
        if (response.data.length === 0) {
           addLog('info', 'DEBUG: No devices found. Check API console for "Fetching Topology" output.');
        } else {
          // Check for first device structure
          const first = response.data[0];
          if (first.device_sn.startsWith('UNKNOWN')) {
             addLog('error', 'WARNING: Device structure unrecognized. See raw data:', first.raw);
          }
        }
      }
    } catch (error) {
      console.error(error);
      addLog('error', 'Failed to fetch equipment topology', { error: String(error) });
    } finally {
      setIsLoadingDevices(false);
    }
  }, [appSettings, addLog]);

  // Initial Fetch
  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const handleLocationSelect = (lat: number, lng: number) => {
    setLatitude(lat);
    setLongitude(lng);
  };

  const handleTrigger = async () => {
    if (status === ConnectionStatus.SENDING) return;

    setStatus(ConnectionStatus.SENDING);
    
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    const alertName = requesterName.trim() ? requesterName.trim() : `Alert-${timestamp}`;

    const payload: WorkflowRequest = {
      workflow_uuid: appSettings.workflowUuid,
      trigger_type: 0,
      name: alertName,
      params: {
        creator: appSettings.creatorId,
        latitude: latitude,
        longitude: longitude,
        level: level,
        desc: desc
      }
    };

    addLog('request', `Initializing Workflow Trigger: ${alertName}`, payload);

    try {
      const result = await sendWorkflowAlert(payload, appSettings);
      addLog('success', 'Workflow Triggered Successfully', result);
      setStatus(ConnectionStatus.SUCCESS);
    } catch (error: any) {
      console.error(error);
      let errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage === 'Failed to fetch') {
        errorMessage = 'Network Error: Could not reach API (CORS/Offline)';
      }
      addLog('error', 'Transmission Failed', { error: errorMessage });
      setStatus(ConnectionStatus.ERROR);
    } finally {
      setTimeout(() => {
        setStatus(prev => prev === ConnectionStatus.SENDING ? ConnectionStatus.IDLE : prev);
      }, 2000);
    }
  };

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-200 flex flex-col font-sans overflow-hidden">
      
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        settings={appSettings}
        onSave={setAppSettings}
      />

      {/* Compact Header */}
      <header className="bg-slate-900/90 backdrop-blur border-b border-slate-800 px-4 py-2 flex justify-between items-center z-20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center shadow-lg shadow-red-900/50">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white uppercase">FlightHub Command</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={status} />
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Content: Map + Overlays */}
      <main className="flex-1 relative overflow-hidden bg-slate-900">
        
        {/* Full Screen Map */}
        <div className="absolute inset-0 z-0">
          <MapPicker 
            lat={latitude} 
            lng={longitude} 
            onLocationSelect={handleLocationSelect} 
            isMaximized={true} // Always max style
            devices={devices}
          />
        </div>

        {/* LEFT OVERLAY: Device List Sidebar */}
        <div className="absolute top-4 left-4 bottom-4 w-72 z-10 flex flex-col pointer-events-none">
          <DeviceList 
             devices={devices} 
             isLoading={isLoadingDevices} 
             onRefresh={fetchDevices} 
             className="pointer-events-auto h-full"
          />
        </div>

        {/* RIGHT OVERLAY: Control Panel */}
        <div className="absolute top-4 right-4 z-10 w-80 pointer-events-auto">
          <div className="bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-lg shadow-2xl p-4 flex flex-col gap-4">
             <div className="border-b border-slate-800 pb-2">
                <h2 className="text-xs font-bold text-white uppercase tracking-wider">Mission Config</h2>
             </div>
             
             {/* Coords */}
             <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase text-slate-500 font-bold">Lat</label>
                  <input 
                    type="number" 
                    step="0.000001"
                    value={latitude}
                    onChange={(e) => setLatitude(parseFloat(e.target.value))}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-cyan-400 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase text-slate-500 font-bold">Lng</label>
                  <input 
                    type="number" 
                    step="0.000001"
                    value={longitude}
                    onChange={(e) => setLongitude(parseFloat(e.target.value))}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-cyan-400 focus:outline-none focus:border-cyan-500"
                  />
                </div>
             </div>

             <div className="space-y-1">
                <label className="text-[9px] uppercase text-slate-500 font-bold">Requester</label>
                <input 
                  type="text" 
                  value={requesterName}
                  onChange={(e) => setRequesterName(e.target.value)}
                  placeholder="ID / Name"
                  className="w-full bg-slate-900/50 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-cyan-400 focus:outline-none focus:border-cyan-500"
                />
             </div>

             <div className="space-y-1">
              <label className="text-[9px] uppercase text-slate-500 font-bold">Description</label>
              <textarea 
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-red-500 resize-none h-14"
              />
            </div>

            <div className="grid grid-cols-5 gap-1">
                 {[1, 2, 3, 4, 5].map((lvl) => (
                   <button
                    key={lvl}
                    onClick={() => setLevel(lvl)}
                    className={`
                      py-1 rounded font-mono text-xs font-bold border transition-all
                      ${level === lvl 
                        ? 'bg-red-600 border-red-500 text-white' 
                        : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:text-slate-300'
                      }
                    `}
                   >
                     {lvl}
                   </button>
                 ))}
            </div>

            {/* Trigger Button */}
            <button
              onClick={handleTrigger}
              disabled={status === ConnectionStatus.SENDING}
              className={`
                mt-2 relative overflow-hidden group w-full p-3 rounded-lg border transition-all duration-300
                flex items-center justify-center gap-2 shadow-lg
                ${status === ConnectionStatus.SENDING 
                  ? 'bg-slate-800 border-slate-700 cursor-not-allowed opacity-80' 
                  : 'bg-gradient-to-r from-red-600 to-red-800 border-red-500 hover:border-red-400 hover:shadow-red-900/50'
                }
              `}
            >
               {status === ConnectionStatus.SENDING ? (
                 <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
               ) : (
                 <>
                   <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                   <span className="text-sm font-bold tracking-widest text-white uppercase">Transmit Alert</span>
                 </>
               )}
            </button>
          </div>
        </div>

      </main>

      {/* Bottom: Logs */}
      <div className="h-48 border-t border-slate-800 bg-slate-950 shrink-0 z-20">
        <ConsoleLog logs={logs} />
      </div>

    </div>
  );
};

export default App;
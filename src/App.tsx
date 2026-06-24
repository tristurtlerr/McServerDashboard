import { useState, useEffect } from 'react';
import SetupWizard from './components/SetupWizard';
import Dashboard from './components/Dashboard';
import SettingsPage from './components/SettingsPage';
import PlayerDirectory from './components/PlayerDirectory';
import PlayerProfile from './components/PlayerProfile';
import { HardDrive, RefreshCw } from 'lucide-react';

type ViewState = 'loading' | 'wizard' | 'dashboard' | 'settings' | 'directory' | 'profile';

export default function App() {
  const [view, setView] = useState<ViewState>('loading');
  const [installDir, setInstallDir] = useState('');
  const [allocatedRam, setAllocatedRam] = useState(2048);
  const [systemRam, setSystemRam] = useState(8192);
  const [hasJava, setHasJava] = useState(false);
  const [serverStatus, setServerStatus] = useState<'stopped' | 'starting' | 'running'>('stopped');
  const [players, setPlayers] = useState<string[]>([]);
  const [selectedPlayerUuid, setSelectedPlayerUuid] = useState('');
  const [selectedPlayerName, setSelectedPlayerName] = useState('');

  useEffect(() => {
    async function initializeApp() {
      try {
        // 1. Get system specs
        const sysInfo = await window.api.getSystemInfo();
        setSystemRam(sysInfo.totalMemoryMB);
        setHasJava(sysInfo.hasJava);

        // 2. Fetch saved app configuration
        const config = await window.api.getAppConfig();
        
        if (config.installDir) {
          setInstallDir(config.installDir);
          if (config.ramMB) setAllocatedRam(config.ramMB);

          // 3. Verify if server exists in folder
          const installStatus = await window.api.checkServerInstalled(config.installDir);
          if (installStatus.installed) {
            setView('dashboard');
            return;
          }
        }
        
        // If not configured, go to wizard
        setView('wizard');
      } catch (e) {
        console.error('App initialization failed', e);
        setView('wizard');
      }
    }

    initializeApp();

    // Register global event listeners for process status and players
    const unsubscribeStatus = window.api.onServerStatusChange((status) => {
      setServerStatus(status);
    });

    const unsubscribePlayers = window.api.onServerPlayersChange((pList) => {
      setPlayers(pList);
    });

    return () => {
      unsubscribeStatus();
      unsubscribePlayers();
    };
  }, []);

  const handleSetupComplete = (dir: string, ram: number) => {
    setInstallDir(dir);
    setAllocatedRam(ram);
    setView('dashboard');
  };

  const handleSaveSettingsComplete = (newRam: number) => {
    setAllocatedRam(newRam);
  };

  if (view === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0b0c10] text-gray-400">
        <RefreshCw className="h-12 w-12 animate-spin text-green-500 mb-4" />
        <span className="font-press-start text-[10px] tracking-widest text-gray-500 uppercase">
          Initializing Dashboard...
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0b0c10]">
      {/* Premium Top Navigation Bar */}
      <header className="bg-zinc-950/80 border-b border-zinc-800/60 px-6 py-4 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center space-x-3">
          {/* Stylized Pixel Blocks Icon */}
          <div className="grid grid-cols-2 gap-0.5 h-6 w-6">
            <div className="bg-green-700 border border-green-900"></div>
            <div className="bg-green-600 border border-green-800"></div>
            <div className="bg-zinc-700 border border-zinc-900"></div>
            <div className="bg-zinc-600 border border-zinc-800"></div>
          </div>
          <div>
            <h1 className="font-press-start text-[12px] md:text-sm text-yellow-500 tracking-wider font-bold">
              MC SERVER MANAGER
            </h1>
            <p className="text-[9px] text-gray-500 font-mono mt-0.5">LOCAL MANAGEMENT DASHBOARD</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="hidden sm:flex items-center space-x-1.5 text-xs text-gray-400 font-mono">
            <HardDrive className="h-4 w-4 text-gray-500" />
            <span>RAM: {Math.round(systemRam / 1024)}GB</span>
          </div>
          <div className="flex items-center space-x-1.5 text-xs text-gray-400 font-mono">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
            <span>Java: {hasJava ? 'OK' : 'MISSING'}</span>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 p-6 overflow-hidden">
        {view === 'wizard' && (
          <SetupWizard 
            onSetupComplete={handleSetupComplete} 
            systemRam={systemRam}
            hasJava={hasJava}
          />
        )}

        {view === 'dashboard' && (
          <Dashboard
            installDir={installDir}
            allocatedRam={allocatedRam}
            serverStatus={serverStatus}
            players={players}
            onOpenSettings={() => setView('settings')}
            onOpenWizard={() => setView('wizard')}
            onOpenDirectory={() => setView('directory')}
          />
        )}

        {view === 'settings' && (
          <SettingsPage
            installDir={installDir}
            systemRam={systemRam}
            onSaveComplete={handleSaveSettingsComplete}
            onBack={() => setView('dashboard')}
          />
        )}

        {view === 'directory' && (
          <PlayerDirectory
            installDir={installDir}
            onSelectPlayer={(uuid, name) => {
              setSelectedPlayerUuid(uuid);
              setSelectedPlayerName(name);
              setView('profile');
            }}
            onClose={() => setView('dashboard')}
          />
        )}

        {view === 'profile' && (
          <PlayerProfile
            installDir={installDir}
            uuid={selectedPlayerUuid}
            username={selectedPlayerName}
            onBack={() => setView('directory')}
            isOnline={players.includes(selectedPlayerName)}
          />
        )}
      </main>
    </div>
  );
}

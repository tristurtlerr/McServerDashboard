import { useState, useEffect } from 'react';
import SetupWizard from './components/SetupWizard';
import Dashboard from './components/Dashboard';
import SettingsPage from './components/SettingsPage';
import PlayerDirectory from './components/PlayerDirectory';
import PlayerProfile from './components/PlayerProfile';
import Sidebar from './components/Sidebar';
import AddServerModal from './components/AddServerModal';
import { HardDrive, RefreshCw } from 'lucide-react';

type ViewState = 'loading' | 'wizard' | 'dashboard' | 'settings' | 'directory' | 'profile';

interface ServerEntry {
  id: string;
  name: string;
  installDir: string;
  ramMB: number;
}

export default function App() {
  const [view, setView] = useState<ViewState>('loading');
  const [servers, setServers] = useState<ServerEntry[]>([]);
  const [activeServerId, setActiveServerId] = useState<string>('');
  
  const [systemRam, setSystemRam] = useState(8192);
  const [hasJava, setHasJava] = useState(false);

  // Mapped background states
  const [serverStatuses, setServerStatuses] = useState<Record<string, 'stopped' | 'starting' | 'running'>>({});
  const [serverPlayers, setServerPlayers] = useState<Record<string, string[]>>({});
  const [serverStats, setServerStats] = useState<Record<string, { cpu: number; memoryMB: number }>>({});

  const [selectedPlayerUuid, setSelectedPlayerUuid] = useState('');
  const [selectedPlayerName, setSelectedPlayerName] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    async function initializeApp() {
      try {
        // 1. Get system specs
        const sysInfo = await window.api.getSystemInfo();
        setSystemRam(sysInfo.totalMemoryMB);
        setHasJava(sysInfo.hasJava);

        // 2. Fetch saved app configuration
        const config = await window.api.getAppConfig();
        
        if (config.servers && config.servers.length > 0) {
          setServers(config.servers);
          const activeId = config.activeServerId || config.servers[0].id;
          setActiveServerId(activeId);

          // Seed server statuses and active players list from backend to prevent HMR out-of-sync
          const activeStatuses = await window.api.getServerStatuses();
          const activePlayers = await window.api.getServerPlayers();
          
          const initialStatuses: Record<string, 'stopped' | 'starting' | 'running'> = {};
          for (const server of config.servers) {
            initialStatuses[server.id] = activeStatuses[server.id] || 'stopped';
          }
          setServerStatuses(initialStatuses);
          setServerPlayers(activePlayers || {});
          
          setView('dashboard');
          return;
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
    const unsubscribeStatus = window.api.onServerStatusChange((data) => {
      setServerStatuses((prev) => ({ ...prev, [data.serverId]: data.status }));
    });

    const unsubscribePlayers = window.api.onServerPlayersChange((data) => {
      setServerPlayers((prev) => ({ ...prev, [data.serverId]: data.players }));
    });

    const unsubscribeStats = window.api.onServerStats((data) => {
      setServerStats((prev) => ({ ...prev, [data.serverId]: data.stats }));
    });

    return () => {
      unsubscribeStatus();
      unsubscribePlayers();
      unsubscribeStats();
    };
  }, []);

  useEffect(() => {
    if (view === 'wizard') {
      window.api.resizeWindow(1200, 950);
    } else if (view !== 'loading') {
      window.api.resizeWindow(1200, 800);
    }
  }, [view]);

  const handleSetupComplete = async (name: string, dir: string, ram: number) => {
    const newServer = {
      id: Date.now().toString(),
      name,
      installDir: dir,
      ramMB: ram
    };
    const updatedServers = [...servers, newServer];
    setServers(updatedServers);
    setActiveServerId(newServer.id);

    // Seed status
    setServerStatuses((prev) => ({ ...prev, [newServer.id]: 'stopped' }));

    await window.api.saveAppConfig({
      servers: updatedServers,
      activeServerId: newServer.id
    });

    setView('dashboard');
  };

  const handleImportExisting = async (name: string, dir: string, ram: number) => {
    const newServer = {
      id: Date.now().toString(),
      name,
      installDir: dir,
      ramMB: ram
    };
    const updatedServers = [...servers, newServer];
    setServers(updatedServers);
    setActiveServerId(newServer.id);
    setShowAddModal(false);

    // Seed status
    setServerStatuses((prev) => ({ ...prev, [newServer.id]: 'stopped' }));

    await window.api.saveAppConfig({
      servers: updatedServers,
      activeServerId: newServer.id
    });

    setView('dashboard');
  };

  const handleSelectServer = async (id: string) => {
    setActiveServerId(id);
    setView('dashboard'); // Always switch back to dashboard on server switch
    const config = await window.api.getAppConfig();
    await window.api.saveAppConfig({
      ...config,
      activeServerId: id
    });
  };

  const handleSaveSettingsComplete = async (_newRam: number) => {
    const config = await window.api.getAppConfig();
    setServers(config.servers);
  };

  const handleDeleteServer = async (id: string) => {
    if (serverStatuses[id] === 'running' || serverStatuses[id] === 'starting') {
      await window.api.stopServer(id);
    }
    const updatedServers = servers.filter((s) => s.id !== id);
    setServers(updatedServers);
    let nextActiveId = '';
    if (updatedServers.length > 0) {
      nextActiveId = updatedServers[0].id;
      setActiveServerId(nextActiveId);
      setView('dashboard');
    } else {
      setActiveServerId('');
      setView('wizard');
    }
    await window.api.saveAppConfig({
      servers: updatedServers,
      activeServerId: nextActiveId
    });
  };

  const activeServer = servers.find((s) => s.id === activeServerId);
  const installDir = activeServer ? activeServer.installDir : '';
  const allocatedRam = activeServer ? activeServer.ramMB : 2048;
  const serverStatus = activeServer ? (serverStatuses[activeServer.id] || 'stopped') : 'stopped';
  const players = activeServer ? (serverPlayers[activeServer.id] || []) : [];

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
    <div className="h-screen flex flex-col bg-[#0b0c10] overflow-hidden">
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

      {/* Sidebar + Main Content Layout Container */}
      <div className="flex-1 flex overflow-hidden">
        {view !== 'wizard' && servers.length > 0 && (
          <Sidebar
            servers={servers}
            activeServerId={activeServerId}
            serverStatuses={serverStatuses}
            serverStats={serverStats}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            onSelectServer={handleSelectServer}
            onAddServer={() => setShowAddModal(true)}
          />
        )}

        {/* Main Content Body */}
        <main className="flex-1 p-6 overflow-hidden flex flex-col font-mono">
          {view === 'wizard' && (
            <SetupWizard 
              onSetupComplete={handleSetupComplete} 
              systemRam={systemRam}
              hasJava={hasJava}
              onCancel={servers.length > 0 ? () => setView('dashboard') : undefined}
              isFirstServer={servers.length === 0}
            />
          )}

          {view === 'dashboard' && activeServer && (
            <Dashboard
              serverId={activeServerId}
              installDir={installDir}
              allocatedRam={allocatedRam}
              serverStatus={serverStatus}
              players={players}
              onOpenSettings={() => setView('settings')}
              onOpenWizard={() => setView('wizard')}
              onOpenDirectory={() => setView('directory')}
            />
          )}

          {view === 'settings' && activeServer && (
            <SettingsPage
              serverId={activeServerId}
              installDir={installDir}
              systemRam={systemRam}
              onSaveComplete={handleSaveSettingsComplete}
              onBack={() => setView('dashboard')}
              onDeleteServer={handleDeleteServer}
            />
          )}

          {view === 'directory' && activeServer && (
            <PlayerDirectory
              serverId={activeServerId}
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

      {/* Add Server Modal Overlay */}
      {showAddModal && (
        <AddServerModal
          onClose={() => setShowAddModal(false)}
          onInstallNew={() => {
            setShowAddModal(false);
            setView('wizard');
          }}
          onImportExisting={handleImportExisting}
          systemRam={systemRam}
        />
      )}
    </div>
  );
}

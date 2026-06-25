import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, RotateCcw, Settings, Terminal, Users, ChevronRight, HardDrive, RefreshCw, UserX, Ban, Cpu, Activity, Package } from 'lucide-react';
import EulaModal from './EulaModal';

interface DashboardProps {
  serverId: string;
  installDir: string;
  allocatedRam: number;
  serverStatus: 'stopped' | 'starting' | 'running';
  players: string[];
  serverType?: 'vanilla' | 'fabric';
  onOpenSettings: () => void;
  onOpenWizard: () => void;
  onOpenDirectory: () => void;
  onOpenMods: () => void;
}

export default function Dashboard({
  serverId,
  installDir,
  allocatedRam,
  serverStatus,
  players,
  serverType,
  onOpenSettings,
  onOpenWizard,
  onOpenDirectory,
  onOpenMods
}: DashboardProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [command, setCommand] = useState('');
  const [showEulaModal, setShowEulaModal] = useState(false);
  const [stats, setStats] = useState({ cpu: 0, memoryMB: 0 });
  const [confirmAction, setConfirmAction] = useState<{ type: 'kick' | 'ban', playerName: string } | null>(null);
  
  // Command History
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Set up listeners for logs, status, and stats
  useEffect(() => {
    // Clear logs on mount
    setLogs([`[Dashboard]: Connected. Server directory: ${installDir}`]);

    const unsubscribeLog = window.api.onServerLog((data) => {
      if (data.serverId === serverId) {
        setLogs((prev) => [...prev, data.line]);
      }
    });

    const unsubscribeError = window.api.onServerError((data) => {
      if (data.serverId === serverId) {
        setLogs((prev) => [...prev, `[Dashboard Error]: ${data.error}`]);
      }
    });

    const unsubscribeStats = window.api.onServerStats((data) => {
      if (data.serverId === serverId) {
        setStats(data.stats);
      }
    });

    return () => {
      unsubscribeLog();
      unsubscribeError();
      unsubscribeStats();
    };
  }, [installDir, serverId]);

  // Auto-scroll logic
  useEffect(() => {
    if (autoScroll && consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // Handle user manual scroll to disable auto scroll if they scroll up
  const handleScroll = () => {
    if (!logContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current;
    // If user is within 50px of bottom, keep auto-scroll enabled
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  };

  const handleStart = async () => {
    const isEulaAccepted = await window.api.checkEulaStatus(installDir);
    if (!isEulaAccepted) {
      setShowEulaModal(true);
      return;
    }
    runServer();
  };

  const runServer = async () => {
    setLogs((prev) => [...prev, '[Dashboard]: Starting Minecraft server process...']);
    const result = await window.api.startServer({ serverId, installDir, ramMB: allocatedRam });
    if (!result.success) {
      setLogs((prev) => [...prev, `[Dashboard Error]: Failed to start server: ${result.error}`]);
    }
  };

  const handleConfirmPlayerAction = async () => {
    if (!confirmAction) return;
    const { type, playerName } = confirmAction;
    
    // Execute kick/ban command in-game
    await window.api.sendServerCommand(serverId, `${type} ${playerName}`);
    setLogs((prev) => [...prev, `[Dashboard]: Executing Command: /${type} ${playerName}`]);
    setConfirmAction(null);
  };

  const handleAcceptEula = async () => {
    setShowEulaModal(false);
    setLogs((prev) => [...prev, '[Dashboard]: EULA accepted. Modifying eula.txt...']);
    const success = await window.api.acceptEula(installDir);
    if (success) {
      runServer();
    } else {
      setLogs((prev) => [...prev, '[Dashboard Error]: Failed to write EULA file. Check file permissions.']);
    }
  };

  const handleDeclineEula = () => {
    setShowEulaModal(false);
    setLogs((prev) => [...prev, '[Dashboard]: Server start cancelled. You must accept the EULA to play.']);
  };

  const handleStop = async () => {
    setLogs((prev) => [...prev, '[Dashboard]: Sending stop command to server...']);
    const result = await window.api.stopServer(serverId);
    if (!result.success) {
      setLogs((prev) => [...prev, `[Dashboard Error]: Failed to stop server: ${result.error}`]);
    }
  };

  const handleRestart = async () => {
    setLogs((prev) => [...prev, '[Dashboard]: Restarting server...']);
    await window.api.stopServer(serverId);
    let started = false;
    const unsub = window.api.onServerStatusChange((data) => {
      if (data.serverId === serverId && data.status === 'stopped' && !started) {
        started = true;
        unsub();
        window.api.startServer({ serverId, installDir, ramMB: allocatedRam });
      }
    });
  };

  const handleSendCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim()) return;

    const cmd = command.trim();
    // Clear input
    setCommand('');
    
    // Add to history
    const newHistory = [cmd, ...commandHistory.filter(h => h !== cmd)].slice(0, 50);
    setCommandHistory(newHistory);
    setHistoryIndex(-1);

    await window.api.sendServerCommand(serverId, cmd);
  };

  // Keyboard navigation for command history
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        const nextIndex = historyIndex + 1;
        setHistoryIndex(nextIndex);
        setCommand(commandHistory[nextIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const nextIndex = historyIndex - 1;
        setHistoryIndex(nextIndex);
        setCommand(commandHistory[nextIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCommand('');
      }
    }
  };

  // Color coordinate logs
  const getLogLineStyle = (line: string) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('>')) {
      return 'text-yellow-400 font-bold'; // Sent command
    }
    if (trimmed.includes('[Server thread/WARN]') || trimmed.toLowerCase().includes('warn')) {
      return 'text-orange-400';
    }
    if (trimmed.includes('[Server thread/ERROR]') || trimmed.toLowerCase().includes('error') || trimmed.startsWith('[Dashboard Error]')) {
      return 'text-red-400 font-medium';
    }
    if (trimmed.startsWith('[Dashboard]')) {
      return 'text-sky-400 font-medium';
    }
    if (trimmed.includes('joined the game') || trimmed.includes('logged in with entity id')) {
      return 'text-green-400 font-medium';
    }
    if (trimmed.includes('left the game')) {
      return 'text-rose-400 font-medium';
    }
    return 'text-gray-300';
  };

  // Get human readable status label
  const getStatusDetails = () => {
    switch (serverStatus) {
      case 'running':
        return { label: 'Online', colorClass: 'bg-green-500 shadow-green-500/50', borderClass: 'border-green-500/30' };
      case 'starting':
        return { label: 'Starting', colorClass: 'bg-orange-500 shadow-orange-500/50 animate-pulse', borderClass: 'border-orange-500/30' };
      default:
        return { label: 'Offline', colorClass: 'bg-red-500 shadow-red-500/50', borderClass: 'border-red-500/30' };
    }
  };

  const status = getStatusDetails();

  return (
    <div className="space-y-6 flex flex-col flex-1 min-h-0">
      
      {/* Top Controller Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-800 pb-4 shrink-0">
        
        {/* Status Indicator */}
        <div className="flex items-center space-x-4">
          <div className={`flex items-center space-x-2 border px-3 py-1.5 rounded-full bg-zinc-950/80 ${status.borderClass}`}>
            <span className={`h-2.5 w-2.5 rounded-full ${status.colorClass} shadow-md`}></span>
            <span className="font-press-start text-[10px] text-gray-300 uppercase tracking-wide">
              {status.label}
            </span>
          </div>
          <div className="text-xs text-gray-400 font-mono hidden lg:block">
            <span className="text-gray-500">Dir: </span>{installDir}
          </div>
        </div>

        {/* Buttons Controls */}
        <div className="flex flex-wrap gap-2 items-center">
          <button
            onClick={handleStart}
            disabled={serverStatus !== 'stopped'}
            className="mcraft-btn mcraft-btn-green px-4 py-2 flex items-center"
          >
            <Play className="h-4 w-4 mr-2 fill-current" />
            Start
          </button>
          
          <button
            onClick={handleStop}
            disabled={serverStatus === 'stopped'}
            className="mcraft-btn mcraft-btn-red px-4 py-2 flex items-center"
          >
            <Square className="h-4 w-4 mr-2 fill-current" />
            Stop
          </button>
          
          <button
            onClick={handleRestart}
            disabled={serverStatus !== 'running'}
            className="mcraft-btn px-4 py-2 flex items-center"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Restart
          </button>

          <span className="w-px h-6 bg-gray-850 mx-2 hidden sm:inline"></span>
          
          <button
            onClick={onOpenSettings}
            disabled={serverStatus !== 'stopped'}
            className="mcraft-btn px-4 py-2 flex items-center"
            title="Settings (Only configurable when server is stopped)"
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </button>
          
          <button
            onClick={onOpenWizard}
            disabled={serverStatus !== 'stopped'}
            className="mcraft-btn px-4 py-2 flex items-center"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reinstall
          </button>

          {serverType === 'fabric' && (
            <button
              onClick={onOpenMods}
              className="mcraft-btn px-4 py-2 flex items-center text-purple-400 border-purple-800 hover:border-purple-600"
            >
              <Package className="h-4 w-4 mr-2" />
              Mods
            </button>
          )}
        </div>
      </div>

      {/* Main Panel Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
        
        {/* Live Console Output Terminal (left 3 columns) */}
        <div className="lg:col-span-3 flex flex-col mcraft-panel h-full min-h-0 overflow-hidden relative">
          
          {/* Console Header */}
          <div className="bg-zinc-950 border-b border-gray-800 px-4 py-2 flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-2">
              <Terminal className="h-4 w-4 text-green-500" />
              <span className="font-press-start text-[10px] uppercase text-gray-400">Server Console</span>
            </div>
            <div className="text-[10px] text-gray-500 font-mono">
              Auto-Scroll: {autoScroll ? 'ON' : 'OFF'}
            </div>
          </div>

          {/* Logs Viewport */}
          <div 
            ref={logContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-4 space-y-1 console-container scrollbar"
          >
            {logs.map((log, index) => (
              <div 
                key={index} 
                className={`text-xs font-mono break-all whitespace-pre-wrap leading-relaxed ${getLogLineStyle(log)}`}
              >
                {log}
              </div>
            ))}
            <div ref={consoleEndRef} />
          </div>

          {/* Command Input Bar */}
          <form 
            onSubmit={handleSendCommand} 
            className="border-t border-gray-800 bg-zinc-950 px-4 py-3 flex items-center space-x-2 shrink-0"
          >
            <ChevronRight className="h-4 w-4 text-green-500 shrink-0" />
            <input
              type="text"
              placeholder={
                serverStatus === 'running' 
                  ? "Type command here (e.g. say Hello, op player)..." 
                  : "Server is not running. Commands disabled."
              }
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={serverStatus !== 'running'}
              className="flex-1 bg-transparent text-xs font-mono text-gray-100 outline-none border-none placeholder-zinc-700 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={serverStatus !== 'running' || !command.trim()}
              className="mcraft-btn px-4 py-1.5 text-[9px] shrink-0"
            >
              Send
            </button>
          </form>
        </div>

        {/* Sidebar Info & Players (right 1 column) */}
        <div className="flex flex-col space-y-6 h-full min-h-0 overflow-y-auto">
          
          {/* Players Card */}
          <div className="mcraft-panel p-4 flex flex-col shrink-0">
            <button
              onClick={onOpenDirectory}
              className="mcraft-btn w-full py-2.5 mb-3 flex items-center justify-center text-xs tracking-wider shrink-0"
              title="Open players database"
            >
              <Users className="h-4 w-4 mr-2 text-green-500" />
              PLAYERS ({players.length})
            </button>
            
            {players.length === 0 ? (
              <div className="py-6 text-center text-gray-500 text-xs italic font-mono bg-zinc-950/40 rounded border border-zinc-900">
                No players online
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                {players.map((player) => (
                  <div 
                    key={player} 
                    className="flex items-center justify-between p-2 bg-zinc-950/60 rounded border border-zinc-900 hover:bg-zinc-950 transition-colors group"
                  >
                    <div className="flex items-center space-x-3 truncate">
                      <img 
                        src={`https://mc-heads.net/avatar/${player}/32`}
                        alt={player}
                        onError={(e) => {
                          e.currentTarget.src = 'https://minotar.net/avatar/char/32';
                        }}
                        className="h-8 w-8 rounded shrink-0 border border-zinc-800 bg-zinc-900"
                      />
                      <span className="text-xs font-mono text-gray-200 font-semibold truncate">{player}</span>
                    </div>
                    
                    {/* Action buttons (kick / ban) */}
                    <div className="flex items-center space-x-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setConfirmAction({ type: 'kick', playerName: player })}
                        disabled={serverStatus !== 'running'}
                        className="p-1 text-orange-400 hover:text-orange-300 hover:bg-zinc-800 rounded disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                        title={`Kick ${player}`}
                      >
                        <UserX className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setConfirmAction({ type: 'ban', playerName: player })}
                        disabled={serverStatus !== 'running'}
                        className="p-1 text-red-500 hover:text-red-400 hover:bg-zinc-800 rounded disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                        title={`Ban ${player}`}
                      >
                        <Ban className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Server Performance Details */}
          <div className="mcraft-panel p-4 space-y-4 flex-1">
            <h3 className="text-xs font-press-start font-bold text-blue-400 border-b border-gray-800 pb-2 flex items-center uppercase">
              <Activity className="h-4 w-4 mr-2" />
              Performance
            </h3>

            <div className="space-y-4 font-mono text-xs">
              {/* CPU Usage */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-gray-400">
                  <span className="flex items-center">
                    <Cpu className="h-3.5 w-3.5 mr-1.5 text-zinc-500" />
                    CPU Usage:
                  </span>
                  <span className="font-semibold text-green-400">{serverStatus === 'running' ? `${stats.cpu}%` : '0%'}</span>
                </div>
                <div className="w-full bg-black border border-zinc-850 h-3 p-0.5 rounded-sm">
                  <div 
                    className="bg-green-600 h-full transition-all duration-500 rounded-sm"
                    style={{ width: `${serverStatus === 'running' ? Math.min(stats.cpu, 100) : 0}%` }}
                  ></div>
                </div>
              </div>

              {/* RAM Usage */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-gray-400">
                  <span className="flex items-center">
                    <HardDrive className="h-3.5 w-3.5 mr-1.5 text-zinc-500" />
                    RAM Usage:
                  </span>
                  <span className="font-semibold text-green-400">
                    {serverStatus === 'running' ? `${stats.memoryMB} MB` : '0 MB'}
                    <span className="text-[10px] text-gray-500 font-normal font-sans"> / {allocatedRam} MB</span>
                  </span>
                </div>
                <div className="w-full bg-black border border-zinc-850 h-3 p-0.5 rounded-sm">
                  <div 
                    className="bg-green-600 h-full transition-all duration-500 rounded-sm"
                    style={{ width: `${serverStatus === 'running' ? Math.min((stats.memoryMB / allocatedRam) * 100, 100) : 0}%` }}
                  ></div>
                </div>
              </div>

              <div className="pt-2">
                <div className="bg-zinc-900/60 rounded p-2.5 border border-zinc-800/80 flex items-start space-x-2 text-[10px] leading-relaxed text-gray-400">
                  <HardDrive className="h-3.5 w-3.5 text-yellow-600 shrink-0 mt-0.5" />
                  <span>
                    To connect, join <code className="bg-black px-1.5 py-0.5 rounded text-yellow-500">localhost</code> in the Minecraft client.
                  </span>
                </div>
              </div>
            </div>
          </div>
          
        </div>
      </div>

      <EulaModal 
        isOpen={showEulaModal} 
        onAccept={handleAcceptEula} 
        onDecline={handleDeclineEula} 
      />

      {/* Kick/Ban Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-sm mcraft-panel p-6 shadow-2xl relative">
            <h3 className="font-press-start text-[11px] text-red-500 uppercase tracking-wider mb-4 flex items-center">
              <Ban className="h-4 w-4 mr-2" />
              Confirm {confirmAction.type}
            </h3>
            <p className="text-sm text-gray-300 mb-6">
              Are you sure you want to <strong className="text-white uppercase">{confirmAction.type}</strong> player <strong className="text-yellow-500 font-mono">{confirmAction.playerName}</strong>?
            </p>
            <div className="flex space-x-3 justify-end pt-4 border-t border-gray-800">
              <button
                onClick={() => setConfirmAction(null)}
                className="mcraft-btn px-4 py-2"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPlayerAction}
                className="mcraft-btn mcraft-btn-red px-4 py-2"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { ChevronLeft, ChevronRight, Plus, Cpu, HardDrive } from 'lucide-react';

interface ServerEntry {
  id: string;
  name: string;
  installDir: string;
  ramMB: number;
}

interface SidebarProps {
  servers: ServerEntry[];
  activeServerId: string;
  serverStatuses: Record<string, 'stopped' | 'starting' | 'running'>;
  serverStats: Record<string, { cpu: number; memoryMB: number }>;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onSelectServer: (id: string) => void;
  onAddServer: () => void;
}

export default function Sidebar({
  servers,
  activeServerId,
  serverStatuses,
  serverStats,
  collapsed,
  onToggleCollapse,
  onSelectServer,
  onAddServer
}: SidebarProps) {
  // Helper to extract initials for collapsed server badges
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .slice(0, 2)
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase() || 'S';
  };

  return (
    <aside
      className={`bg-zinc-950/95 border-r border-zinc-900 flex flex-col transition-all duration-300 select-none shrink-0 ${
        collapsed ? 'w-18' : 'w-64'
      }`}
    >
      {/* Sidebar Header */}
      <div className="p-4 border-b border-zinc-900 flex items-center justify-between">
        {!collapsed && (
          <span className="font-press-start text-[10px] tracking-wider text-gray-400 uppercase">
            Servers
          </span>
        )}
        <button
          onClick={onToggleCollapse}
          className="mcraft-btn p-1.5 mx-auto lg:mx-0 hover:bg-zinc-900 rounded"
          title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Servers List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar">
        {servers.map((server) => {
          const isActive = server.id === activeServerId;
          const status = serverStatuses[server.id] || 'stopped';
          const stats = serverStats[server.id] || { cpu: 0, memoryMB: 0 };
          const initials = getInitials(server.name);

          return (
            <div
              key={server.id}
              onClick={() => onSelectServer(server.id)}
              className={`group flex items-center gap-3 p-2 rounded cursor-pointer border-2 transition-all select-none ${
                isActive
                  ? 'bg-zinc-900/80 border-yellow-600/80'
                  : 'bg-zinc-950 border-transparent hover:bg-zinc-900/40 hover:border-zinc-850'
              }`}
            >
              {/* Server Badge / Icon block */}
              <div
                className={`w-10 h-10 rounded shrink-0 flex items-center justify-center relative font-press-start text-[11px] font-bold border-2 transition-all ${
                  isActive
                    ? 'bg-gradient-to-br from-yellow-600 to-yellow-800 border-yellow-500 text-zinc-950'
                    : 'bg-gradient-to-br from-zinc-800 to-zinc-900 border-zinc-700 text-gray-300'
                }`}
              >
                {initials}

                {/* Status indicator pulse dot */}
                <span
                  className={`absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-zinc-950 flex items-center justify-center ${
                    status === 'running'
                      ? 'bg-green-500 animate-pulse'
                      : status === 'starting'
                      ? 'bg-amber-500'
                      : 'bg-zinc-500'
                  }`}
                  title={`Status: ${status}`}
                ></span>
              </div>

              {/* Full details when sidebar expanded */}
              {!collapsed && (
                <div className="flex-1 min-w-0 font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-200 truncate font-semibold block">
                      {server.name}
                    </span>
                  </div>
                  
                  {/* Status label / stats monitor inline */}
                  <div className="mt-0.5 flex items-center justify-between text-[10px] text-zinc-500">
                    <span className="capitalize">{status}</span>
                    {status === 'running' && (
                      <span className="text-[9px] text-green-400 font-sans flex items-center gap-1.5">
                        <Cpu className="h-2.5 w-2.5" /> {stats.cpu}%
                        <HardDrive className="h-2.5 w-2.5" /> {stats.memoryMB}M
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add New Server Footer Button */}
      <div className="p-3 border-t border-zinc-900 shrink-0">
        <button
          onClick={onAddServer}
          className="mcraft-btn w-full py-2.5 flex items-center justify-center gap-2"
          title="Add New Server"
        >
          <Plus className="h-4 w-4" />
          {!collapsed && <span className="font-press-start text-[8px] uppercase tracking-wider">Add Server</span>}
        </button>
      </div>
    </aside>
  );
}

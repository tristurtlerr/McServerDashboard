import { useState, useEffect } from 'react';
import { Search, RefreshCw, ChevronRight, ArrowLeft, Users, Circle } from 'lucide-react';

interface Player {
  uuid: string;
  name: string;
  online: boolean;
}

interface PlayerDirectoryProps {
  installDir: string;
  onSelectPlayer: (uuid: string, name: string) => void;
  onClose: () => void;
}

export default function PlayerDirectory({ installDir, onSelectPlayer, onClose }: PlayerDirectoryProps) {
  const [playersList, setPlayersList] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');

  const fetchPlayers = async () => {
    try {
      setLoading(true);
      const list = await window.api.getAllPlayers(installDir);
      setPlayersList(list);
    } catch (e) {
      console.error('Failed to get historical players list', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayers();
  }, [installDir]);

  const filteredPlayers = playersList.filter(player => {
    const matchesSearch = player.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          player.uuid.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (statusFilter === 'online') return matchesSearch && player.online;
    if (statusFilter === 'offline') return matchesSearch && !player.online;
    return matchesSearch;
  });

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 flex flex-col h-[calc(100vh-100px)]">
      
      {/* Header */}
      <div className="flex justify-between items-center border-b border-gray-800 pb-3 shrink-0">
        <div className="flex items-center space-x-3">
          <button
            onClick={onClose}
            className="mcraft-btn p-2 mr-2"
            title="Back to Dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h2 className="font-press-start text-sm text-yellow-500 uppercase tracking-wider flex items-center">
              <Users className="h-4.5 w-4.5 mr-2 text-green-500" />
              Players Database
            </h2>
            <p className="text-[10px] text-gray-500 font-mono mt-1">All registered player profiles scanned from world files</p>
          </div>
        </div>
        <button
          onClick={fetchPlayers}
          disabled={loading}
          className="mcraft-btn px-4 py-2 flex items-center"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Reload
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="mcraft-panel p-4 flex flex-col md:flex-row items-center justify-between gap-4 shrink-0">
        {/* Status Filters */}
        <div className="flex bg-zinc-950 border border-zinc-850 p-1 rounded w-full md:w-auto">
          {(['all', 'online', 'offline'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-3 py-1 text-[10px] font-press-start uppercase transition-colors rounded-sm ${
                statusFilter === filter
                  ? 'bg-zinc-800 text-yellow-400'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Text Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search username or UUID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-850 rounded pl-9 pr-3 py-2 text-xs text-gray-200 outline-none focus:border-green-500 font-mono"
          />
        </div>
      </div>

      {/* Main Players Grid List */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <RefreshCw className="h-10 w-10 animate-spin text-green-500 mb-4" />
            <span className="font-mono text-xs text-gray-500">Scanning World Database...</span>
          </div>
        ) : filteredPlayers.length === 0 ? (
          <div className="text-center py-20 text-gray-500 text-xs italic font-mono mcraft-panel">
            No player entries found in database.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPlayers.map((player) => (
              <div
                key={player.uuid}
                onClick={() => onSelectPlayer(player.uuid, player.name)}
                className="mcraft-panel p-4 hover:bg-zinc-900/60 transition-colors border border-zinc-850 hover:border-zinc-700 cursor-pointer flex items-center justify-between group"
              >
                <div className="flex items-center space-x-3 truncate">
                  <img
                    src={`https://mc-heads.net/avatar/${player.name}/40`}
                    alt={player.name}
                    onError={(e) => {
                      e.currentTarget.src = 'https://minotar.net/avatar/char/40';
                    }}
                    className="h-10 w-10 rounded border border-zinc-800 bg-zinc-950 shrink-0"
                  />
                  <div className="truncate">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-mono font-bold text-gray-200 group-hover:text-yellow-400 transition-colors truncate">
                        {player.name}
                      </span>
                      {player.online ? (
                        <Circle className="h-2 w-2 fill-green-500 text-green-500 shrink-0 animate-pulse" />
                      ) : null}
                    </div>
                    <span className="text-[9px] font-mono text-gray-500 block truncate mt-0.5">{player.uuid}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0 pl-2">
                  <span className={`text-[8px] font-press-start px-2 py-1 rounded-sm ${
                    player.online 
                      ? 'bg-green-950/40 text-green-400 border border-green-800/40' 
                      : 'bg-zinc-950 text-zinc-500 border border-zinc-900'
                  }`}>
                    {player.online ? 'Online' : 'Offline'}
                  </span>
                  <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-yellow-500 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { ArrowLeft, RefreshCw, Activity, ShieldAlert, Award, Terminal, Heart, Compass, AlertTriangle, Swords, Skull, Hammer } from 'lucide-react';

interface PlayerProfileProps {
  installDir: string;
  uuid: string;
  username: string;
  onBack: () => void;
  isOnline: boolean;
}

interface Item {
  id: string;
  count: number;
  slot: number;
}

// Helper to map inventory slots
function getInventoryMap(items: Item[]) {
  const map: Record<number, Item> = {};
  for (const item of items) {
    map[item.slot] = item;
  }
  return map;
}

// Ghost Icon SVGs for empty slots
const HelmetIcon = () => (
  <svg className="w-5 h-5 fill-none stroke-current" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M4 10v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6a8 8 0 0 0-16 0z" />
    <path d="M12 2v3" />
  </svg>
);

const ChestplateIcon = () => (
  <svg className="w-5 h-5 fill-none stroke-current" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M5 3h3l1.5 3h5L16 3h3v7a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V3z" />
  </svg>
);

const LeggingsIcon = () => (
  <svg className="w-5 h-5 fill-none stroke-current" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M6 3h12v10h-5v8h-2v-8H6V3z" />
  </svg>
);

const BootsIcon = () => (
  <svg className="w-5 h-5 fill-none stroke-current" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M4 4v11a2 2 0 0 0 2 2h3v3H4m16-16v11a2 2 0 0 1-2 2h-3v3h5" />
  </svg>
);

const OffhandIcon = () => (
  <svg className="w-5 h-5 fill-none stroke-current" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

// Individual visual inventory slot
function InventorySlot({ item, ghostIcon }: { item?: Item; ghostIcon?: React.ReactNode }) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [fallbackTried, setFallbackTried] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (item) {
      setImgSrc(`https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.20.4/assets/minecraft/textures/item/${item.id}.png`);
      setFallbackTried(false);
      setFailed(false);
    } else {
      setImgSrc(null);
    }
  }, [item]);

  const handleError = () => {
    if (!fallbackTried && item) {
      setFallbackTried(true);
      setImgSrc(`https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.20.4/assets/minecraft/textures/block/${item.id}.png`);
    } else {
      setFailed(true);
    }
  };

  const formatItemName = (id: string) => {
    return id
      .replace(/_/g, ' ')
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  return (
    <div className="w-12 h-12 bg-zinc-950/80 border-2 border-t-zinc-900 border-l-zinc-900 border-b-zinc-800 border-r-zinc-800 rounded flex items-center justify-center relative hover:bg-zinc-900 hover:border-b-zinc-750 hover:border-r-zinc-750 transition-colors group cursor-help select-none">
      {item && imgSrc && !failed ? (
        <img
          src={imgSrc}
          alt={item.id}
          onError={handleError}
          className="w-7 h-7 object-contain"
          style={{ imageRendering: 'pixelated' }}
        />
      ) : item ? (
        <div className="w-8 h-8 rounded bg-zinc-900 border border-zinc-850 flex items-center justify-center text-[9px] font-mono text-zinc-500 font-bold uppercase select-none">
          {item.id.slice(0, 2)}
        </div>
      ) : (
        <div className="text-zinc-800/50">{ghostIcon}</div>
      )}

      {item && item.count > 1 && (
        <span className="absolute bottom-0.5 right-1 text-[9px] font-press-start text-yellow-500 text-shadow select-none pointer-events-none">
          {item.count}
        </span>
      )}

      {item && (
        <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 z-50 pointer-events-none whitespace-nowrap bg-zinc-950 border-2 border-purple-900/80 px-2.5 py-1.5 rounded shadow-[0_0_20px_rgba(0,0,0,0.8)]">
          <div className="text-xs font-mono font-bold text-gray-200">{formatItemName(item.id)}</div>
          <div className="text-[9px] font-mono text-zinc-500 mt-0.5">ID: minecraft:{item.id}</div>
          <div className="text-[9px] font-mono text-yellow-500/80 mt-0.5">Count: {item.count}</div>
        </div>
      )}
    </div>
  );
}

interface ProfileData {
  nbt: {
    pos: [number, number, number];
    rotation: [number, number];
    dimension: string;
    xpLevel: number;
    xpProgress: number;
    health: number;
    hunger: number;
    gamemode: string;
    effects: Array<{ id: string; amplifier: number; duration: number }>;
    inventory: Item[];
    enderchest: Item[];
    lastLogout: string;
  } | null;
  stats: {
    walkDistance: number;
    flyDistance: number;
    swimDistance: number;
    minedBlocks: number;
    kills: number;
    deaths: number;
    chestsOpened: number;
    diamondsMined: number;
  } | null;
  advancements: Array<{ id: string; name: string; time: string }>;
  logs: string[];
}

type ProfileTab = 'stats' | 'inventory' | 'advancements' | 'logs';

export default function PlayerProfile({ installDir, uuid, username, onBack, isOnline }: PlayerProfileProps) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ProfileTab>('stats');
  const [inventoryTab, setInventoryTab] = useState<'survival' | 'ender'>('survival');

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const data = await window.api.getPlayerProfile(installDir, uuid, username);
      setProfile(data);
    } catch (e) {
      console.error('Failed to query player details profile', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [uuid, installDir]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 text-gray-400">
        <RefreshCw className="h-10 w-10 animate-spin text-green-500 mb-4" />
        <span className="font-mono text-xs text-gray-500">Decompressing NBT & Analysing Player Statistics...</span>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-20 text-red-500 font-mono mcraft-panel p-6">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        Failed to resolve data files for {username}. Player may not have logged in yet.
        <button onClick={onBack} className="mcraft-btn px-4 py-2 mt-6 block mx-auto">
          Go Back
        </button>
      </div>
    );
  }

  // Anti-cheat analysis logic
  const isSuspiciousFly = (profile.stats?.flyDistance || 0) > 100000 && profile.nbt?.gamemode !== 'Creative';
  const diamondRatio = profile.stats?.minedBlocks 
    ? (profile.stats.diamondsMined / profile.stats.minedBlocks) * 100 
    : 0;
  const isSuspiciousMiner = diamondRatio > 6 && (profile.stats?.minedBlocks || 0) > 100;

  // Format date helper
  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleString();
  };



  const inventoryMap = getInventoryMap(profile.nbt?.inventory || []);
  const enderChestMap = getInventoryMap(profile.nbt?.enderchest || []);



  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 flex flex-col flex-1 min-h-0">
      
      {/* Profile Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-4 shrink-0">
        <div className="flex items-center space-x-4">
          <button onClick={onBack} className="mcraft-btn p-2" title="Back to Directory">
            <ArrowLeft className="h-4 w-4" />
          </button>
          
          <img
            src={`https://mc-heads.net/avatar/${username}/48`}
            alt={username}
            onError={(e) => {
              e.currentTarget.src = 'https://minotar.net/avatar/char/48';
            }}
            className="h-12 w-12 rounded border border-zinc-800 bg-zinc-950"
          />
          
          <div>
            <h2 className="text-lg font-mono font-bold text-gray-100 flex items-center">
              {username}
              <span className="text-[10px] text-gray-500 font-normal font-sans ml-3 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 select-all">
                {uuid}
              </span>
            </h2>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-[10px] font-mono text-zinc-400">
              <span className={`px-1.5 py-0.5 rounded-sm ${
                profile.nbt?.dimension === 'Nether' 
                  ? 'bg-red-950/40 text-red-400 border border-red-900/40' 
                  : profile.nbt?.dimension === 'End' 
                  ? 'bg-purple-950/40 text-purple-400 border border-purple-900/40' 
                  : 'bg-green-950/40 text-green-400 border border-green-900/40'
              }`}>
                Dim: {profile.nbt?.dimension || 'Overworld'}
              </span>
              <span>•</span>
              <span className="text-zinc-500">{isOnline ? 'Status: ' : 'Logout: '}</span>
              <span className={isOnline ? 'text-green-400 font-bold font-mono' : ''}>
                {isOnline ? 'Currently Online' : (profile.nbt ? formatDate(profile.nbt.lastLogout) : 'N/A')}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Quick flags for anti-cheat warning alerts */}
          {(isSuspiciousFly || isSuspiciousMiner) && (
            <div className="flex items-center space-x-1 border border-red-900/30 px-3 py-1.5 rounded bg-red-950/20 text-red-400 text-xs font-mono">
              <AlertTriangle className="h-4 w-4 animate-pulse shrink-0" />
              <span>SUSPICIOUS ACTIVITES</span>
            </div>
          )}
          
          <button
            onClick={fetchProfile}
            className="mcraft-btn px-4 py-2 flex items-center"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-gray-850 bg-zinc-950/40 p-1 rounded shrink-0">
        {(['stats', 'inventory', 'advancements', 'logs'] as ProfileTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 px-3 text-xs font-press-start uppercase transition-colors rounded border-2 border-transparent ${
              activeTab === tab 
                ? 'bg-zinc-800 border-zinc-700 text-yellow-500' 
                : 'text-gray-400 hover:text-gray-300 hover:bg-zinc-900/40'
            }`}
          >
            {tab === 'stats' && 'Overview & Stats'}
            {tab === 'inventory' && 'Inventory Items'}
            {tab === 'advancements' && 'Advancements'}
            {tab === 'logs' && 'Player Logs'}
          </button>
        ))}
      </div>

      {/* Viewport content */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        
        {/* OVERVIEW & STATS TAB */}
        {activeTab === 'stats' && (
          <div className="space-y-6">
            
            {/* Suspicious Alerts Flag Banner */}
            {(isSuspiciousFly || isSuspiciousMiner) && (
              <div className="p-4 bg-red-950/30 border-2 border-red-700 rounded text-red-200 space-y-2">
                <h4 className="font-bold flex items-center text-xs font-press-start">
                  <ShieldAlert className="h-5 w-5 mr-2 text-red-500" />
                  Anti-Cheat Warnings Detected
                </h4>
                <ul className="list-disc list-inside text-xs text-red-300 space-y-1 pl-1 font-mono">
                  {isSuspiciousFly && (
                    <li>
                      Extreme flight distance: <strong>{(profile.stats!.flyDistance / 1000).toFixed(2)} km</strong> walked/flown under non-creative mode.
                    </li>
                  )}
                  {isSuspiciousMiner && (
                    <li>
                      Abnormally high diamond mining yield: <strong>{diamondRatio.toFixed(1)}%</strong> of all mined blocks are diamonds ({profile.stats!.diamondsMined} of {profile.stats!.minedBlocks} blocks). Standard ratio is &lt;2%.
                    </li>
                  )}
                </ul>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Left Column: Player Health, Hunger, Position Status */}
              <div className="md:col-span-1 space-y-6">
                
                {/* Health & Hunger Panel */}
                <div className="mcraft-panel p-5 space-y-4">
                  <h3 className="text-xs font-bold font-press-start text-red-500 border-b border-gray-800 pb-2 flex items-center uppercase">
                    <Heart className="h-4 w-4 mr-2" />
                    Life Stats
                  </h3>

                  <div className="space-y-3 font-mono text-xs">
                    {/* Health meter */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-gray-400">
                        <span>Health:</span>
                        <span className="text-red-400 font-bold">{profile.nbt ? `${profile.nbt.health} / 20` : 'N/A'}</span>
                      </div>
                      <div className="w-full bg-black border border-zinc-800 h-2.5 p-0.5 rounded-sm">
                        <div 
                          className="bg-red-600 h-full rounded-sm"
                          style={{ width: `${profile.nbt ? (profile.nbt.health / 20) * 100 : 0}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Hunger meter */}
                    <div className="space-y-1 mt-3">
                      <div className="flex justify-between items-center text-gray-400">
                        <span>Hunger:</span>
                        <span className="text-amber-500 font-bold">{profile.nbt ? `${profile.nbt.hunger} / 20` : 'N/A'}</span>
                      </div>
                      <div className="w-full bg-black border border-zinc-800 h-2.5 p-0.5 rounded-sm">
                        <div 
                          className="bg-amber-600 h-full rounded-sm"
                          style={{ width: `${profile.nbt ? (profile.nbt.hunger / 20) * 100 : 0}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* XP Level */}
                    <div className="space-y-1 mt-3 border-t border-zinc-900 pt-3 flex justify-between">
                      <span className="text-gray-500">XP Level:</span>
                      <span className="text-green-400 font-bold font-press-start text-[10px]">Lvl {profile.nbt?.xpLevel || 0}</span>
                    </div>

                    {/* Gamemode */}
                    <div className="flex justify-between border-b border-zinc-900 pb-1.5 mt-2">
                      <span className="text-gray-500">Gamemode:</span>
                      <span className="text-gray-300 font-bold">{profile.nbt?.gamemode || 'Survival'}</span>
                    </div>
                  </div>
                </div>

                {/* Location Coordinates Panel */}
                <div className="mcraft-panel p-5 space-y-4">
                  <h3 className="text-xs font-bold font-press-start text-blue-400 border-b border-gray-800 pb-2 flex items-center uppercase">
                    <Compass className="h-4 w-4 mr-2" />
                    Position Coordinates
                  </h3>
                  
                  {profile.nbt ? (
                    <div className="space-y-2 font-mono text-xs">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-zinc-950 p-2 border border-zinc-900 rounded text-center">
                          <span className="text-zinc-500 block text-[9px]">X</span>
                          <span className="text-red-400 font-bold">{profile.nbt.pos[0]}</span>
                        </div>
                        <div className="bg-zinc-950 p-2 border border-zinc-900 rounded text-center">
                          <span className="text-zinc-500 block text-[9px]">Y</span>
                          <span className="text-green-400 font-bold">{profile.nbt.pos[1]}</span>
                        </div>
                        <div className="bg-zinc-950 p-2 border border-zinc-900 rounded text-center">
                          <span className="text-zinc-500 block text-[9px]">Z</span>
                          <span className="text-blue-400 font-bold">{profile.nbt.pos[2]}</span>
                        </div>
                      </div>
                      <div className="text-[10px] text-zinc-500 text-center mt-2">
                        Dimension: <strong className="text-gray-300">{profile.nbt.dimension}</strong>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 font-mono italic text-center py-4">
                      Location not available
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Player Stats grid */}
              <div className="md:col-span-2 space-y-6">
                <div className="mcraft-panel p-5 space-y-4">
                  <h3 className="text-xs font-bold font-press-start text-yellow-500 border-b border-gray-800 pb-2 flex items-center uppercase">
                    <Activity className="h-4 w-4 mr-2" />
                    Game Metrics & Stats
                  </h3>

                  {profile.stats ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
                      {/* Walk Distance */}
                      <div className="p-3 bg-zinc-950/40 border border-zinc-850 rounded flex justify-between items-center">
                        <span className="text-gray-500">Walk Distance:</span>
                        <span className="text-gray-200 font-semibold">
                          {profile.stats.walkDistance >= 1000 
                            ? `${(profile.stats.walkDistance / 1000).toFixed(2)} km` 
                            : `${profile.stats.walkDistance} m`}
                        </span>
                      </div>

                      {/* Fly Distance */}
                      <div className={`p-3 bg-zinc-950/40 border rounded flex justify-between items-center ${
                        isSuspiciousFly ? 'border-red-900/40 bg-red-950/5' : 'border-zinc-850'
                      }`}>
                        <span className="text-gray-500">Fly Distance:</span>
                        <span className={`font-semibold ${isSuspiciousFly ? 'text-red-400 font-bold' : 'text-gray-200'}`}>
                          {profile.stats.flyDistance >= 1000 
                            ? `${(profile.stats.flyDistance / 1000).toFixed(2)} km` 
                            : `${profile.stats.flyDistance} m`}
                        </span>
                      </div>

                      {/* Mined Blocks */}
                      <div className="p-3 bg-zinc-950/40 border border-zinc-850 rounded flex justify-between items-center">
                        <span className="text-gray-500 flex items-center">
                          <Hammer className="h-3.5 w-3.5 text-zinc-500 mr-1.5" />
                          Blocks Mined:
                        </span>
                        <span className="text-gray-200 font-semibold">{profile.stats.minedBlocks}</span>
                      </div>

                      {/* Diamonds Mined */}
                      <div className={`p-3 bg-zinc-950/40 border rounded flex justify-between items-center ${
                        isSuspiciousMiner ? 'border-red-900/40 bg-red-950/5' : 'border-zinc-850'
                      }`}>
                        <span className="text-gray-500 flex items-center">
                          <Compass className="h-3.5 w-3.5 text-cyan-500 mr-1.5 animate-pulse" />
                          Diamonds Mined:
                        </span>
                        <span className={`font-bold ${isSuspiciousMiner ? 'text-red-400 font-bold' : 'text-cyan-400'}`}>
                          {profile.stats.diamondsMined} 
                          <span className="text-[10px] text-gray-500 font-normal font-sans ml-1">({diamondRatio.toFixed(1)}%)</span>
                        </span>
                      </div>

                      {/* Mob Kills */}
                      <div className="p-3 bg-zinc-950/40 border border-zinc-850 rounded flex justify-between items-center">
                        <span className="text-gray-500 flex items-center">
                          <Swords className="h-3.5 w-3.5 text-zinc-500 mr-1.5" />
                          Mob/Player Kills:
                        </span>
                        <span className="text-gray-200 font-semibold">{profile.stats.kills}</span>
                      </div>

                      {/* Deaths */}
                      <div className="p-3 bg-zinc-950/40 border border-zinc-850 rounded flex justify-between items-center">
                        <span className="text-gray-500 flex items-center">
                          <Skull className="h-3.5 w-3.5 text-zinc-500 mr-1.5" />
                          Deaths:
                        </span>
                        <span className="text-gray-200 font-semibold">{profile.stats.deaths}</span>
                      </div>

                      {/* Chests Opened */}
                      <div className="p-3 bg-zinc-950/40 border border-zinc-850 rounded flex justify-between items-center sm:col-span-2">
                        <span className="text-gray-500">Chests Opened:</span>
                        <span className="text-gray-200 font-semibold">{profile.stats.chestsOpened}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 font-mono italic text-center py-10">
                      Game statistics JSON file not found for this UUID.
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* INVENTORY TAB */}
        {activeTab === 'inventory' && (
          <div className="space-y-6">
            {/* Nested tabs to switch between Survival Inventory and Ender Chest */}
            <div className="flex space-x-2 border-b border-zinc-800 pb-2 shrink-0 select-none">
              <button
                onClick={() => setInventoryTab('survival')}
                className={`px-4 py-1.5 text-[9px] font-press-start rounded transition-all border-2 ${
                  inventoryTab === 'survival'
                    ? 'bg-green-950/40 text-green-400 border-green-800'
                    : 'text-gray-400 hover:text-gray-300 hover:bg-zinc-900 border-transparent'
                }`}
              >
                Survival Inventory
              </button>
              <button
                onClick={() => setInventoryTab('ender')}
                className={`px-4 py-1.5 text-[9px] font-press-start rounded transition-all border-2 ${
                  inventoryTab === 'ender'
                    ? 'bg-purple-950/40 text-purple-400 border-purple-800'
                    : 'text-gray-400 hover:text-gray-300 hover:bg-zinc-900 border-transparent'
                }`}
              >
                Ender Chest
              </button>
            </div>

            {inventoryTab === 'survival' ? (
              <div className="flex flex-col lg:flex-row gap-8 items-center lg:items-start justify-center p-6 bg-zinc-950/40 border border-zinc-900 rounded">
                
                {/* Left: Armor & Character layout */}
                <div className="flex gap-6 items-center bg-zinc-900/40 p-5 border border-zinc-900 rounded">
                  {/* Armor slots column */}
                  <div className="flex flex-col gap-1.5">
                    <InventorySlot item={inventoryMap[103]} ghostIcon={<HelmetIcon />} />
                    <InventorySlot item={inventoryMap[102]} ghostIcon={<ChestplateIcon />} />
                    <InventorySlot item={inventoryMap[101]} ghostIcon={<LeggingsIcon />} />
                    <InventorySlot item={inventoryMap[100]} ghostIcon={<BootsIcon />} />
                  </div>

                  {/* Character avatar box */}
                  <div className="flex flex-col items-center justify-center bg-zinc-950 border border-zinc-850 rounded p-4 w-32 h-52 relative shadow-inner">
                    <img
                      src={`https://mc-heads.net/body/${username}/120`}
                      alt={username}
                      onError={(e) => {
                        e.currentTarget.src = 'https://minotar.net/armor/body/char/120';
                      }}
                      className="h-40 object-contain select-none"
                    />
                    <div className="absolute bottom-2.5 right-2.5">
                      <InventorySlot item={inventoryMap[-106]} ghostIcon={<OffhandIcon />} />
                    </div>
                  </div>
                </div>

                {/* Right: Main Inventory & Hotbar */}
                <div className="space-y-4">
                  {/* Main Inventory 3x9 Grid */}
                  <div className="space-y-1.5 bg-zinc-900/30 p-4 border border-zinc-900 rounded">
                    <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest ml-1 mb-1 font-bold">Main Inventory</div>
                    <div className="grid grid-cols-9 gap-1.5">
                      {Array.from({ length: 27 }).map((_, idx) => {
                        const slotNum = idx + 9;
                        return <InventorySlot key={slotNum} item={inventoryMap[slotNum]} />;
                      })}
                    </div>
                  </div>

                  {/* Hotbar 1x9 Grid */}
                  <div className="space-y-1.5 bg-zinc-900/50 p-4 border border-zinc-850 rounded shadow-lg">
                    <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest ml-1 mb-1 font-bold">Hotbar</div>
                    <div className="grid grid-cols-9 gap-1.5">
                      {Array.from({ length: 9 }).map((_, idx) => {
                        const slotNum = idx;
                        return <InventorySlot key={slotNum} item={inventoryMap[slotNum]} />;
                      })}
                    </div>
                  </div>
                </div>

              </div>
            ) : (
              /* Ender Chest Grid */
              <div className="flex flex-col items-center p-6 bg-zinc-950/40 border border-zinc-900 rounded">
                <div className="space-y-1.5 bg-zinc-900/40 p-5 border border-zinc-850 rounded">
                  <div className="text-[9px] font-mono text-purple-400 uppercase tracking-widest ml-1 mb-2 font-bold flex items-center">
                    <span className="w-2 h-2 bg-purple-500 rounded-full mr-2 animate-pulse"></span>
                    Ender Chest Storage
                  </div>
                  <div className="grid grid-cols-9 gap-1.5">
                    {Array.from({ length: 27 }).map((_, idx) => {
                      const slotNum = idx;
                      return <InventorySlot key={slotNum} item={enderChestMap[slotNum]} />;
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ADVANCEMENTS TIMELINE TAB */}
        {activeTab === 'advancements' && (
          <div className="mcraft-panel p-5 space-y-4">
            <h3 className="text-xs font-bold font-press-start text-green-500 border-b border-gray-800 pb-2 flex items-center uppercase">
              <Award className="h-4.5 w-4.5 mr-2 text-green-500" />
              Achievements Unlock Timeline
            </h3>

            {profile.advancements.length === 0 ? (
              <div className="text-center py-20 text-gray-500 text-xs italic font-mono">
                No achievements unlocked yet.
              </div>
            ) : (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto p-2 scrollbar">
                {profile.advancements.map((adv, idx) => (
                  <div key={adv.id} className="relative flex space-x-3 items-start border-l border-zinc-800 pb-4 pl-4 last:pb-0">
                    <span className="absolute -left-1.5 top-1.5 h-3.5 w-3.5 rounded-full border border-green-500 bg-zinc-950 flex items-center justify-center text-[7px] text-green-400 font-mono">
                      {idx + 1}
                    </span>
                    <div className="flex-1 font-mono text-xs">
                      <div className="flex flex-col sm:flex-row sm:justify-between">
                        <span className="font-bold text-yellow-400">{adv.name}</span>
                        <span className="text-[10px] text-gray-500">{formatDate(adv.time)}</span>
                      </div>
                      <span className="text-[9px] text-gray-600 block select-all mt-0.5">{adv.id}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* LOG HISTORY TAB */}
        {activeTab === 'logs' && (
          <div className="flex flex-col mcraft-panel h-[60vh] overflow-hidden">
            <div className="bg-zinc-950 border-b border-gray-850 px-4 py-2 flex items-center shrink-0">
              <Terminal className="h-4 w-4 text-green-500 mr-2" />
              <span className="font-press-start text-[9px] text-gray-400 uppercase">Filtered Logs History ({profile.logs.length})</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-1 console-container scrollbar">
              {profile.logs.length === 0 ? (
                <div className="text-center py-10 text-gray-600 text-xs italic">
                  No logged statements found matching player {username} in latest.log
                </div>
              ) : (
                profile.logs.map((line, idx) => (
                  <div key={idx} className="text-xs font-mono break-all whitespace-pre-wrap leading-relaxed text-gray-300">
                    {line}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

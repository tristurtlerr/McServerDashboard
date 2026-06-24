import React, { useState, useEffect } from 'react';
import { Save, RefreshCw, CheckCircle, Sliders, Shield, Network, UserPlus, Info, Users, Search, Trash2, ShieldCheck, Cpu, HardDrive } from 'lucide-react';

interface SettingsPageProps {
  installDir: string;
  systemRam: number;
  onSaveComplete: (newRam: number) => void;
  onBack: () => void;
}

type TabType = 'basic' | 'advanced' | 'whitelist' | 'specs';

export default function SettingsPage({ installDir, systemRam, onSaveComplete, onBack }: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState<TabType>('basic');
  const [ramAllocation, setRamAllocation] = useState(2048);
  const [properties, setProperties] = useState<Record<string, string>>({});
  const [whitelist, setWhitelist] = useState<string[]>([]);
  const [newWhitelistName, setNewWhitelistName] = useState('');
  const [advancedSearch, setAdvancedSearch] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [whitelistMsg, setWhitelistMsg] = useState('');

  const loadSettingsAndWhitelist = async () => {
    try {
      setLoading(true);
      // Load app config for RAM
      const config = await window.api.getAppConfig();
      if (config.ramMB) setRamAllocation(config.ramMB);

      // Load server properties
      const props = await window.api.readProperties(installDir);
      setProperties(props);

      // Load whitelist players
      const wList = await window.api.readWhitelist(installDir);
      setWhitelist(wList);
    } catch (err) {
      console.error('Failed to load settings', err);
      setErrorMsg('Failed to load server configurations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettingsAndWhitelist();
  }, [installDir]);

  const handlePropertyChange = (key: string, value: string) => {
    setProperties(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSaveProperties = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      // 1. Save RAM to App Config
      await window.api.saveAppConfig({ installDir, ramMB: ramAllocation });

      // 2. Save configurations to server.properties
      const saveResult = await window.api.writeProperties(installDir, properties);

      if (saveResult.success) {
        setSuccessMsg('Configurations saved successfully!');
        onSaveComplete(ramAllocation);
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        setErrorMsg(saveResult.error || 'Failed to save properties.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddWhitelist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWhitelistName.trim()) return;

    const name = newWhitelistName.trim();
    setNewWhitelistName('');
    setWhitelistMsg('');

    try {
      const res = await window.api.addToWhitelist(installDir, name);
      if (res.success) {
        setWhitelist(prev => [...prev.filter(n => n.toLowerCase() !== name.toLowerCase()), name]);
        setWhitelistMsg(`Added ${name} to whitelist`);
        
        // Make sure white-list is turned on in settings to make it effective
        if (properties['white-list'] !== 'true') {
          handlePropertyChange('white-list', 'true');
          setWhitelistMsg(`Added ${name} to whitelist and enabled whitelist mode`);
        }
        
        setTimeout(() => setWhitelistMsg(''), 4000);
      } else {
        setErrorMsg(res.error || 'Failed to add player to whitelist.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error editing whitelist.');
    }
  };

  const handleRemoveWhitelist = async (name: string) => {
    setWhitelistMsg('');
    try {
      const res = await window.api.removeFromWhitelist(installDir, name);
      if (res.success) {
        setWhitelist(prev => prev.filter(n => n.toLowerCase() !== name.toLowerCase()));
        setWhitelistMsg(`Removed ${name} from whitelist`);
        setTimeout(() => setWhitelistMsg(''), 4000);
      } else {
        setErrorMsg(res.error || 'Failed to remove player from whitelist.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error editing whitelist.');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 py-12">
        <RefreshCw className="h-10 w-10 animate-spin text-green-500 mb-4" />
        <span className="font-mono text-xs text-gray-500">Loading Server Configurations...</span>
      </div>
    );
  }

  // Properties handled in Basic tab
  const basicKeys = [
    'gamemode', 'difficulty', 'hardcore', 'server-port', 
    'online-mode', 'max-players', 'allow-flight', 'view-distance'
  ];

  // Filter properties for advanced view
  const filteredAdvancedProps = Object.entries(properties).filter(([key]) => {
    const isBasic = basicKeys.includes(key);
    const matchesSearch = key.toLowerCase().includes(advancedSearch.toLowerCase()) || 
                          properties[key].toLowerCase().includes(advancedSearch.toLowerCase());
    return !isBasic && matchesSearch;
  }).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 flex flex-col h-[calc(100vh-100px)]">
      
      {/* Top Header */}
      <div className="flex justify-between items-center border-b border-gray-800 pb-3 shrink-0">
        <div>
          <h2 className="font-press-start text-sm text-yellow-500 uppercase tracking-wider">
            Server Settings
          </h2>
          <p className="text-[10px] text-gray-500 font-mono mt-1">Configure allocation parameters and server.properties</p>
        </div>
        <button
          onClick={onBack}
          className="mcraft-btn px-4 py-2"
        >
          Back to Dashboard
        </button>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-gray-850 bg-zinc-950/40 p-1 rounded shrink-0">
        {(['basic', 'advanced', 'whitelist', 'specs'] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 px-3 text-xs font-press-start uppercase transition-colors text-center border-2 border-transparent ${
              activeTab === tab 
                ? 'bg-zinc-800 border-zinc-700 text-yellow-500' 
                : 'text-gray-400 hover:text-gray-300 hover:bg-zinc-900/40'
            }`}
          >
            {tab === 'basic' && 'Basic Settings'}
            {tab === 'advanced' && 'Advanced'}
            {tab === 'whitelist' && 'Whitelist'}
            {tab === 'specs' && 'System Specs'}
          </button>
        ))}
      </div>

      {/* Tab Contents Viewport */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        
        {/* BASIC SETTINGS TAB */}
        {activeTab === 'basic' && (
          <form onSubmit={handleSaveProperties} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* RAM Allocation Card */}
              <div className="mcraft-panel p-5 space-y-4">
                <h3 className="text-xs font-bold font-press-start text-green-500 border-b border-gray-800 pb-2 flex items-center uppercase">
                  <Sliders className="h-4 w-4 mr-2" />
                  Performance
                </h3>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-400">Allocated RAM</span>
                    <span className="text-xs font-mono text-green-400 font-bold">
                      {ramAllocation >= 1024
                        ? `${(ramAllocation / 1024).toFixed(1)} GB`
                        : `${ramAllocation} MB`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="512"
                    max={systemRam}
                    step="256"
                    value={ramAllocation}
                    onChange={(e) => setRamAllocation(parseInt(e.target.value, 10))}
                    className="w-full accent-green-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-gray-500 font-mono">
                    <span>Min: 512 MB</span>
                    <span>System Max: {(systemRam / 1024).toFixed(1)} GB</span>
                  </div>
                </div>
                
                {/* View Distance */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-400">View Distance (Chunks)</label>
                  <input
                    type="number"
                    min="3"
                    max="32"
                    value={properties['view-distance'] || '10'}
                    onChange={(e) => handlePropertyChange('view-distance', e.target.value)}
                    className="w-full bg-zinc-905 border-2 border-zinc-800 rounded px-3 py-1.5 text-xs text-gray-200 outline-none focus:border-green-500 font-mono"
                  />
                </div>
              </div>

              {/* Gameplay Card */}
              <div className="mcraft-panel p-5 space-y-4">
                <h3 className="text-xs font-bold font-press-start text-blue-400 border-b border-gray-800 pb-2 flex items-center uppercase">
                  <Shield className="h-4 w-4 mr-2" />
                  Gameplay
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-gray-400">Gamemode</label>
                    <select
                      value={properties['gamemode'] || 'survival'}
                      onChange={(e) => handlePropertyChange('gamemode', e.target.value)}
                      className="w-full bg-zinc-905 border-2 border-zinc-800 rounded px-2 py-1.5 text-xs text-gray-205 outline-none focus:border-green-500 font-mono"
                    >
                      <option value="survival">Survival</option>
                      <option value="creative">Creative</option>
                      <option value="adventure">Adventure</option>
                      <option value="spectator">Spectator</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-gray-400">Difficulty</label>
                    <select
                      value={properties['difficulty'] || 'easy'}
                      onChange={(e) => handlePropertyChange('difficulty', e.target.value)}
                      className="w-full bg-zinc-905 border-2 border-zinc-800 rounded px-2 py-1.5 text-xs text-gray-205 outline-none focus:border-green-500 font-mono"
                    >
                      <option value="peaceful">Peaceful</option>
                      <option value="easy">Easy</option>
                      <option value="normal">Normal</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between p-2 bg-zinc-950/40 rounded border border-zinc-850">
                  <div>
                    <span className="text-xs font-bold text-gray-300 block">Hardcore Mode</span>
                    <span className="text-[9px] text-gray-500 font-sans">Locks difficulty to Hard, one life</span>
                  </div>
                  <select
                    value={properties['hardcore'] || 'false'}
                    onChange={(e) => handlePropertyChange('hardcore', e.target.value)}
                    className="bg-zinc-905 border-2 border-zinc-800 rounded px-2 py-1 text-xs text-gray-205 font-mono"
                  >
                    <option value="false">False</option>
                    <option value="true">True</option>
                  </select>
                </div>
              </div>

              {/* Network Card */}
              <div className="mcraft-panel p-5 space-y-4">
                <h3 className="text-xs font-bold font-press-start text-yellow-500 border-b border-gray-800 pb-2 flex items-center uppercase">
                  <Network className="h-4 w-4 mr-2" />
                  Network
                </h3>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-400">Server Port</label>
                  <input
                    type="number"
                    min="1"
                    max="65535"
                    value={properties['server-port'] || '25565'}
                    onChange={(e) => handlePropertyChange('server-port', e.target.value)}
                    className="w-full bg-zinc-905 border-2 border-zinc-800 rounded px-3 py-1.5 text-xs text-gray-205 outline-none focus:border-green-500 font-mono"
                    required
                  />
                </div>

                <div className="flex items-center justify-between p-2 bg-zinc-950/40 rounded border border-zinc-850">
                  <div>
                    <span className="text-xs font-bold text-gray-300 block">Online Mode</span>
                    <span className="text-[9px] text-gray-500 font-sans">Requires premium Mojang account validation</span>
                  </div>
                  <select
                    value={properties['online-mode'] || 'true'}
                    onChange={(e) => handlePropertyChange('online-mode', e.target.value)}
                    className="bg-zinc-905 border-2 border-zinc-800 rounded px-2 py-1 text-xs text-gray-205 font-mono"
                  >
                    <option value="true">True</option>
                    <option value="false">False</option>
                  </select>
                </div>
              </div>

              {/* Limits Card */}
              <div className="mcraft-panel p-5 space-y-4">
                <h3 className="text-xs font-bold font-press-start text-purple-400 border-b border-gray-800 pb-2 flex items-center uppercase">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Limits
                </h3>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-400">Max Players</label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={properties['max-players'] || '20'}
                    onChange={(e) => handlePropertyChange('max-players', e.target.value)}
                    className="w-full bg-zinc-905 border-2 border-zinc-800 rounded px-3 py-1.5 text-xs text-gray-205 outline-none focus:border-green-500 font-mono"
                    required
                  />
                </div>

                <div className="flex items-center justify-between p-2 bg-zinc-950/40 rounded border border-zinc-850">
                  <div>
                    <span className="text-xs font-bold text-gray-300 block">Allow Flight</span>
                    <span className="text-[9px] text-gray-500 font-sans">Kick players who fly (survival mode checks)</span>
                  </div>
                  <select
                    value={properties['allow-flight'] || 'false'}
                    onChange={(e) => handlePropertyChange('allow-flight', e.target.value)}
                    className="bg-zinc-905 border-2 border-zinc-800 rounded px-2 py-1 text-xs text-gray-205 font-mono"
                  >
                    <option value="false">False</option>
                    <option value="true">True</option>
                  </select>
                </div>
              </div>
              
            </div>

            {/* Notifications */}
            {successMsg && (
              <div className="p-3 bg-green-950/60 border-2 border-green-700 text-green-200 text-xs rounded flex items-center">
                <CheckCircle className="h-4 w-4 mr-2 text-green-500 shrink-0" />
                {successMsg}
              </div>
            )}
            {errorMsg && (
              <div className="p-3 bg-red-950/60 border border-red-700 text-red-200 text-xs rounded">
                {errorMsg}
              </div>
            )}

            {/* Save Buttons */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-850">
              <button
                type="submit"
                disabled={saving}
                className="mcraft-btn mcraft-btn-green px-6 py-2.5 flex items-center"
              >
                {saving ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save Basic Settings
              </button>
            </div>
          </form>
        )}

        {/* ADVANCED SETTINGS TAB */}
        {activeTab === 'advanced' && (
          <form onSubmit={handleSaveProperties} className="space-y-4">
            
            {/* Search and header */}
            <div className="mcraft-panel p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center space-x-2 text-xs font-mono text-zinc-400">
                <Sliders className="h-4 w-4 text-green-500" />
                <span>Showing {filteredAdvancedProps.length} properties</span>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search properties..."
                  value={advancedSearch}
                  onChange={(e) => setAdvancedSearch(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded pl-9 pr-3 py-1.5 text-xs text-gray-250 outline-none focus:border-green-500 font-mono"
                />
              </div>
            </div>

            {/* Properties dynamic list */}
            <div className="mcraft-panel p-4 space-y-4 max-h-[50vh] overflow-y-auto scrollbar">
              {filteredAdvancedProps.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-xs font-mono">
                  No properties match your filter.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredAdvancedProps.map(([key, val]) => {
                    const isBool = val === 'true' || val === 'false';
                    return (
                      <div key={key} className="p-3 bg-zinc-950/40 rounded border border-zinc-850 flex flex-col justify-between space-y-2">
                        <span className="text-xs font-mono text-yellow-500 font-semibold truncate" title={key}>
                          {key}
                        </span>
                        
                        {isBool ? (
                          <select
                            value={val}
                            onChange={(e) => handlePropertyChange(key, e.target.value)}
                            className="w-full bg-zinc-905 border border-zinc-800 rounded px-2 py-1 text-xs text-gray-205 font-mono"
                          >
                            <option value="true">true</option>
                            <option value="false">false</option>
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={val}
                            onChange={(e) => handlePropertyChange(key, e.target.value)}
                            className="w-full bg-zinc-905 border border-zinc-800 rounded px-2 py-1 text-xs text-gray-205 font-mono"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Notifications */}
            {successMsg && (
              <div className="p-3 bg-green-950/60 border-2 border-green-700 text-green-200 text-xs rounded flex items-center">
                <CheckCircle className="h-4 w-4 mr-2 text-green-500 shrink-0" />
                {successMsg}
              </div>
            )}
            {errorMsg && (
              <div className="p-3 bg-red-950/60 border border-red-700 text-red-200 text-xs rounded">
                {errorMsg}
              </div>
            )}

            {/* Save Buttons */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-850">
              <button
                type="submit"
                disabled={saving}
                className="mcraft-btn mcraft-btn-green px-6 py-2.5 flex items-center"
              >
                {saving ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save Advanced Settings
              </button>
            </div>
          </form>
        )}

        {/* WHITELIST MANAGER TAB */}
        {activeTab === 'whitelist' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Whitelist Toggle Configuration */}
              <div className="md:col-span-1 space-y-4">
                <div className="mcraft-panel p-5 space-y-4">
                  <h3 className="text-xs font-bold font-press-start text-yellow-500 border-b border-gray-800 pb-2 flex items-center uppercase">
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    Whitelist Mode
                  </h3>

                  <div className="flex flex-col space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-300">Whitelist Enabled</span>
                      <button
                        type="button"
                        onClick={async () => {
                          const newStatus = properties['white-list'] === 'true' ? 'false' : 'true';
                          handlePropertyChange('white-list', newStatus);
                          
                          // Auto save this specific property immediately to make toggle snappy
                          setSaving(true);
                          await window.api.writeProperties(installDir, { ...properties, 'white-list': newStatus });
                          setSaving(false);
                          setSuccessMsg(`Whitelist mode set to ${newStatus}`);
                          setTimeout(() => setSuccessMsg(''), 3000);
                        }}
                        className={`mcraft-btn px-3 py-1.5 text-[9px] ${
                          properties['white-list'] === 'true' ? 'mcraft-btn-green' : 'mcraft-btn-red'
                        }`}
                      >
                        {properties['white-list'] === 'true' ? 'ENABLED' : 'DISABLED'}
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-500 font-sans leading-relaxed">
                      When enabled, only players in the whitelist file will be allowed to connect to the server.
                    </p>
                  </div>
                </div>
              </div>

              {/* Whitelist Players List Editor */}
              <div className="md:col-span-2 space-y-4">
                <div className="mcraft-panel p-5 space-y-4 flex flex-col h-full min-h-0">
                  <h3 className="text-xs font-bold font-press-start text-green-500 border-b border-gray-800 pb-2 flex items-center uppercase shrink-0">
                    <Users className="h-4 w-4 mr-2" />
                    Whitelisted Players ({whitelist.length})
                  </h3>

                  {/* Add Form */}
                  <form onSubmit={handleAddWhitelist} className="flex gap-2 shrink-0">
                    <input
                      type="text"
                      placeholder="Enter Minecraft username..."
                      value={newWhitelistName}
                      onChange={(e) => setNewWhitelistName(e.target.value)}
                      className="flex-1 bg-zinc-950 border-2 border-zinc-800 rounded px-3 py-1.5 text-xs text-gray-200 outline-none focus:border-green-500 font-mono"
                    />
                    <button
                      type="submit"
                      disabled={!newWhitelistName.trim()}
                      className="mcraft-btn mcraft-btn-green px-4 py-1.5 text-[10px] shrink-0"
                    >
                      Add Player
                    </button>
                  </form>

                  {/* Notification label */}
                  {whitelistMsg && (
                    <div className="text-[10px] text-green-400 font-mono shrink-0">
                      {whitelistMsg}
                    </div>
                  )}

                  {/* Whitelist scrolling container */}
                  <div className="flex-1 overflow-y-auto max-h-[40vh] border border-zinc-850 bg-zinc-950/20 p-2 rounded scrollbar">
                    {whitelist.length === 0 ? (
                      <div className="text-center py-10 text-gray-500 text-xs italic font-mono">
                        Whitelist is empty
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {whitelist.map((player) => (
                          <div 
                            key={player} 
                            className="flex items-center justify-between p-2 bg-zinc-950/60 rounded border border-zinc-850 hover:bg-zinc-950/80 transition-colors"
                          >
                            <div className="flex items-center space-x-2 truncate">
                              <img 
                                src={`https://mc-heads.net/avatar/${player}/24`}
                                alt={player}
                                onError={(e) => {
                                  e.currentTarget.src = 'https://minotar.net/avatar/char/24';
                                }}
                                className="h-6 w-6 rounded border border-zinc-800"
                              />
                              <span className="text-xs font-mono text-gray-300 font-semibold truncate">{player}</span>
                            </div>
                            
                            <button
                              type="button"
                              onClick={() => handleRemoveWhitelist(player)}
                              className="p-1 text-red-500 hover:text-red-400 hover:bg-zinc-800 rounded cursor-pointer"
                              title={`Remove ${player}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
            </div>
          </div>
        )}

        {/* SYSTEM SPECS TAB (Moved from Dashboard) */}
        {activeTab === 'specs' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* System Resources specifications */}
            <div className="md:col-span-2 space-y-4">
              <div className="mcraft-panel p-5 space-y-4">
                <h3 className="text-xs font-bold font-press-start text-blue-400 border-b border-gray-800 pb-2 flex items-center uppercase">
                  <Info className="h-4 w-4 mr-2" />
                  System Specs Summary
                </h3>

                <div className="space-y-4 font-mono text-xs">
                  
                  <div className="flex justify-between border-b border-zinc-900 pb-2">
                    <span className="text-gray-500">Total System Memory:</span>
                    <span className="text-gray-300 font-semibold">{(systemRam / 1024).toFixed(1)} GB ({systemRam} MB)</span>
                  </div>

                  <div className="flex justify-between border-b border-zinc-900 pb-2">
                    <span className="text-gray-500">Allocated Server Memory:</span>
                    <span className="text-gray-300 font-semibold">{(ramAllocation / 1024).toFixed(1)} GB ({ramAllocation} MB)</span>
                  </div>

                  <div className="flex justify-between border-b border-zinc-900 pb-2">
                    <span className="text-gray-500">Minecraft Engine Type:</span>
                    <span className="text-gray-300 capitalize">
                      {installDir.toLowerCase().includes('fabric') ? 'Fabric Engine' : 'Vanilla (Standard)'}
                    </span>
                  </div>

                  <div className="flex justify-between border-b border-zinc-900 pb-2">
                    <span className="text-gray-500">Java JRE Status:</span>
                    <span className="text-green-500 font-semibold">Configured (Available in PATH)</span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-gray-500 block">Workspace Installation Directory:</span>
                    <div className="p-3 bg-zinc-950/60 rounded border border-zinc-900 text-xs text-gray-400 break-all leading-relaxed select-all">
                      {installDir}
                    </div>
                  </div>

                </div>
              </div>
            </div>

            {/* Quick Tips */}
            <div className="md:col-span-1 space-y-4">
              <div className="mcraft-panel p-5 space-y-4">
                <h3 className="text-xs font-bold font-press-start text-yellow-500 border-b border-gray-800 pb-2 flex items-center uppercase">
                  <Cpu className="h-4 w-4 mr-2" />
                  Performance Tip
                </h3>
                <p className="text-xs text-gray-400 font-sans leading-relaxed">
                  For servers with large render distances or multiple active players, allocate at least 4 GB of RAM (4096 MB). Avoid allocating more than 80% of your total system memory to avoid OS swapping lag.
                </p>
                <div className="bg-zinc-900/60 p-3 rounded border border-zinc-850 flex items-start space-x-2 text-[10px] text-gray-500 font-mono">
                  <HardDrive className="h-4 w-4 text-zinc-400 shrink-0 mt-0.5" />
                  <span>
                    Settings edits write directly to the <code className="bg-black text-yellow-500 px-1 py-0.5 rounded text-[9px]">server.properties</code> document.
                  </span>
                </div>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Save, RefreshCw, CheckCircle, Sliders, Shield, Network, UserPlus } from 'lucide-react';

interface SettingsPageProps {
  installDir: string;
  systemRam: number;
  onSaveComplete: (newRam: number) => void;
  onBack: () => void;
}

export default function SettingsPage({ installDir, systemRam, onSaveComplete, onBack }: SettingsPageProps) {
  const [ramAllocation, setRamAllocation] = useState(2048);
  const [properties, setProperties] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    async function loadSettings() {
      try {
        setLoading(true);
        // Load app config for RAM
        const config = await window.api.getAppConfig();
        if (config.ramMB) setRamAllocation(config.ramMB);

        // Load server properties
        const props = await window.api.readProperties(installDir);
        setProperties(props);
      } catch (err) {
        console.error('Failed to load settings', err);
        setErrorMsg('Failed to load server configurations.');
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, [installDir]);

  const handlePropertyChange = (key: string, value: string) => {
    setProperties(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
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
        setSuccessMsg('Configurations successfully saved!');
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 py-12">
        <RefreshCw className="h-10 w-10 animate-spin text-green-500 mb-4" />
        <span className="font-mono text-xs">Loading Server Configurations...</span>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Title Header */}
      <div className="flex justify-between items-center border-b border-gray-800 pb-4">
        <div>
          <h2 className="font-press-start text-base text-yellow-500 uppercase tracking-wider">
            Server Settings
          </h2>
          <p className="text-xs text-gray-400 mt-1">Configure server.properties and allocation parameters</p>
        </div>
        <button
          onClick={onBack}
          className="mcraft-btn px-4 py-2"
        >
          Back to Dashboard
        </button>
      </div>

      {/* Forms and inputs */}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Performance Card */}
          <div className="mcraft-panel p-5 space-y-4">
            <h3 className="text-sm font-bold font-press-start text-green-500 border-b border-gray-800 pb-2 flex items-center">
              <Sliders className="h-4 w-4 mr-2" />
              Allocation
            </h3>

            {/* RAM Allocation Slider */}
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
              <div className="flex justify-between text-[10px] text-gray-500 font-mono">
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
                className="w-full bg-zinc-900 border-2 border-zinc-800 rounded px-3 py-1.5 text-sm text-gray-200 outline-none focus:border-green-500 font-mono"
              />
            </div>
          </div>

          {/* Gameplay Settings */}
          <div className="mcraft-panel p-5 space-y-4">
            <h3 className="text-sm font-bold font-press-start text-blue-400 border-b border-gray-800 pb-2 flex items-center">
              <Shield className="h-4 w-4 mr-2" />
              Gameplay
            </h3>

            <div className="grid grid-cols-2 gap-4">
              {/* Gamemode Selector */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-400">Gamemode</label>
                <select
                  value={properties['gamemode'] || 'survival'}
                  onChange={(e) => handlePropertyChange('gamemode', e.target.value)}
                  className="w-full bg-zinc-900 border-2 border-zinc-800 rounded px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-green-500 font-mono"
                >
                  <option value="survival">Survival</option>
                  <option value="creative">Creative</option>
                  <option value="adventure">Adventure</option>
                  <option value="spectator">Spectator</option>
                </select>
              </div>

              {/* Difficulty Selector */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-400">Difficulty</label>
                <select
                  value={properties['difficulty'] || 'easy'}
                  onChange={(e) => handlePropertyChange('difficulty', e.target.value)}
                  className="w-full bg-zinc-900 border-2 border-zinc-800 rounded px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-green-500 font-mono"
                >
                  <option value="peaceful">Peaceful</option>
                  <option value="easy">Easy</option>
                  <option value="normal">Normal</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </div>

            {/* Hardcore Mode */}
            <div className="flex items-center justify-between p-2 bg-zinc-900/40 rounded border border-zinc-800">
              <div>
                <span className="text-xs font-bold text-gray-300 block">Hardcore Mode</span>
                <span className="text-[10px] text-gray-500">Locks difficulty to hard, one life</span>
              </div>
              <select
                value={properties['hardcore'] || 'false'}
                onChange={(e) => handlePropertyChange('hardcore', e.target.value)}
                className="bg-zinc-900 border-2 border-zinc-800 rounded px-2 py-1 text-xs text-gray-200 font-mono"
              >
                <option value="false">False</option>
                <option value="true">True</option>
              </select>
            </div>
          </div>

          {/* Network Settings */}
          <div className="mcraft-panel p-5 space-y-4">
            <h3 className="text-sm font-bold font-press-start text-yellow-500 border-b border-gray-800 pb-2 flex items-center">
              <Network className="h-4 w-4 mr-2" />
              Network
            </h3>

            {/* Server Port */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-gray-400">Server Port</label>
              <input
                type="number"
                min="1"
                max="65535"
                value={properties['server-port'] || '25565'}
                onChange={(e) => handlePropertyChange('server-port', e.target.value)}
                className="w-full bg-zinc-900 border-2 border-zinc-800 rounded px-3 py-1.5 text-sm text-gray-200 outline-none focus:border-green-500 font-mono"
                required
              />
            </div>

            {/* Online Mode */}
            <div className="flex items-center justify-between p-2 bg-zinc-900/40 rounded border border-zinc-800">
              <div>
                <span className="text-xs font-bold text-gray-300 block">Online Mode</span>
                <span className="text-[10px] text-gray-500">Enable authentication (premium Minecraft only)</span>
              </div>
              <select
                value={properties['online-mode'] || 'true'}
                onChange={(e) => handlePropertyChange('online-mode', e.target.value)}
                className="bg-zinc-900 border-2 border-zinc-800 rounded px-2 py-1 text-xs text-gray-200 font-mono"
              >
                <option value="true">True</option>
                <option value="false">False</option>
              </select>
            </div>
          </div>

          {/* Limits & Permissions */}
          <div className="mcraft-panel p-5 space-y-4">
            <h3 className="text-sm font-bold font-press-start text-purple-400 border-b border-gray-800 pb-2 flex items-center">
              <UserPlus className="h-4 w-4 mr-2" />
              Limits
            </h3>

            {/* Max Players */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-gray-400">Max Players</label>
              <input
                type="number"
                min="1"
                max="1000"
                value={properties['max-players'] || '20'}
                onChange={(e) => handlePropertyChange('max-players', e.target.value)}
                className="w-full bg-zinc-900 border-2 border-zinc-800 rounded px-3 py-1.5 text-sm text-gray-200 outline-none focus:border-green-500 font-mono"
                required
              />
            </div>

            {/* Allow Flight */}
            <div className="flex items-center justify-between p-2 bg-zinc-900/40 rounded border border-zinc-800">
              <div>
                <span className="text-xs font-bold text-gray-300 block">Allow Flight</span>
                <span className="text-[10px] text-gray-500">Allow players to use mods to fly</span>
              </div>
              <select
                value={properties['allow-flight'] || 'false'}
                onChange={(e) => handlePropertyChange('allow-flight', e.target.value)}
                className="bg-zinc-900 border-2 border-zinc-800 rounded px-2 py-1 text-xs text-gray-200 font-mono"
              >
                <option value="false">False</option>
                <option value="true">True</option>
              </select>
            </div>
          </div>
          
        </div>

        {/* Alerts & Messages */}
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

        {/* Submit Actions */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-800">
          <button
            type="button"
            onClick={onBack}
            className="mcraft-btn px-6 py-2.5"
          >
            Cancel
          </button>
          
          <button
            type="submit"
            disabled={saving}
            className="mcraft-btn mcraft-btn-green px-6 py-2.5 flex items-center"
          >
            {saving ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

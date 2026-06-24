import React, { useState, useEffect } from 'react';
import { FolderOpen, Download, AlertTriangle, Cpu, HelpCircle, ChevronRight, Sliders } from 'lucide-react';

interface SetupWizardProps {
  onSetupComplete: (name: string, dir: string, ram: number) => void;
  systemRam: number;
  hasJava: boolean;
  onCancel?: () => void;
  isFirstServer?: boolean;
}

interface Version {
  id: string;
  type: string;
  url: string;
}

interface Loader {
  version: string;
  stable: boolean;
}

interface Installer {
  version: string;
  stable: boolean;
}

export default function SetupWizard({ onSetupComplete, systemRam, hasJava, onCancel, isFirstServer = true }: SetupWizardProps) {
  const [serverType, setServerType] = useState<'vanilla' | 'fabric'>('vanilla');
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [versions, setVersions] = useState<Version[]>([]);
  const [fabricLoaders, setFabricLoaders] = useState<Loader[]>([]);
  const [fabricInstallers, setFabricInstallers] = useState<Installer[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(true);

  // Form selections
  const [serverName, setServerName] = useState(isFirstServer ? 'Default Server' : '');
  const [selectedVersion, setSelectedVersion] = useState('');
  const [selectedLoader, setSelectedLoader] = useState('');
  const [selectedInstaller, setSelectedInstaller] = useState('');
  const [installDir, setInstallDir] = useState('');
  const [ramAllocation, setRamAllocation] = useState(2048); // default 2GB

  // Installation state
  const [isInstalling, setIsInstalling] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ percent: 0, downloaded: 0, total: 0 });
  const [installError, setInstallError] = useState('');

  useEffect(() => {
    // Fetch system configurations & versions
    async function loadVersions() {
      try {
        setLoadingVersions(true);
        const data = await window.api.fetchMinecraftVersions();
        setVersions(data.vanilla);
        setFabricLoaders(data.fabricLoaders);
        setFabricInstallers(data.fabricInstallers);

        // Set defaults
        const releases = data.vanilla.filter(v => v.type === 'release');
        if (releases.length > 0) {
          setSelectedVersion(releases[0].id);
        }
        if (data.fabricLoaders.length > 0) {
          const stableLoader = data.fabricLoaders.find(l => l.stable) || data.fabricLoaders[0];
          setSelectedLoader(stableLoader.version);
        }
        if (data.fabricInstallers.length > 0) {
          const stableInstaller = data.fabricInstallers.find(i => i.stable) || data.fabricInstallers[0];
          setSelectedInstaller(stableInstaller.version);
        }
      } catch (err) {
        console.error('Failed to load version manifest', err);
        setInstallError('Could not fetch Minecraft versions. Please check your internet connection.');
      } finally {
        setLoadingVersions(false);
      }
    }

    loadVersions();

    // Query saved config if available
    window.api.getAppConfig().then(config => {
      const cfg = config as any;
      if (cfg.installDir) setInstallDir(cfg.installDir);
      if (cfg.ramMB) {
        // Cap saved RAM allocation to system RAM
        const safeRam = Math.min(cfg.ramMB, systemRam - 512);
        setRamAllocation(Math.max(512, safeRam));
      }
    });
  }, [systemRam]);

  // Listen to download progress
  useEffect(() => {
    let unsubscribe: () => void = () => {};
    if (isInstalling) {
      unsubscribe = window.api.onDownloadProgress((data) => {
        setDownloadProgress({
          percent: data.percent,
          downloaded: Math.round(data.downloadedBytes / (1024 * 1024)),
          total: Math.round(data.totalBytes / (1024 * 1024))
        });
      });
    }
    return () => unsubscribe();
  }, [isInstalling]);

  const handleSelectDirectory = async () => {
    const dir = await window.api.selectDirectory();
    if (dir) {
      setInstallDir(dir);
      if (!serverName) {
        const baseName = dir.split(/[\\/]/).pop() || '';
        setServerName(baseName);
      }
    }
  };

  const handleStartInstall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverName.trim()) {
      setInstallError('Please enter a server name.');
      return;
    }
    if (!installDir) {
      setInstallError('Please choose a valid installation directory.');
      return;
    }

    setInstallError('');
    setIsInstalling(true);
    setDownloadProgress({ percent: 0, downloaded: 0, total: 0 });

    try {
      const result = await window.api.downloadServer({
        type: serverType,
        version: selectedVersion,
        loaderVersion: serverType === 'fabric' ? selectedLoader : undefined,
        installerVersion: serverType === 'fabric' ? selectedInstaller : undefined,
        installDir
      });

      if (result.success) {
        // Complete wizard
        onSetupComplete(serverName.trim(), installDir, ramAllocation);
      } else {
        setInstallError(result.error || 'Failed to download server JAR file.');
        setIsInstalling(false);
      }
    } catch (err: any) {
      setInstallError(err.message || 'An unexpected error occurred during installation.');
      setIsInstalling(false);
    }
  };

  const filteredVersions = versions.filter(v => showSnapshots || v.type === 'release');

  return (
    <div className="flex flex-col items-center justify-start h-full w-full overflow-y-auto px-4 py-8 mc-pattern-bg scrollbar">
      <div className="w-full max-w-2xl mcraft-panel p-6 shadow-2xl relative my-auto shrink-0">
        {/* Title */}
        <div className="text-center mb-6 border-b border-gray-800 pb-4">
          <h1 className="font-press-start text-xl md:text-2xl text-green-500 tracking-wider uppercase mb-2">
            Server Setup Wizard
          </h1>
          <p className="text-gray-400 text-sm">Create and configure your local Minecraft server</p>
        </div>

        {/* Java Warning */}
        {!hasJava && (
          <div className="mb-6 p-4 bg-red-950/60 border-2 border-red-700 rounded-md text-red-200 flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm">Java Runtime Environment Not Found</p>
              <p className="text-xs text-red-300 mt-1">
                A Java installation was not detected in your system environment PATH. You will need to install Java (e.g. OpenJDK 17 or 21) to run your server after downloading.
              </p>
            </div>
          </div>
        )}

        {isInstalling ? (
          /* Installation Progress View */
          <div className="py-8 px-4 text-center">
            <Download className="h-16 w-16 text-green-500 animate-bounce mx-auto mb-6" />
            <h3 className="font-press-start text-sm text-yellow-500 mb-2">Downloading Server Files...</h3>
            <p className="text-gray-400 text-xs mb-6 font-mono">
              Downloading: {downloadProgress.downloaded} MB / {downloadProgress.total} MB
            </p>

            <div className="w-full bg-black border-2 border-gray-700 h-8 p-1 relative mb-4">
              <div 
                className="bg-green-600 h-full transition-all duration-300 ease-out" 
                style={{ width: `${downloadProgress.percent}%` }}
              ></div>
              <span className="absolute inset-0 flex items-center justify-center font-press-start text-[10px] text-white mix-blend-difference">
                {downloadProgress.percent}%
              </span>
            </div>
            <p className="text-xs text-gray-500">Please do not close the application during the download process.</p>
          </div>
        ) : (
          /* Wizard Setup Form */
          <form onSubmit={handleStartInstall} className="space-y-6">
            {/* Server Type Select */}
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setServerType('vanilla')}
                className={`py-3 px-4 flex flex-col items-center justify-center rounded border-2 transition-all ${
                  serverType === 'vanilla'
                    ? 'bg-green-950/40 border-green-500 text-green-300'
                    : 'bg-zinc-900 border-zinc-700 text-gray-400 hover:border-gray-500'
                }`}
              >
                <HelpCircle className="h-6 w-6 mb-1 text-green-500" />
                <span className="font-bold text-sm">Vanilla</span>
                <span className="text-[10px] text-gray-500 mt-1">Official Mojang Server</span>
              </button>

              <button
                type="button"
                onClick={() => setServerType('fabric')}
                className={`py-3 px-4 flex flex-col items-center justify-center rounded border-2 transition-all ${
                  serverType === 'fabric'
                    ? 'bg-green-950/40 border-green-500 text-green-300'
                    : 'bg-zinc-900 border-zinc-700 text-gray-400 hover:border-gray-500'
                }`}
              >
                <Cpu className="h-6 w-6 mb-1 text-blue-400" />
                <span className="font-bold text-sm">Fabric</span>
                <span className="text-[10px] text-gray-500 mt-1">Modded/Optimized Server</span>
              </button>
            </div>

            {/* Version Selectors */}
            <div className="space-y-4">
              {loadingVersions ? (
                <div className="h-20 flex items-center justify-center text-gray-400 text-sm">
                  Loading Minecraft versions...
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Minecraft Version Dropdown */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Minecraft Version
                    </label>
                    <select
                      value={selectedVersion}
                      onChange={(e) => setSelectedVersion(e.target.value)}
                      className="w-full bg-zinc-900 border-2 border-zinc-700 rounded px-3 py-2 text-sm text-gray-200 outline-none focus:border-green-500"
                    >
                      {filteredVersions.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.id} ({v.type})
                        </option>
                      ))}
                    </select>

                    <div className="flex items-center space-x-2 mt-1">
                      <input
                        type="checkbox"
                        id="snapshots"
                        checked={showSnapshots}
                        onChange={(e) => setShowSnapshots(e.target.checked)}
                        className="rounded bg-zinc-900 border-zinc-700 text-green-600 focus:ring-0 focus:ring-offset-0"
                      />
                      <label htmlFor="snapshots" className="text-xs text-gray-500 select-none">
                        Show development snapshots
                      </label>
                    </div>
                  </div>

                  {/* Fabric specific Loader/Installer drop-downs */}
                  {serverType === 'fabric' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
                          Loader
                        </label>
                        <select
                          value={selectedLoader}
                          onChange={(e) => setSelectedLoader(e.target.value)}
                          className="w-full bg-zinc-900 border-2 border-zinc-700 rounded px-2 py-2 text-xs text-gray-200 outline-none focus:border-green-500"
                        >
                          {fabricLoaders.map((l) => (
                            <option key={l.version} value={l.version}>
                              {l.version} {l.stable ? '(Stable)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
                          Installer
                        </label>
                        <select
                          value={selectedInstaller}
                          onChange={(e) => setSelectedInstaller(e.target.value)}
                          className="w-full bg-zinc-900 border-2 border-zinc-700 rounded px-2 py-2 text-xs text-gray-200 outline-none focus:border-green-500"
                        >
                          {fabricInstallers.map((i) => (
                            <option key={i.version} value={i.version}>
                              {i.version} {i.stable ? '(Stable)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Server Name Input */}
            <div className="space-y-2 font-mono">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
                Server Name
              </label>
              <input
                type="text"
                placeholder="e.g. My Survival Server"
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                className="w-full bg-zinc-900 border-2 border-zinc-700 rounded px-3 py-2 text-sm text-gray-200 outline-none focus:border-green-500 font-mono text-xs"
                required
              />
            </div>

            {/* Directory Selection */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
                Installation Directory
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Select a folder to install..."
                  value={installDir}
                  onChange={(e) => setInstallDir(e.target.value)}
                  className="flex-1 bg-zinc-900 border-2 border-zinc-700 rounded px-3 py-2 text-sm text-gray-200 outline-none focus:border-green-500 font-mono text-xs"
                  required
                />
                <button
                  type="button"
                  onClick={handleSelectDirectory}
                  className="mcraft-btn px-4 py-2 flex items-center justify-center shrink-0"
                >
                  <FolderOpen className="h-4 w-4 mr-2" />
                  Browse
                </button>
              </div>
            </div>

            {/* RAM Allocation Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
                  RAM Allocation
                </label>
                <span className="text-sm font-bold font-mono text-green-400">
                  {ramAllocation >= 1024
                    ? `${(ramAllocation / 1024).toFixed(1)} GB`
                    : `${ramAllocation} MB`}
                </span>
              </div>
              <div className="flex items-center space-x-4 bg-zinc-900/50 border border-zinc-800 p-3 rounded">
                <Sliders className="h-5 w-5 text-gray-500 shrink-0" />
                <input
                  type="range"
                  min="512"
                  max={systemRam - 1024 > 512 ? systemRam - 1024 : systemRam} // Leave 1GB for system if possible
                  step="256"
                  value={ramAllocation}
                  onChange={(e) => setRamAllocation(parseInt(e.target.value, 10))}
                  className="flex-1 accent-green-500 cursor-pointer"
                />
              </div>
              <div className="flex justify-between text-[10px] text-gray-500 px-1 font-mono">
                <span>Min: 512 MB</span>
                <span>System Total: {(systemRam / 1024).toFixed(1)} GB</span>
              </div>
            </div>

            {/* Error Message */}
            {installError && (
              <div className="p-3 bg-red-950/60 border border-red-700 text-red-200 text-xs rounded">
                {installError}
              </div>
            )}

            {/* Submit & Cancel Buttons */}
            <div className="pt-4 border-t border-gray-800 flex justify-end space-x-3">
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="mcraft-btn px-6 py-3 text-xs tracking-wider border-zinc-800 text-gray-400 bg-transparent hover:bg-zinc-900"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={loadingVersions}
                className="mcraft-btn mcraft-btn-green px-6 py-3 text-xs tracking-wider flex items-center"
              >
                Download and Setup
                <ChevronRight className="h-4 w-4 ml-2" />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

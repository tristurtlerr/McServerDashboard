import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Search, Download, Trash2, Package, RefreshCw, AlertTriangle, CheckCircle, Loader } from 'lucide-react';

interface ModManagerProps {
  installDir: string;
  serverType: 'vanilla' | 'fabric';
  mcVersion?: string;
  onBack: () => void;
}

interface ModHit {
  project_id: string;
  slug: string;
  title: string;
  description: string;
  icon_url: string;
  downloads: number;
  categories: string[];
}

interface InstalledMod {
  filename: string;
  sizeMB: number;
}

type Tab = 'browse' | 'installed';

export default function ModManager({ installDir, serverType, mcVersion: propMcVersion, onBack }: ModManagerProps) {
  const [tab, setTab] = useState<Tab>('browse');
  const [mcVersion, setMcVersion] = useState(propMcVersion || '');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ModHit[]>([]);
  const [total, setTotal] = useState(0);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [installedMods, setInstalledMods] = useState<InstalledMod[]>([]);
  const [installingMod, setInstallingMod] = useState<string | null>(null);
  const [installProgress, setInstallProgress] = useState<Record<string, number>>({});
  const [installedFilenames, setInstalledFilenames] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [detectingVersion, setDetectingVersion] = useState(!propMcVersion);

  // Auto-detect MC version if not provided
  useEffect(() => {
    if (propMcVersion) {
      setMcVersion(propMcVersion);
      setDetectingVersion(false);
      return;
    }
    window.api.detectServerType(installDir).then(({ mcVersion: detected }) => {
      if (detected) setMcVersion(detected);
      setDetectingVersion(false);
    });
  }, [installDir, propMcVersion]);

  // Load installed mods
  const loadInstalledMods = useCallback(async () => {
    const mods = await window.api.getInstalledMods(installDir);
    setInstalledMods(mods);
    setInstalledFilenames(new Set(mods.map(m => m.filename)));
  }, [installDir]);

  useEffect(() => {
    loadInstalledMods();
  }, [loadInstalledMods]);

  // Track install progress
  useEffect(() => {
    const unsub = window.api.onModInstallProgress((data) => {
      setInstallProgress(prev => ({ ...prev, [data.filename]: data.percent }));
    });
    return unsub;
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!mcVersion) return;
    setSearchLoading(true);
    setSearchError('');
    const result = await window.api.searchMods({ query, mcVersion });
    setSearchLoading(false);
    if (result.success) {
      setResults(result.hits);
      setTotal(result.total);
    } else {
      setSearchError(result.error || 'Suche fehlgeschlagen.');
    }
  };

  // Initial search when version is known
  useEffect(() => {
    if (mcVersion && !detectingVersion) {
      handleSearch();
    }
  }, [mcVersion, detectingVersion]);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleInstall = async (mod: ModHit) => {
    setInstallingMod(mod.project_id);
    setInstallProgress({});

    const dlResult = await window.api.getModDownload({ projectId: mod.project_id, mcVersion });
    if (!dlResult.success || !dlResult.url || !dlResult.filename) {
      setInstallingMod(null);
      showFeedback('error', dlResult.error || `Keine kompatible Version für ${mod.title} gefunden.`);
      return;
    }

    const installResult = await window.api.installMod({
      installDir,
      url: dlResult.url,
      filename: dlResult.filename
    });

    setInstallingMod(null);
    setInstallProgress({});

    if (installResult.success) {
      showFeedback('success', `${mod.title} wurde installiert.`);
      loadInstalledMods();
    } else {
      showFeedback('error', installResult.error || `Fehler beim Installieren von ${mod.title}.`);
    }
  };

  const handleRemove = async (filename: string) => {
    const result = await window.api.removeMod({ installDir, filename });
    if (result.success) {
      showFeedback('success', `${filename} wurde entfernt.`);
      loadInstalledMods();
    } else {
      showFeedback('error', result.error || 'Fehler beim Entfernen.');
    }
  };

  const formatDownloads = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
    return n.toString();
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-4 mb-4 shrink-0">
        <div className="flex items-center space-x-3">
          <button onClick={onBack} className="mcraft-btn p-2">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <Package className="h-5 w-5 text-purple-400" />
          <h2 className="font-press-start text-sm text-purple-400 uppercase tracking-wider">Mod Manager</h2>
          {mcVersion && (
            <span className="text-xs font-mono text-gray-500 border border-gray-700 px-2 py-0.5 rounded">
              MC {mcVersion} · Fabric
            </span>
          )}
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div className={`mb-3 px-4 py-2 rounded border text-xs font-mono flex items-center space-x-2 shrink-0 ${
          feedback.type === 'success'
            ? 'bg-green-950/50 border-green-800 text-green-400'
            : 'bg-red-950/50 border-red-800 text-red-400'
        }`}>
          {feedback.type === 'success'
            ? <CheckCircle className="h-4 w-4 shrink-0" />
            : <AlertTriangle className="h-4 w-4 shrink-0" />
          }
          <span>{feedback.message}</span>
        </div>
      )}

      {/* No version detected warning */}
      {!detectingVersion && !mcVersion && (
        <div className="mb-4 p-4 bg-yellow-950/40 border border-yellow-800/60 rounded text-yellow-400 text-xs font-mono shrink-0">
          <AlertTriangle className="h-4 w-4 inline mr-2" />
          Minecraft-Version konnte nicht automatisch erkannt werden. Bitte gib sie manuell ein:
          <input
            className="ml-2 bg-zinc-900 border border-gray-700 rounded px-2 py-1 text-white outline-none"
            placeholder="z.B. 1.20.1"
            onBlur={(e) => setMcVersion(e.target.value.trim())}
            onKeyDown={(e) => { if (e.key === 'Enter') setMcVersion((e.target as HTMLInputElement).value.trim()); }}
          />
        </div>
      )}

      {detectingVersion && (
        <div className="flex items-center space-x-2 text-gray-400 text-xs font-mono mb-4 shrink-0">
          <Loader className="h-4 w-4 animate-spin" />
          <span>Erkenne Server-Version...</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-2 mb-4 shrink-0">
        <button
          onClick={() => setTab('browse')}
          className={`mcraft-btn px-4 py-2 text-xs ${tab === 'browse' ? 'border-purple-600 text-purple-400' : ''}`}
        >
          <Search className="h-3.5 w-3.5 inline mr-2" />
          Durchsuchen
        </button>
        <button
          onClick={() => { setTab('installed'); loadInstalledMods(); }}
          className={`mcraft-btn px-4 py-2 text-xs ${tab === 'installed' ? 'border-purple-600 text-purple-400' : ''}`}
        >
          <Package className="h-3.5 w-3.5 inline mr-2" />
          Installiert ({installedMods.length})
        </button>
      </div>

      {/* Browse Tab */}
      {tab === 'browse' && (
        <div className="flex flex-col flex-1 min-h-0">
          <form onSubmit={handleSearch} className="flex space-x-2 mb-4 shrink-0">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Mod suchen (z.B. JEI, Waystones, Sodium)..."
              className="flex-1 bg-zinc-900 border border-gray-700 rounded px-3 py-2 text-sm font-mono text-gray-100 outline-none focus:border-purple-600 placeholder-zinc-600"
              disabled={!mcVersion}
            />
            <button
              type="submit"
              disabled={searchLoading || !mcVersion}
              className="mcraft-btn px-4 py-2 flex items-center text-xs"
            >
              {searchLoading
                ? <Loader className="h-4 w-4 animate-spin" />
                : <Search className="h-4 w-4" />
              }
            </button>
            {results.length > 0 && (
              <button
                type="button"
                onClick={() => { setQuery(''); setResults([]); setTotal(0); }}
                className="mcraft-btn px-3 py-2 text-xs"
              >
                Zurücksetzen
              </button>
            )}
          </form>

          {searchError && (
            <div className="text-red-400 text-xs font-mono mb-3">{searchError}</div>
          )}

          {total > 0 && (
            <div className="text-xs text-gray-500 font-mono mb-2 shrink-0">
              {total} Mods gefunden für MC {mcVersion} (Fabric)
            </div>
          )}

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar">
            {results.map((mod) => {
              const isInstalling = installingMod === mod.project_id;
              const progress = installProgress[Object.keys(installProgress)[0]] || 0;
              // Check if any installed file might match this mod (by slug in filename)
              const isInstalled = Array.from(installedFilenames).some(f =>
                f.toLowerCase().includes(mod.slug.toLowerCase().replace(/-/g, ''))
                || f.toLowerCase().includes(mod.slug.toLowerCase())
              );

              return (
                <div
                  key={mod.project_id}
                  className="flex items-start space-x-3 p-3 mcraft-panel hover:border-gray-600 transition-colors"
                >
                  {mod.icon_url ? (
                    <img
                      src={mod.icon_url}
                      alt=""
                      className="h-12 w-12 rounded shrink-0 border border-zinc-800 bg-zinc-900 object-cover"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    <div className="h-12 w-12 rounded shrink-0 border border-zinc-800 bg-zinc-900 flex items-center justify-center">
                      <Package className="h-6 w-6 text-zinc-600" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-sm font-semibold text-gray-100 font-mono">{mod.title}</span>
                        <span className="ml-2 text-[10px] text-gray-500">
                          {formatDownloads(mod.downloads)} Downloads
                        </span>
                      </div>
                      <div className="shrink-0">
                        {isInstalled ? (
                          <span className="text-[10px] text-green-500 font-mono border border-green-800 px-2 py-1 rounded">
                            Installiert
                          </span>
                        ) : (
                          <button
                            onClick={() => handleInstall(mod)}
                            disabled={!!installingMod}
                            className="mcraft-btn px-3 py-1.5 text-[10px] flex items-center space-x-1.5 text-purple-400 border-purple-800 hover:border-purple-600 disabled:opacity-50"
                          >
                            {isInstalling ? (
                              <>
                                <Loader className="h-3 w-3 animate-spin" />
                                <span>{progress > 0 ? `${progress}%` : 'Laden...'}</span>
                              </>
                            ) : (
                              <>
                                <Download className="h-3 w-3" />
                                <span>Installieren</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-1 line-clamp-2">{mod.description}</p>
                    {mod.categories.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {mod.categories.slice(0, 4).map(cat => (
                          <span key={cat} className="text-[9px] bg-zinc-900 border border-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
                            {cat}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {!searchLoading && results.length === 0 && mcVersion && !searchError && (
              <div className="text-center text-gray-500 text-sm font-mono py-12">
                <Search className="h-8 w-8 mx-auto mb-3 text-zinc-700" />
                Suche nach Mods für MC {mcVersion} (Fabric)
              </div>
            )}
          </div>
        </div>
      )}

      {/* Installed Tab */}
      {tab === 'installed' && (
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar">
          {installedMods.length === 0 ? (
            <div className="text-center text-gray-500 text-sm font-mono py-12">
              <Package className="h-8 w-8 mx-auto mb-3 text-zinc-700" />
              Keine Mods installiert
            </div>
          ) : (
            installedMods.map((mod) => (
              <div
                key={mod.filename}
                className="flex items-center justify-between p-3 mcraft-panel hover:border-gray-600 transition-colors"
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <Package className="h-5 w-5 text-purple-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-sm font-mono text-gray-200 truncate block">{mod.filename}</span>
                    <span className="text-xs text-gray-500">{mod.sizeMB} MB</span>
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(mod.filename)}
                  className="mcraft-btn p-2 text-red-500 border-red-900 hover:border-red-700 shrink-0"
                  title="Mod entfernen"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

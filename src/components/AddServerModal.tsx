import { useState } from 'react';
import { X, Download, FolderOpen, AlertTriangle } from 'lucide-react';

interface AddServerModalProps {
  onClose: () => void;
  onInstallNew: () => void;
  onImportExisting: (name: string, path: string, ramMB: number) => void;
  systemRam: number;
}

export default function AddServerModal({
  onClose,
  onInstallNew,
  onImportExisting,
  systemRam
}: AddServerModalProps) {
  const [step, setStep] = useState<'choose' | 'import'>('choose');
  const [name, setName] = useState('');
  const [dirPath, setDirPath] = useState('');
  const [ram, setRam] = useState(2048);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');

  const handleSelectDir = async () => {
    try {
      const selected = await window.api.selectDirectory();
      if (selected) {
        setDirPath(selected);
        setError('');
        // Autopopulate server name if empty based on directory base name
        if (!name) {
          const baseName = selected.split(/[\\/]/).pop() || '';
          setName(baseName);
        }

        // Check if server.jar exists
        const check = await window.api.checkServerInstalled(selected);
        if (!check.installed) {
          setWarning('Notice: server.jar not found in this folder. Make sure to put your server jar file there named "server.jar".');
        } else {
          setWarning('');
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter a server name.');
      return;
    }
    if (!dirPath) {
      setError('Please select a server folder.');
      return;
    }
    onImportExisting(name.trim(), dirPath, ram);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none">
      <div className="mcraft-panel w-full max-w-lg bg-[#0b0c10] border-2 border-zinc-700 p-6 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-500 hover:text-gray-300"
          title="Close Modal"
        >
          <X className="h-5 w-5" />
        </button>

        {step === 'choose' ? (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="font-press-start text-sm text-yellow-500 uppercase tracking-wider">
                Add Server
              </h2>
              <p className="text-xs text-zinc-500 font-mono mt-2">
                Choose how you want to add a Minecraft server.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Option 1: Setup Wizard */}
              <div
                onClick={onInstallNew}
                className="bg-zinc-950/60 hover:bg-zinc-900 border-2 border-zinc-800 hover:border-green-800 p-5 rounded cursor-pointer transition-all flex flex-col items-center text-center space-y-3 group"
              >
                <div className="w-12 h-12 bg-green-950/50 border border-green-800 text-green-400 rounded flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Download className="h-6 w-6" />
                </div>
                <span className="font-press-start text-[9px] uppercase tracking-wider text-gray-200 group-hover:text-green-400">
                  Fresh Install
                </span>
                <p className="text-[10px] text-zinc-500 font-mono">
                  Download Vanilla or Fabric server jar, set RAM and create a clean environment.
                </p>
              </div>

              {/* Option 2: Import Existing */}
              <div
                onClick={() => setStep('import')}
                className="bg-zinc-950/60 hover:bg-zinc-900 border-2 border-zinc-800 hover:border-yellow-800 p-5 rounded cursor-pointer transition-all flex flex-col items-center text-center space-y-3 group"
              >
                <div className="w-12 h-12 bg-yellow-950/50 border border-yellow-800 text-yellow-500 rounded flex items-center justify-center group-hover:scale-105 transition-transform">
                  <FolderOpen className="h-6 w-6" />
                </div>
                <span className="font-press-start text-[9px] uppercase tracking-wider text-gray-200 group-hover:text-yellow-400">
                  Import Folder
                </span>
                <p className="text-[10px] text-zinc-500 font-mono">
                  Browse and import an existing Minecraft server directory from your local disk.
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Step 2: Import Existing Folder fields */
          <form onSubmit={handleImportSubmit} className="space-y-4">
            <h2 className="font-press-start text-xs text-yellow-500 uppercase tracking-wider text-center">
              Import Existing Server
            </h2>

            {error && (
              <div className="bg-red-950/30 border border-red-900/60 p-2.5 rounded text-red-400 text-xs font-mono">
                {error}
              </div>
            )}

            {warning && (
              <div className="bg-amber-950/30 border border-amber-900/60 p-2.5 rounded text-amber-400 text-[10px] font-mono flex items-start space-x-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                <span>{warning}</span>
              </div>
            )}

            <div className="space-y-3 font-mono text-xs text-gray-300">
              {/* Server Name input */}
              <div className="space-y-1">
                <label className="text-zinc-500 block text-[10px] uppercase">Server Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. My Survival Server"
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-700 outline-none rounded p-2 text-gray-200 font-semibold"
                />
              </div>

              {/* Folder Selector */}
              <div className="space-y-1">
                <label className="text-zinc-500 block text-[10px] uppercase">Select Folder</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={dirPath}
                    readOnly
                    placeholder="No folder selected"
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded p-2 text-gray-400 text-[10px] outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSelectDir}
                    className="mcraft-btn px-4 py-2 text-[10px]"
                  >
                    Browse
                  </button>
                </div>
              </div>

              {/* RAM slider */}
              <div className="space-y-2 mt-4 bg-zinc-950/40 p-3.5 border border-zinc-900 rounded">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 text-[10px] uppercase">RAM Allocation</span>
                  <span className="text-green-400 font-bold text-xs">{(ram / 1024).toFixed(1)} GB</span>
                </div>
                <input
                  type="range"
                  min="512"
                  max={systemRam}
                  step="256"
                  value={ram}
                  onChange={(e) => setRam(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-zinc-900 rounded-lg appearance-none cursor-pointer accent-green-600"
                />
                <div className="flex justify-between text-[9px] text-zinc-600 mt-1">
                  <span>512 MB</span>
                  <span>{Math.round(systemRam / 1024)} GB Max</span>
                </div>
              </div>
            </div>

            {/* Modal actions footer */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-zinc-900">
              <button
                type="button"
                onClick={() => setStep('choose')}
                className="mcraft-btn px-4 py-2 border-zinc-800 text-gray-400 bg-transparent"
              >
                Back
              </button>
              <button
                type="submit"
                className="mcraft-btn px-5 py-2"
              >
                Import Server
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Actions / Invokes
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  fetchMinecraftVersions: () => ipcRenderer.invoke('fetch-minecraft-versions'),
  downloadServer: (params) => ipcRenderer.invoke('download-server', params),
  checkServerInstalled: (dir) => ipcRenderer.invoke('check-server-installed', dir),
  getAppConfig: () => ipcRenderer.invoke('get-app-config'),
  saveAppConfig: (config) => ipcRenderer.invoke('save-app-config', config),
  startServer: (params) => ipcRenderer.invoke('start-server', params),
  stopServer: () => ipcRenderer.invoke('stop-server'),
  sendServerCommand: (cmd) => ipcRenderer.invoke('send-server-command', cmd),
  checkEulaStatus: (dir) => ipcRenderer.invoke('check-eula-status', dir),
  acceptEula: (dir) => ipcRenderer.invoke('accept-eula', dir),
  readProperties: (dir) => ipcRenderer.invoke('read-properties', dir),
  writeProperties: (dir, props) => ipcRenderer.invoke('write-properties', { installDir: dir, properties: props }),
  readWhitelist: (dir) => ipcRenderer.invoke('read-whitelist', dir),
  addToWhitelist: (dir, name) => ipcRenderer.invoke('add-to-whitelist', { installDir: dir, username: name }),
  removeFromWhitelist: (dir, name) => ipcRenderer.invoke('remove-from-whitelist', { installDir: dir, username: name }),

  // Event Listeners (with cleanups returned as functions)
  onDownloadProgress: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('download-progress', subscription);
    return () => ipcRenderer.removeListener('download-progress', subscription);
  },
  onServerLog: (callback) => {
    const subscription = (event, line) => callback(line);
    ipcRenderer.on('server-log', subscription);
    return () => ipcRenderer.removeListener('server-log', subscription);
  },
  onServerStatusChange: (callback) => {
    const subscription = (event, status) => callback(status);
    ipcRenderer.on('server-status-change', subscription);
    return () => ipcRenderer.removeListener('server-status-change', subscription);
  },
  onServerPlayersChange: (callback) => {
    const subscription = (event, players) => callback(players);
    ipcRenderer.on('server-players-change', subscription);
    return () => ipcRenderer.removeListener('server-players-change', subscription);
  },
  onServerError: (callback) => {
    const subscription = (event, err) => callback(err);
    ipcRenderer.on('server-error', subscription);
    return () => ipcRenderer.removeListener('server-error', subscription);
  },
  onServerStats: (callback) => {
    const subscription = (event, stats) => callback(stats);
    ipcRenderer.on('server-stats', subscription);
    return () => ipcRenderer.removeListener('server-stats', subscription);
  }
});

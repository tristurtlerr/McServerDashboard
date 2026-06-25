const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { spawn, execSync } = require('child_process');
const os = require('os');
const pidusage = require('pidusage');
const nbt = require('prismarine-nbt');
const net = require('net');

let mainWindow = null;
const serverProcesses = {};
const serverStatuses = {};
const activeInstallDirs = {};
const serverPlayers = {};
const statsIntervals = {};

// Helper to parse NBT buffer cleanly
function parseNbtBuffer(buffer) {
  return new Promise((resolve, reject) => {
    nbt.parse(buffer, (err, data) => {
      if (err) return reject(err);
      resolve(nbt.simplify(data.parsed || data));
    });
  });
}

// App configuration helper
const configPath = path.join(app.getPath('userData'), 'config.json');

function getAppConfig() {
  let config = { servers: [], activeServerId: '' };
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (e) {
      console.error('Failed to read config', e);
    }
  }

  // Migrate old configuration schema
  if (config.installDir && !config.servers) {
    const defaultServer = {
      id: 'default',
      name: 'Default Server',
      installDir: config.installDir,
      ramMB: config.ramMB || 2048
    };
    config = {
      servers: [defaultServer],
      activeServerId: 'default'
    };
    saveAppConfig(config);
  }

  // Ensure structures exist
  if (!config.servers) config.servers = [];
  if (!config.activeServerId && config.servers.length > 0) {
    config.activeServerId = config.servers[0].id;
  }

  return config;
}

function saveAppConfig(config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('Failed to save config', e);
    return false;
  }
}

// Http get helper for JSON APIs
function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'McServerDashboard' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(httpGetJson(res.headers.location));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to fetch JSON: Status ${res.statusCode}`));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// Download helper with progress reporting
function downloadFile(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    let isFinished = false;

    const request = https.get(url, { headers: { 'User-Agent': 'McServerDashboard' } }, (response) => {
      // Handle redirect
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close();
        fs.unlink(dest, () => {});
        return resolve(downloadFile(response.headers.location, dest, onProgress));
      }

      if (response.statusCode !== 200) {
        file.close();
        fs.unlink(dest, () => {});
        return reject(new Error(`Failed to download: Status Code ${response.statusCode}`));
      }

      const totalBytes = parseInt(response.headers['content-length'], 10);
      let downloadedBytes = 0;

      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        if (totalBytes && onProgress) {
          const percent = Math.round((downloadedBytes / totalBytes) * 100);
          onProgress(percent, downloadedBytes, totalBytes);
        }
      });

      response.pipe(file);

      file.on('finish', () => {
        if (!isFinished) {
          isFinished = true;
          file.close();
          resolve();
        }
      });
    });

    request.on('error', (err) => {
      if (!isFinished) {
        isFinished = true;
        file.close();
        fs.unlink(dest, () => {});
        reject(err);
      }
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 700,
    title: 'Minecraft Server Manager',
    backgroundColor: '#121212',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Check if we are running in development mode
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // If the server process is still running, let's stop it
  for (const proc of Object.values(serverProcesses)) {
    if (proc) {
      try {
        proc.kill('SIGKILL');
      } catch (e) {
        console.error('Failed to kill server process on window close', e);
      }
    }
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// --- IPC IPC HANDLERS ---

// Select native directory dialog
ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select Server Installation Folder'
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

// Get system RAM and Java availability
ipcMain.handle('get-system-info', async () => {
  const totalMemoryMB = Math.round(os.totalmem() / (1024 * 1024));
  let hasJava = false;
  try {
    // Under Windows, java -version writes output to stderr, but we can verify execution
    execSync('java -version', { stdio: 'ignore' });
    hasJava = true;
  } catch (e) {
    hasJava = false;
  }
  return { totalMemoryMB, hasJava };
});

// Fetch versions (Vanilla & Fabric)
ipcMain.handle('fetch-minecraft-versions', async () => {
  try {
    const mojangUrl = 'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json';
    const fabricLoaderUrl = 'https://meta.fabricmc.net/v2/versions/loader';
    const fabricInstallerUrl = 'https://meta.fabricmc.net/v2/versions/installer';

    const [mojangManifest, fabricLoaders, fabricInstallers] = await Promise.all([
      httpGetJson(mojangUrl),
      httpGetJson(fabricLoaderUrl),
      httpGetJson(fabricInstallerUrl)
    ]);

    // Format vanilla versions (only release and snapshot)
    const vanillaVersions = mojangManifest.versions.map(v => ({
      id: v.id,
      type: v.type,
      url: v.url
    }));

    return {
      vanilla: vanillaVersions,
      fabricLoaders: fabricLoaders.map(l => ({ version: l.version, stable: l.stable })),
      fabricInstallers: fabricInstallers.map(i => ({ version: i.version, stable: i.stable }))
    };
  } catch (e) {
    console.error('Failed to fetch Minecraft versions', e);
    throw e;
  }
});

// Download server JAR
ipcMain.handle('download-server', async (event, { type, version, loaderVersion, installerVersion, installDir }) => {
  try {
    if (!fs.existsSync(installDir)) {
      fs.mkdirSync(installDir, { recursive: true });
    }

    const jarPath = path.join(installDir, 'server.jar');
    let downloadUrl = '';

    if (type === 'vanilla') {
      // We need to fetch the version manifest, then get the version details, then download
      const manifestUrl = 'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json';
      const manifest = await httpGetJson(manifestUrl);
      const versionInfo = manifest.versions.find(v => v.id === version);
      if (!versionInfo) {
        throw new Error(`Minecraft version ${version} not found in manifest`);
      }
      const details = await httpGetJson(versionInfo.url);
      if (!details.downloads || !details.downloads.server) {
        throw new Error(`No server download available for version ${version}`);
      }
      downloadUrl = details.downloads.server.url;
    } else {
      // Fabric server jar layout URL:
      // https://meta.fabricmc.net/v2/versions/loader/<game_version>/<loader_version>/<installer_version>/server/jar
      downloadUrl = `https://meta.fabricmc.net/v2/versions/loader/${version}/${loaderVersion}/${installerVersion}/server/jar`;
    }

    console.log(`Downloading server JAR from: ${downloadUrl}`);

    await downloadFile(downloadUrl, jarPath, (percent, downloadedBytes, totalBytes) => {
      if (mainWindow) {
        mainWindow.webContents.send('download-progress', { percent, downloadedBytes, totalBytes });
      }
    });

    return { success: true, jarPath };
  } catch (e) {
    console.error('Server download failed', e);
    return { success: false, error: e.message };
  }
});

// Check if server exists in folder
ipcMain.handle('check-server-installed', async (event, installDir) => {
  if (!installDir || !fs.existsSync(installDir)) return { installed: false };
  const jarExists = fs.existsSync(path.join(installDir, 'server.jar'));
  const eulaExists = fs.existsSync(path.join(installDir, 'eula.txt'));
  
  let eulaAccepted = false;
  if (eulaExists) {
    const eulaContent = fs.readFileSync(path.join(installDir, 'eula.txt'), 'utf-8');
    eulaAccepted = eulaContent.includes('eula=true');
  }

  return {
    installed: jarExists,
    eulaAccepted
  };
});

// Get/Save App Settings Config
ipcMain.handle('get-app-config', async () => getAppConfig());
ipcMain.handle('save-app-config', async (event, config) => saveAppConfig(config));
ipcMain.handle('get-server-statuses', async () => serverStatuses);
ipcMain.handle('get-server-players', async () => serverPlayers);
ipcMain.handle('resize-window', async (event, { width, height }) => {
  if (mainWindow) {
    mainWindow.setSize(width, height, true);
  }
});

function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true);
      } else {
        resolve(false);
      }
    });
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port);
  });
}

// Start server process
ipcMain.handle('start-server', async (event, { serverId, installDir, ramMB }) => {
  if (serverProcesses[serverId]) {
    return { success: false, error: 'Server is already running' };
  }

  // Read port from server.properties to verify availability
  let port = 25565;
  const propsPath = path.join(installDir, 'server.properties');
  if (fs.existsSync(propsPath)) {
    try {
      const content = fs.readFileSync(propsPath, 'utf-8');
      const match = content.match(/^server-port\s*=\s*(\d+)/m);
      if (match) {
        port = parseInt(match[1], 10);
      }
    } catch (e) {
      console.error('Failed to read port from properties', e);
    }
  }

  const inUse = await isPortInUse(port);
  if (inUse) {
    return { success: false, error: `Port ${port} is already in use by another process. Please check if another Minecraft server or application is running.` };
  }

  try {
    activeInstallDirs[serverId] = installDir;
    serverPlayers[serverId] = [];
    serverStatuses[serverId] = 'starting';
    if (mainWindow) mainWindow.webContents.send('server-status-change', { serverId, status: 'starting' });

    const jarPath = path.join(installDir, 'server.jar');
    if (!fs.existsSync(jarPath)) {
      throw new Error('Server JAR file not found. Please complete the setup wizard.');
    }

    // Spawn server process
    const proc = spawn('java', [
      `-Xmx${ramMB}M`,
      `-Xms512M`,
      '-jar',
      'server.jar',
      'nogui'
    ], {
      cwd: installDir
    });
    serverProcesses[serverId] = proc;

    let buffer = '';

    const handleLogLine = (line) => {
      if (mainWindow) {
        mainWindow.webContents.send('server-log', { serverId, line });
      }

      // Check if server is running
      // Standard log line: [hh:mm:ss] [Server thread/INFO]: Done (12.345s)! For help, type "help"
      if (line.includes('Done (') && line.includes('s)! For help')) {
        serverStatuses[serverId] = 'running';
        if (mainWindow) mainWindow.webContents.send('server-status-change', { serverId, status: 'running' });

        // Start server stats monitoring interval
        if (statsIntervals[serverId]) clearInterval(statsIntervals[serverId]);
        statsIntervals[serverId] = setInterval(() => {
          const currentProc = serverProcesses[serverId];
          if (currentProc) {
            pidusage(currentProc.pid, (err, stats) => {
              if (!err && stats && mainWindow) {
                mainWindow.webContents.send('server-stats', {
                  serverId,
                  stats: {
                    cpu: Math.round(stats.cpu),
                    memoryMB: Math.round(stats.memory / (1024 * 1024))
                  }
                });
              }
            });
          } else {
            clearInterval(statsIntervals[serverId]);
            delete statsIntervals[serverId];
          }
        }, 2000);
      }

      // Player join/leave check
      const joinMatch = line.match(/\[Server thread\/INFO\]: (\w+) joined the game/);
      if (joinMatch) {
        const username = joinMatch[1];
        if (!serverPlayers[serverId]) serverPlayers[serverId] = [];
        if (!serverPlayers[serverId].includes(username)) {
          serverPlayers[serverId].push(username);
          if (mainWindow) mainWindow.webContents.send('server-players-change', { serverId, players: serverPlayers[serverId] });
        }
      }

      const leaveMatch = line.match(/\[Server thread\/INFO\]: (\w+) left the game/);
      if (leaveMatch) {
        const username = leaveMatch[1];
        if (serverPlayers[serverId]) {
          serverPlayers[serverId] = serverPlayers[serverId].filter(p => p !== username);
          if (mainWindow) mainWindow.webContents.send('server-players-change', { serverId, players: serverPlayers[serverId] });
        }
      }
    };

    const handleStreamData = (data) => {
      buffer += data.toString();
      let lines = buffer.split(/\r?\n/);
      // Keep the last partial line in the buffer
      buffer = lines.pop();
      for (const line of lines) {
        handleLogLine(line);
      }
    };

    proc.stdout.on('data', handleStreamData);
    proc.stderr.on('data', handleStreamData);

    proc.on('close', (code) => {
      delete serverProcesses[serverId];
      serverStatuses[serverId] = 'stopped';
      serverPlayers[serverId] = [];

      if (statsIntervals[serverId]) {
        clearInterval(statsIntervals[serverId]);
        delete statsIntervals[serverId];
      }
      
      // Check if any other processes are running before clearing pidusage
      if (Object.keys(serverProcesses).length === 0) {
        pidusage.clear();
      }

      if (mainWindow) {
        mainWindow.webContents.send('server-stats', { serverId, stats: { cpu: 0, memoryMB: 0 } });
        mainWindow.webContents.send('server-status-change', { serverId, status: 'stopped' });
        mainWindow.webContents.send('server-players-change', { serverId, players: [] });
        mainWindow.webContents.send('server-log', { serverId, line: `[Dashboard]: Server process exited with code ${code}` });
      }
    });

    proc.on('error', (err) => {
      console.error(`Failed to start server process for ${serverId}:`, err);
      delete serverProcesses[serverId];
      serverStatuses[serverId] = 'stopped';
      serverPlayers[serverId] = [];

      if (statsIntervals[serverId]) {
        clearInterval(statsIntervals[serverId]);
        delete statsIntervals[serverId];
      }

      if (Object.keys(serverProcesses).length === 0) {
        pidusage.clear();
      }

      if (mainWindow) {
        mainWindow.webContents.send('server-stats', { serverId, stats: { cpu: 0, memoryMB: 0 } });
        mainWindow.webContents.send('server-status-change', { serverId, status: 'stopped' });
        mainWindow.webContents.send('server-error', { serverId, error: err.message });
        mainWindow.webContents.send('server-log', { serverId, line: `[Dashboard Error]: ${err.message}` });
      }
    });

    return { success: true };
  } catch (e) {
    serverStatuses[serverId] = 'stopped';
    if (mainWindow) mainWindow.webContents.send('server-status-change', { serverId, status: 'stopped' });
    return { success: false, error: e.message };
  }
});

// Stop server process
ipcMain.handle('stop-server', async (event, serverId) => {
  const proc = serverProcesses[serverId];
  if (!proc) return { success: false, error: 'Server is not running' };

  try {
    // Send stop command to stdin
    proc.stdin.write('stop\n');
    
    // Set safety timeout to kill if unresponsive
    const killTimeout = setTimeout(() => {
      const p = serverProcesses[serverId];
      if (p) {
        console.log(`Force killing server process ${serverId}...`);
        p.kill('SIGKILL');
      }
    }, 15000);

    // Clean up timeout if process exits
    proc.once('close', () => {
      clearTimeout(killTimeout);
    });

    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Send console command
ipcMain.handle('send-server-command', async (event, { serverId, command }) => {
  const proc = serverProcesses[serverId];
  if (!proc) return { success: false, error: 'Server is not running' };

  try {
    proc.stdin.write(`${command}\n`);
    // Echo command in local console log
    if (mainWindow) {
      mainWindow.webContents.send('server-log', { serverId, line: `> ${command}` });
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// EULA accepted/check helper
ipcMain.handle('check-eula-status', async (event, installDir) => {
  if (!installDir || !fs.existsSync(installDir)) return false;
  const eulaPath = path.join(installDir, 'eula.txt');
  if (!fs.existsSync(eulaPath)) return false;
  try {
    const content = fs.readFileSync(eulaPath, 'utf-8');
    return content.includes('eula=true');
  } catch (e) {
    return false;
  }
});

ipcMain.handle('accept-eula', async (event, installDir) => {
  try {
    if (!fs.existsSync(installDir)) {
      fs.mkdirSync(installDir, { recursive: true });
    }
    const eulaPath = path.join(installDir, 'eula.txt');
    const content = `# By changing the setting below to TRUE you are indicating your agreement to our EULA (https://aka.ms/MinecraftEULA).\neula=true\n`;
    fs.writeFileSync(eulaPath, content, 'utf-8');
    return true;
  } catch (e) {
    console.error('Failed to accept EULA', e);
    return false;
  }
});

// Properties read / write
ipcMain.handle('read-properties', async (event, installDir) => {
  const filePath = path.join(installDir, 'server.properties');
  if (!fs.existsSync(filePath)) return {};
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const properties = {};
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const index = trimmed.indexOf('=');
      if (index === -1) continue;
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim();
      properties[key] = value;
    }
    return properties;
  } catch (e) {
    console.error('Failed to read server.properties', e);
    return {};
  }
});

ipcMain.handle('write-properties', async (event, { installDir, properties }) => {
  try {
    if (!fs.existsSync(installDir)) {
      fs.mkdirSync(installDir, { recursive: true });
    }
    const filePath = path.join(installDir, 'server.properties');
    
    // Read existing properties to preserve comments or other settings if possible
    let existingContent = '';
    if (fs.existsSync(filePath)) {
      existingContent = fs.readFileSync(filePath, 'utf-8');
    }
    
    const lines = existingContent.split(/\r?\n/);
    const updatedKeys = new Set();
    let newLines = [];

    // First update existing property lines
    for (let line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const index = trimmed.indexOf('=');
        if (index !== -1) {
          const key = trimmed.slice(0, index).trim();
          if (properties.hasOwnProperty(key)) {
            newLines.push(`${key}=${properties[key]}`);
            updatedKeys.add(key);
            continue;
          }
        }
      }
      newLines.push(line);
    }

    // Now append any properties that weren't in the original file
    for (const [key, value] of Object.entries(properties)) {
      if (!updatedKeys.has(key)) {
        newLines.push(`${key}=${value}`);
      }
    }

    fs.writeFileSync(filePath, newLines.join('\n'), 'utf-8');
    return { success: true };
  } catch (e) {
    console.error('Failed to write server.properties', e);
    return { success: false, error: e.message };
  }
});

// Whitelist IO and UUID resolution
ipcMain.handle('read-whitelist', async (event, installDir) => {
  const whitelistPath = path.join(installDir, 'whitelist.json');
  if (!fs.existsSync(whitelistPath)) return [];
  try {
    const content = fs.readFileSync(whitelistPath, 'utf-8');
    const parsed = JSON.parse(content);
    return parsed.map(p => p.name);
  } catch (e) {
    console.error('Failed to read whitelist', e);
    return [];
  }
});

ipcMain.handle('add-to-whitelist', async (event, { installDir, username }) => {
  const whitelistPath = path.join(installDir, 'whitelist.json');
  let whitelist = [];
  if (fs.existsSync(whitelistPath)) {
    try {
      whitelist = JSON.parse(fs.readFileSync(whitelistPath, 'utf-8'));
    } catch (e) {
      console.error('Failed to read existing whitelist', e);
    }
  }

  // Check if already in whitelist
  if (whitelist.some(p => p.name.toLowerCase() === username.toLowerCase())) {
    return { success: true };
  }

  let uuid = '';
  try {
    const result = await httpGetJson(`https://api.mojang.com/users/profiles/minecraft/${username}`);
    if (result && result.id) {
      const id = result.id;
      uuid = `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
    }
  } catch (e) {
    console.warn(`Could not resolve Mojang UUID for ${username}, using offline fallback`, e);
  }

  if (!uuid) {
    const crypto = require('crypto');
    const hash = crypto.createHash('md5').update(`OfflinePlayer:${username}`).digest();
    hash[6] = (hash[6] & 0x0f) | 0x30;
    hash[8] = (hash[8] & 0x3f) | 0x80;
    const hex = hash.toString('hex');
    uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  whitelist.push({ uuid, name: username });

  try {
    if (!fs.existsSync(installDir)) {
      fs.mkdirSync(installDir, { recursive: true });
    }
    fs.writeFileSync(whitelistPath, JSON.stringify(whitelist, null, 2), 'utf-8');
    
    // Reload whitelist in-game
    if (serverProcess) {
      serverProcess.stdin.write('whitelist reload\n');
    }
    return { success: true };
  } catch (e) {
    console.error('Failed to save whitelist', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('remove-from-whitelist', async (event, { installDir, username }) => {
  const whitelistPath = path.join(installDir, 'whitelist.json');
  if (!fs.existsSync(whitelistPath)) return { success: true };
  try {
    let whitelist = JSON.parse(fs.readFileSync(whitelistPath, 'utf-8'));
    whitelist = whitelist.filter(p => p.name.toLowerCase() !== username.toLowerCase());
    fs.writeFileSync(whitelistPath, JSON.stringify(whitelist, null, 2), 'utf-8');
    
    // Reload whitelist in-game
    if (serverProcess) {
      serverProcess.stdin.write('whitelist reload\n');
    }
    return { success: true };
  } catch (e) {
    console.error('Failed to write whitelist', e);
    return { success: false, error: e.message };
  }
});

// Get world name helper
function getLevelName(installDir) {
  const propertiesPath = path.join(installDir, 'server.properties');
  if (!fs.existsSync(propertiesPath)) return 'world';
  try {
    const content = fs.readFileSync(propertiesPath, 'utf-8');
    const match = content.match(/^level-name\s*=\s*([^\r\n]+)/m);
    return match ? match[1].trim() : 'world';
  } catch (e) {
    return 'world';
  }
}

// Get all players (scans world/playerdata or world/players/data)
ipcMain.handle('get-all-players', async (event, { serverId, installDir }) => {
  try {
    const levelName = getLevelName(installDir);
    let playerdataDir = path.join(installDir, levelName, 'playerdata');
    if (!fs.existsSync(playerdataDir)) {
      playerdataDir = path.join(installDir, levelName, 'players', 'data');
    }
    const cachePath = path.join(installDir, 'usercache.json');

    // Parse user cache
    const usercacheMap = {};
    const uuidMapByName = {};
    if (fs.existsSync(cachePath)) {
      try {
        const cacheContent = fs.readFileSync(cachePath, 'utf-8');
        const cache = JSON.parse(cacheContent);
        for (const entry of cache) {
          if (entry.uuid && entry.name) {
            usercacheMap[entry.uuid] = entry.name;
            uuidMapByName[entry.name.toLowerCase()] = entry.uuid;
          }
        }
      } catch (e) {
        console.error('Failed to parse usercache.json', e);
      }
    }

    const playersList = [];
    const addedUuids = new Set();
    const activePlayers = serverPlayers[serverId] || [];

    // 1. Scan playerdata files on disk
    if (fs.existsSync(playerdataDir)) {
      const files = fs.readdirSync(playerdataDir);
      for (const filename of files) {
        if (filename.endsWith('.dat')) {
          const uuid = filename.slice(0, -4);
          const name = usercacheMap[uuid] || uuid;
          playersList.push({
            uuid,
            name,
            online: activePlayers.includes(name)
          });
          addedUuids.add(uuid);
        }
      }
    }

    // 2. Merge online players who haven't saved to disk yet
    for (const onlineName of activePlayers) {
      const resolvedUuid = uuidMapByName[onlineName.toLowerCase()];
      if (resolvedUuid && !addedUuids.has(resolvedUuid)) {
        playersList.push({
          uuid: resolvedUuid,
          name: onlineName,
          online: true
        });
        addedUuids.add(resolvedUuid);
      } else if (!resolvedUuid) {
        // Generate offline fallback UUID
        const crypto = require('crypto');
        const hash = crypto.createHash('md5').update(`OfflinePlayer:${onlineName}`).digest();
        hash[6] = (hash[6] & 0x0f) | 0x30;
        hash[8] = (hash[8] & 0x3f) | 0x80;
        const hex = hash.toString('hex');
        const fallbackUuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
        
        if (!addedUuids.has(fallbackUuid)) {
          playersList.push({
            uuid: fallbackUuid,
            name: onlineName,
            online: true
          });
          addedUuids.add(fallbackUuid);
        }
      }
    }

    return playersList;
  } catch (e) {
    console.error('Failed to get all players', e);
    return [];
  }
});

// Get detailed player profile (NBT data, stats, achievements, filtered logs)
ipcMain.handle('get-player-profile', async (event, { installDir, uuid, username }) => {
  try {
    const levelName = getLevelName(installDir);
    const worldDir = path.join(installDir, levelName);
    
    let datPath = path.join(worldDir, 'playerdata', `${uuid}.dat`);
    if (!fs.existsSync(datPath)) {
      datPath = path.join(worldDir, 'players', 'data', `${uuid}.dat`);
    }

    let statsPath = path.join(worldDir, 'stats', `${uuid}.json`);
    if (!fs.existsSync(statsPath)) {
      statsPath = path.join(worldDir, 'players', 'stats', `${uuid}.json`);
    }

    let advPath = path.join(worldDir, 'advancements', `${uuid}.json`);
    if (!fs.existsSync(advPath)) {
      advPath = path.join(worldDir, 'players', 'advancements', `${uuid}.json`);
    }

    const logPath = path.join(installDir, 'logs', 'latest.log');

    const profile = {
      nbt: null,
      stats: null,
      advancements: [],
      logs: []
    };

    // 1. Read Player NBT Data
    if (fs.existsSync(datPath)) {
      try {
        const buffer = fs.readFileSync(datPath);
        const nbtData = await parseNbtBuffer(buffer);
        const datStats = fs.statSync(datPath);

        // Map dimensions
        let dim = 'Overworld';
        if (nbtData.Dimension === -1 || nbtData.Dimension === 'minecraft:the_nether') dim = 'Nether';
        else if (nbtData.Dimension === 1 || nbtData.Dimension === 'minecraft:the_end') dim = 'End';

        // Map inventory & ender chest items
        const mapItems = (itemsList) => {
          if (!itemsList || !Array.isArray(itemsList)) return [];
          return itemsList.map(item => ({
            id: item.id ? item.id.replace('minecraft:', '') : 'unknown',
            count: item.Count || item.count || 1,
            slot: item.Slot || 0
          }));
        };

        // Gamemode labeling
        const gamemodes = ['Survival', 'Creative', 'Adventure', 'Spectator'];
        const gmMode = gamemodes[nbtData.playerGameType] || 'Survival';

        profile.nbt = {
          pos: nbtData.Pos ? nbtData.Pos.map(p => Math.round(p * 100) / 100) : [0, 0, 0],
          rotation: nbtData.Rotation ? nbtData.Rotation.map(r => Math.round(r * 100) / 100) : [0, 0],
          dimension: dim,
          xpLevel: nbtData.XpLevel || 0,
          xpProgress: Math.round((nbtData.XpP || 0) * 100),
          health: Math.round(nbtData.Health || 20),
          hunger: Math.round(nbtData.foodLevel || 20),
          gamemode: gmMode,
          effects: nbtData.ActiveEffects ? nbtData.ActiveEffects.map(e => ({
            id: e.id ? e.id.replace('minecraft:', '') : `Effect ID: ${e.Id}`,
            amplifier: e.Amplifier || 0,
            duration: Math.round((e.Duration || 0) / 20) // in seconds
          })) : [],
          inventory: mapItems(nbtData.Inventory),
          enderchest: mapItems(nbtData.EnderItems),
          lastLogout: datStats.mtime.toISOString()
        };
      } catch (e) {
        console.error('Failed to parse player NBT file', e);
      }
    }

    // 2. Read Player Stats
    if (fs.existsSync(statsPath)) {
      try {
        const statsContent = fs.readFileSync(statsPath, 'utf-8');
        const statsObj = JSON.parse(statsContent);

        // Helper to query numbers matching keys
        const getStatValue = (regex) => {
          let sum = 0;
          const search = (obj) => {
            if (!obj || typeof obj !== 'object') return;
            for (const [k, v] of Object.entries(obj)) {
              if (regex.test(k) && typeof v === 'number') {
                sum += v;
              } else if (typeof v === 'object') {
                search(v);
              }
            }
          };
          search(statsObj);
          return sum;
        };

        // Custom Mined block count summing
        let mined = 0;
        const searchMined = (obj) => {
          if (!obj || typeof obj !== 'object') return;
          for (const [k, v] of Object.entries(obj)) {
            if ((k.includes('minecraft:mined') || k.includes('stat.mineBlock')) && typeof v === 'object') {
              for (const count of Object.values(v)) {
                if (typeof count === 'number') mined += count;
              }
            } else if (typeof v === 'number' && k.includes('stat.mineBlock')) {
              mined += v;
            } else if (typeof v === 'object') {
              searchMined(v);
            }
          }
        };
        searchMined(statsObj);

        // Diamonds mined block count summing
        let diamonds = 0;
        const searchDiamonds = (obj) => {
          if (!obj || typeof obj !== 'object') return;
          for (const [k, v] of Object.entries(obj)) {
            if ((k.includes('diamond_ore') || k.includes('deepslate_diamond_ore') || k.includes('oreDiamond')) && typeof v === 'number') {
              diamonds += v;
            } else if (typeof v === 'object') {
              searchDiamonds(v);
            }
          }
        };
        searchDiamonds(statsObj);

        profile.stats = {
          walkDistance: Math.round(getStatValue(/walk_one_cm|walkOneCm/) / 100), // convert to meters
          flyDistance: Math.round(getStatValue(/fly_one_cm|flyOneCm|aviator_one_cm/) / 100),
          swimDistance: Math.round(getStatValue(/swim_one_cm|swimOneCm/) / 100),
          minedBlocks: mined,
          kills: getStatValue(/mob_kills|mobKills|player_kills|playerKills/),
          deaths: getStatValue(/deaths|deaths/),
          chestsOpened: getStatValue(/open_chest|chestOpened/),
          diamondsMined: diamonds
        };
      } catch (e) {
        console.error('Failed to parse player stats file', e);
      }
    }

    // 3. Read Player Advancements
    if (fs.existsSync(advPath)) {
      try {
        const advContent = fs.readFileSync(advPath, 'utf-8');
        const advObj = JSON.parse(advContent);
        const achievementsList = [];

        for (const [key, val] of Object.entries(advObj)) {
          if (key !== 'DataVersion' && val && typeof val === 'object' && val.done) {
            // Find earliest criteria achievement date
            let earliestDate = null;
            if (val.criteria && typeof val.criteria === 'object') {
              for (const time of Object.values(val.criteria)) {
                if (time) {
                  const d = new Date(time);
                  if (!earliestDate || d < earliestDate) {
                    earliestDate = d;
                  }
                }
              }
            }

            if (earliestDate) {
              // Format key name e.g. "minecraft:story/mine_stone" -> "Mine Stone"
              const parts = key.replace('minecraft:', '').split('/');
              const lastPart = parts[parts.length - 1];
              const cleanName = lastPart
                .replace(/_/g, ' ')
                .split(' ')
                .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                .join(' ');

              achievementsList.push({
                id: key,
                name: cleanName,
                time: earliestDate.toISOString()
              });
            }
          }
        }

        // Sort chronologically
        achievementsList.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
        profile.advancements = achievementsList;
      } catch (e) {
        console.error('Failed to parse player advancements file', e);
      }
    }

    // 4. Scan Log History for Player Actions
    if (fs.existsSync(logPath)) {
      try {
        const logContent = fs.readFileSync(logPath, 'utf-8');
        const lines = logContent.split(/\r?\n/);
        const filteredLines = [];
        
        // Match player name (case-insensitive)
        const nameRegex = new RegExp(`\\b${username}\\b`, 'i');

        for (const line of lines) {
          if (nameRegex.test(line)) {
            filteredLines.push(line);
          }
        }

        // Return up to the last 200 occurrences
        profile.logs = filteredLines.slice(-200);
      } catch (e) {
        console.error('Failed to parse server logs for player history', e);
      }
    }

    return profile;
  } catch (e) {
    console.error('Failed to compile player profile', e);
    return null;
  }
});

// Detect if a server directory is Fabric and try to find its MC version
ipcMain.handle('detect-server-type', async (event, installDir) => {
  if (!installDir || !fs.existsSync(installDir)) return { type: 'vanilla', mcVersion: null };

  const isFabric = fs.existsSync(path.join(installDir, 'fabric-server-launch.properties'));

  // Try to read MC version from version.json (written by Fabric launcher)
  let mcVersion = null;
  const versionJsonPath = path.join(installDir, 'version.json');
  if (fs.existsSync(versionJsonPath)) {
    try {
      const vj = JSON.parse(fs.readFileSync(versionJsonPath, 'utf-8'));
      mcVersion = vj.id || vj.name || null;
    } catch (e) {}
  }

  // Fallback: check .fabric/server/fabric-server-launch.json
  if (!mcVersion) {
    const fabricLaunchPath = path.join(installDir, '.fabric', 'server', 'fabric-server-launch.json');
    if (fs.existsSync(fabricLaunchPath)) {
      try {
        const fl = JSON.parse(fs.readFileSync(fabricLaunchPath, 'utf-8'));
        mcVersion = fl.gameVersion || null;
      } catch (e) {}
    }
  }

  return { type: isFabric ? 'fabric' : 'vanilla', mcVersion };
});

// Search Modrinth for mods compatible with a specific MC version and Fabric loader
ipcMain.handle('search-mods', async (event, { query, mcVersion, offset = 0 }) => {
  try {
    const facets = JSON.stringify([
      ['project_type:mod'],
      ['categories:fabric'],
      [`versions:${mcVersion}`]
    ]);
    const encodedFacets = encodeURIComponent(facets);
    const encodedQuery = encodeURIComponent(query || '');
    const url = `https://api.modrinth.com/v2/search?query=${encodedQuery}&facets=${encodedFacets}&limit=20&offset=${offset}`;
    const data = await httpGetJson(url);
    return { success: true, hits: data.hits || [], total: data.total_hits || 0 };
  } catch (e) {
    return { success: false, error: e.message, hits: [], total: 0 };
  }
});

// Get latest compatible version file for a Modrinth project
ipcMain.handle('get-mod-download', async (event, { projectId, mcVersion }) => {
  try {
    const loaders = encodeURIComponent(JSON.stringify(['fabric']));
    const versions = encodeURIComponent(JSON.stringify([mcVersion]));
    const url = `https://api.modrinth.com/v2/project/${projectId}/version?loaders=${loaders}&game_versions=${versions}`;
    const versionList = await httpGetJson(url);
    if (!versionList || versionList.length === 0) {
      return { success: false, error: 'No compatible version found for this Minecraft version.' };
    }
    const latest = versionList[0];
    const primaryFile = latest.files.find(f => f.primary) || latest.files[0];
    if (!primaryFile) {
      return { success: false, error: 'No download file found.' };
    }
    return {
      success: true,
      url: primaryFile.url,
      filename: primaryFile.filename,
      size: primaryFile.size,
      versionName: latest.name
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Download and install a mod to the server's mods/ folder
ipcMain.handle('install-mod', async (event, { installDir, url, filename }) => {
  try {
    const modsDir = path.join(installDir, 'mods');
    if (!fs.existsSync(modsDir)) {
      fs.mkdirSync(modsDir, { recursive: true });
    }
    const dest = path.join(modsDir, filename);
    await downloadFile(url, dest, (percent) => {
      if (mainWindow) mainWindow.webContents.send('mod-install-progress', { filename, percent });
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// List installed mods in the mods/ folder
ipcMain.handle('get-installed-mods', async (event, installDir) => {
  const modsDir = path.join(installDir, 'mods');
  if (!fs.existsSync(modsDir)) return [];
  try {
    return fs.readdirSync(modsDir)
      .filter(f => f.endsWith('.jar'))
      .map(f => {
        const stat = fs.statSync(path.join(modsDir, f));
        return { filename: f, sizeMB: Math.round(stat.size / (1024 * 1024) * 10) / 10 };
      });
  } catch (e) {
    return [];
  }
});

// Remove a mod from the mods/ folder
ipcMain.handle('remove-mod', async (event, { installDir, filename }) => {
  try {
    const modPath = path.join(installDir, 'mods', filename);
    if (fs.existsSync(modPath)) {
      fs.unlinkSync(modPath);
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Clean up processes on exit or signal
const cleanUpProcesses = () => {
  for (const proc of Object.values(serverProcesses)) {
    if (proc) {
      try {
        proc.kill('SIGKILL');
      } catch (e) {
        console.error('Failed to kill server process on exit', e);
      }
    }
  }
};

process.on('exit', cleanUpProcesses);
process.on('SIGINT', () => {
  cleanUpProcesses();
  process.exit(0);
});
process.on('SIGTERM', () => {
  cleanUpProcesses();
  process.exit(0);
});

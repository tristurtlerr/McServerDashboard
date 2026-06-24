interface Window {
  api: {
    selectDirectory: () => Promise<string | null>;
    getSystemInfo: () => Promise<{ totalMemoryMB: number; hasJava: boolean }>;
    fetchMinecraftVersions: () => Promise<{
      vanilla: Array<{ id: string; type: string; url: string }>;
      fabricLoaders: Array<{ version: string; stable: boolean }>;
      fabricInstallers: Array<{ version: string; stable: boolean }>;
    }>;
    downloadServer: (params: {
      type: 'vanilla' | 'fabric';
      version: string;
      loaderVersion?: string;
      installerVersion?: string;
      installDir: string;
    }) => Promise<{ success: boolean; jarPath?: string; error?: string }>;
    checkServerInstalled: (dir: string) => Promise<{ installed: boolean; eulaAccepted: boolean }>;
    getAppConfig: () => Promise<{
      servers: Array<{ id: string; name: string; installDir: string; ramMB: number }>;
      activeServerId: string;
    }>;
    saveAppConfig: (config: {
      servers: Array<{ id: string; name: string; installDir: string; ramMB: number }>;
      activeServerId: string;
    }) => Promise<boolean>;
    getServerStatuses: () => Promise<Record<string, 'stopped' | 'starting' | 'running'>>;
    getServerPlayers: () => Promise<Record<string, string[]>>;
    resizeWindow: (width: number, height: number) => Promise<void>;
    startServer: (params: { serverId: string; installDir: string; ramMB: number }) => Promise<{ success: boolean; error?: string }>;
    stopServer: (serverId: string) => Promise<{ success: boolean; error?: string }>;
    sendServerCommand: (serverId: string, cmd: string) => Promise<{ success: boolean; error?: string }>;
    checkEulaStatus: (dir: string) => Promise<boolean>;
    acceptEula: (dir: string) => Promise<boolean>;
    readProperties: (dir: string) => Promise<Record<string, string>>;
    writeProperties: (dir: string, props: Record<string, string>) => Promise<{ success: boolean; error?: string }>;
    readWhitelist: (dir: string) => Promise<string[]>;
    addToWhitelist: (dir: string, name: string) => Promise<{ success: boolean; error?: string }>;
    removeFromWhitelist: (dir: string, name: string) => Promise<{ success: boolean; error?: string }>;
    getAllPlayers: (serverId: string, dir: string) => Promise<Array<{ uuid: string; name: string; online: boolean }>>;
    getPlayerProfile: (dir: string, uuid: string, name: string) => Promise<{
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
        inventory: Array<{ id: string; count: number; slot: number }>;
        enderchest: Array<{ id: string; count: number; slot: number }>;
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
    } | null>;

    onDownloadProgress: (callback: (data: { percent: number; downloadedBytes: number; totalBytes: number }) => void) => () => void;
    onServerLog: (callback: (data: { serverId: string; line: string }) => void) => () => void;
    onServerStatusChange: (callback: (data: { serverId: string; status: 'stopped' | 'starting' | 'running' }) => void) => () => void;
    onServerPlayersChange: (callback: (data: { serverId: string; players: string[] }) => void) => () => void;
    onServerError: (callback: (data: { serverId: string; error: string }) => void) => () => void;
    onServerStats: (callback: (data: { serverId: string; stats: { cpu: number; memoryMB: number } }) => void) => () => void;
  }
}

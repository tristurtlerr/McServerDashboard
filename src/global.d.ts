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
    getAppConfig: () => Promise<{ installDir: string; ramMB: number }>;
    saveAppConfig: (config: { installDir: string; ramMB: number }) => Promise<boolean>;
    startServer: (params: { installDir: string; ramMB: number }) => Promise<{ success: boolean; error?: string }>;
    stopServer: () => Promise<{ success: boolean; error?: string }>;
    sendServerCommand: (cmd: string) => Promise<{ success: boolean; error?: string }>;
    checkEulaStatus: (dir: string) => Promise<boolean>;
    acceptEula: (dir: string) => Promise<boolean>;
    readProperties: (dir: string) => Promise<Record<string, string>>;
    writeProperties: (dir: string, props: Record<string, string>) => Promise<{ success: boolean; error?: string }>;
    readWhitelist: (dir: string) => Promise<string[]>;
    addToWhitelist: (dir: string, name: string) => Promise<{ success: boolean; error?: string }>;
    removeFromWhitelist: (dir: string, name: string) => Promise<{ success: boolean; error?: string }>;
    getAllPlayers: (dir: string) => Promise<Array<{ uuid: string; name: string; online: boolean }>>;
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
    onServerLog: (callback: (line: string) => void) => () => void;
    onServerStatusChange: (callback: (status: 'stopped' | 'starting' | 'running') => void) => () => void;
    onServerPlayersChange: (callback: (players: string[]) => void) => () => void;
    onServerError: (callback: (err: string) => void) => () => void;
    onServerStats: (callback: (stats: { cpu: number; memoryMB: number }) => void) => () => void;
  }
}

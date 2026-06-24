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

    onDownloadProgress: (callback: (data: { percent: number; downloadedBytes: number; totalBytes: number }) => void) => () => void;
    onServerLog: (callback: (line: string) => void) => () => void;
    onServerStatusChange: (callback: (status: 'stopped' | 'starting' | 'running') => void) => () => void;
    onServerPlayersChange: (callback: (players: string[]) => void) => () => void;
    onServerError: (callback: (err: string) => void) => () => void;
  }
}

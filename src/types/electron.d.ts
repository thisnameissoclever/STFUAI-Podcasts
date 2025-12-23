export interface ElectronAPI {
    downloadFile: (url: string, filename: string) => Promise<string>;
    cancelDownload: (filename: string) => Promise<void>;
    deleteFile: (filename: string) => Promise<void>;
    checkFileExists: (filename: string) => Promise<boolean>;
    readFile: (filename: string) => Promise<ArrayBuffer>;
    getFilePath: (filename: string) => Promise<string>;
    readFileBase64: (filename: string) => Promise<string>;
    compressAudio: (filename: string, bitrateKbps?: number) => Promise<string>;
    restartApp: () => Promise<void>;
    clearAllData: () => Promise<boolean>;
    openStorageFolder: () => Promise<void>;
    getStorageInfo: () => Promise<{
        totalSizeBytes: number;
        totalSizeMB: string;
        fileCount: number;
        storagePath: string;
    }>;
    openExternal: (url: string) => Promise<void>;
    checkForUpdates: (options?: { allowPrerelease?: boolean; silent?: boolean }) => Promise<any>;
    downloadUpdate: () => Promise<void>;
    quitAndInstall: () => Promise<void>;
    getVersion: () => Promise<string>;
    onUpdateStatus: (callback: (status: any) => void) => () => void;
    secureStorageAvailable: () => Promise<boolean>;
    secureStorageSet: (key: string, value: string) => Promise<boolean>;
    secureStorageGet: (key: string) => Promise<string | null>;
    secureStorageDelete: (key: string) => Promise<boolean>;
    onAuthCallback: (callback: (tokens: { access_token: string; refresh_token: string }) => void) => () => void;
}

declare global {
    interface Window {
        electronAPI?: ElectronAPI;
    }
}

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    ping: () => ipcRenderer.invoke('ping'),
    downloadFile: (url: string, filename: string) => ipcRenderer.invoke('download-file', url, filename),
    deleteFile: (filename: string) => ipcRenderer.invoke('delete-file', filename),
    checkFileExists: (filename: string) => ipcRenderer.invoke('check-file-exists', filename),
    readFile: (filename: string) => ipcRenderer.invoke('read-file', filename),
    getFilePath: (filename: string) => ipcRenderer.invoke('get-file-path', filename),
    readFileBase64: (filename: string) => ipcRenderer.invoke('read-file-base64', filename),
    compressAudio: (filename: string, bitrateKbps?: number) => ipcRenderer.invoke('compress-audio', filename, bitrateKbps),
    cancelDownload: (filename: string) => ipcRenderer.invoke('cancel-download', filename),
    restartApp: () => ipcRenderer.invoke('restart-app'),
    clearAllData: () => ipcRenderer.invoke('clear-all-data'),
    openStorageFolder: () => ipcRenderer.invoke('open-storage-folder'),
    getStorageInfo: () => ipcRenderer.invoke('get-storage-info'),
    openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
    checkForUpdates: (options?: { allowPrerelease?: boolean; silent?: boolean }) => ipcRenderer.invoke('check-for-updates', options),
    downloadUpdate: () => ipcRenderer.invoke('download-update'),
    quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
    getVersion: () => ipcRenderer.invoke('get-version'),
    onUpdateStatus: (callback: (status: any) => void) => {
        const subscription = (_: any, value: any) => callback(value);
        ipcRenderer.on('update-status', subscription);
        return () => ipcRenderer.removeListener('update-status', subscription);
    },
    // Secure storage for API keys (uses OS-level encryption)
    secureStorageAvailable: () => ipcRenderer.invoke('secure-storage-available'),
    secureStorageSet: (key: string, value: string) => ipcRenderer.invoke('secure-storage-set', key, value),
    secureStorageGet: (key: string) => ipcRenderer.invoke('secure-storage-get', key),
    secureStorageDelete: (key: string) => ipcRenderer.invoke('secure-storage-delete', key),
    // OAuth callback handler
    onAuthCallback: (callback: (tokens: { access_token: string; refresh_token: string }) => void) => {
        const subscription = (_: any, value: any) => callback(value);
        ipcRenderer.on('supabase-auth-callback', subscription);
        return () => ipcRenderer.removeListener('supabase-auth-callback', subscription);
    },
});


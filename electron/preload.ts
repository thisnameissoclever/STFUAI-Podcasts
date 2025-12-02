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
    getStorageInfo: () => ipcRenderer.invoke('get-storage-info'),
    checkForUpdates: (options?: { allowPrerelease: boolean }) => ipcRenderer.invoke('check-for-updates', options),
    downloadUpdate: () => ipcRenderer.invoke('download-update'),
    quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
    getVersion: () => ipcRenderer.invoke('get-version'),
    onUpdateStatus: (callback: (status: any) => void) => {
        const subscription = (_: any, value: any) => callback(value);
        ipcRenderer.on('update-status', subscription);
        return () => ipcRenderer.removeListener('update-status', subscription);
    },
});

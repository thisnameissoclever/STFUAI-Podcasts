export interface StorageService {
    downloadFile(url: string, filename: string): Promise<string>;
    cancelDownload(filename: string): Promise<void>;
    deleteFile(filename: string): Promise<void>;
    checkFileExists(filename: string): Promise<boolean>;
    readFile(filename: string): Promise<ArrayBuffer>;
    getFilePath(filename: string): string;
}

// Define the Electron API exposed via preload
interface ElectronAPI {
    downloadFile: (url: string, filename: string) => Promise<string>;
    cancelDownload: (filename: string) => Promise<void>;
    deleteFile: (filename: string) => Promise<void>;
    checkFileExists: (filename: string) => Promise<boolean>;
    readFile: (filename: string) => Promise<ArrayBuffer>;
    getFilePath: (filename: string) => Promise<string>;
    readFileBase64: (filename: string) => Promise<string>;
    compressAudio: (filename: string, bitrateKbps?: number) => Promise<string>;
    restartApp: () => Promise<void>;
    getStorageInfo: () => Promise<{
        totalSizeBytes: number;
        totalSizeMB: string;
        fileCount: number;
        storagePath: string;
    }>;
}

declare global {
    interface Window {
        electronAPI?: ElectronAPI;
    }
}

class ElectronStorageService implements StorageService {
    async downloadFile(url: string, filename: string): Promise<string> {
        if (!window.electronAPI) throw new Error('Electron API not available');
        return window.electronAPI.downloadFile(url, filename);
    }

    async cancelDownload(filename: string): Promise<void> {
        if (!window.electronAPI) return;
        return window.electronAPI.cancelDownload(filename);
    }

    async deleteFile(filename: string): Promise<void> {
        if (!window.electronAPI) throw new Error('Electron API not available');
        return window.electronAPI.deleteFile(filename);
    }

    async checkFileExists(filename: string): Promise<boolean> {
        if (!window.electronAPI) return false;
        return window.electronAPI.checkFileExists(filename);
    }

    async readFile(filename: string): Promise<ArrayBuffer> {
        if (!window.electronAPI) throw new Error('Electron API not available');
        return window.electronAPI.readFile(filename);
    }

    getFilePath(filename: string): string {
        // This is tricky because we might not know the full path synchronously in renderer.
        // But we can return a protocol URL like 'local-media://filename'
        return `local-media://${filename}`;
    }
}

// Fallback for web (if needed later, for now just throws or uses IndexedDB)
class WebStorageService implements StorageService {
    async downloadFile(_url: string, _filename: string): Promise<string> { return ''; }
    async cancelDownload(_filename: string): Promise<void> { }
    async deleteFile(_filename: string): Promise<void> { }
    async checkFileExists(_filename: string): Promise<boolean> { return false; }
    async readFile(_filename: string): Promise<ArrayBuffer> { return new ArrayBuffer(0); }
    getFilePath(_filename: string): string { return ''; }
}

export const storageService = window.electronAPI ? new ElectronStorageService() : new WebStorageService();

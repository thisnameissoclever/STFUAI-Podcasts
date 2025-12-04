import { useState, useEffect, useCallback } from 'react';
import { db } from '../services/db';

export type UpdateStatus = 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';

export interface UpdateInfo {
    version: string;
    releaseDate: string;
    releaseNotes?: string;
}

export interface UpdateProgress {
    bytesPerSecond: number;
    percent: number;
    total: number;
    transferred: number;
}

export const useAutoUpdater = () => {
    const [status, setStatus] = useState<UpdateStatus>('idle');
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
    const [progress, setProgress] = useState<UpdateProgress | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!window.electronAPI) return;

        // Listen for status updates
        const unsubscribe = window.electronAPI.onUpdateStatus((data: any) => {
            console.log('[useAutoUpdater] Status update:', data);
            setStatus(data.status);

            if (data.info) {
                setUpdateInfo(data.info);
            }

            if (data.progress) {
                setProgress(data.progress);
            }

            if (data.error) {
                setError(data.error);
            }
        });

        // Check for updates on mount (silent) with a small delay
        // Check preferences first to see if user wants prereleases
        const initCheck = async () => {
            try {
                // Short delay to ensure app is ready
                await new Promise(resolve => setTimeout(resolve, 3000));

                const prefs = await db.getPreferences();
                const allowPrerelease = prefs?.includePrereleases ?? true; // Default to true if not set

                console.log('[useAutoUpdater] Starting silent check. Allow prerelease:', allowPrerelease);
                checkForUpdates({ silent: true, allowPrerelease });
            } catch (err) {
                console.error('[useAutoUpdater] Error initializing update check:', err);
            }
        };

        initCheck();

        return () => {
            unsubscribe();
        };
    }, []);

    const checkForUpdates = useCallback(async (options: { silent?: boolean; allowPrerelease?: boolean } = {}) => {
        if (!window.electronAPI) return;
        try {
            setStatus('checking');
            if (!options.silent) {
                setError(null);
            }
            await window.electronAPI.checkForUpdates(options);
        } catch (err: any) {
            console.error('Failed to check for updates:', err);
            if (!options.silent) {
                setStatus('error');
                setError(err.message);
            } else {
                // If silent, just log it and reset status to idle if it was checking
                setStatus('idle');
            }
        }
    }, []);

    const downloadUpdate = useCallback(async () => {
        if (!window.electronAPI) return;
        try {
            await window.electronAPI.downloadUpdate();
        } catch (err: any) {
            console.error('Failed to download update:', err);
            setStatus('error');
            setError(err.message);
        }
    }, []);

    const quitAndInstall = useCallback(async () => {
        if (!window.electronAPI) return;
        await window.electronAPI.quitAndInstall();
    }, []);

    return {
        status,
        updateInfo,
        progress,
        error,
        checkForUpdates,
        downloadUpdate,
        quitAndInstall
    };
};

import { db } from '../services/db';

let debugEnabled = false;

// Load debug preference on initialization
db.getPreferences().then(prefs => {
    debugEnabled = prefs.debugLogsEnabled;
}).catch(err => {
    console.error('Failed to load debug preference:', err);
});

// Allow updating debug preference
export function setDebugEnabled(enabled: boolean) {
    debugEnabled = enabled;
}

export const logger = {
    debug: (...args: any[]) => {
        if (debugEnabled) {
            console.log('[DEBUG]', ...args);
        }
    },
    info: (...args: any[]) => {
        console.log('[INFO]', ...args);
    },
    warn: (...args: any[]) => {
        console.warn('[WARN]', ...args);
    },
    error: (...args: any[]) => {
        console.error('[ERROR]', ...args);
    },
};

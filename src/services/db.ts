import { get, set, update, createStore } from 'idb-keyval';
import type { Podcast, Episode, UserSession, UserPreferences } from '../types';

// In-memory fallback storage
let memoryStorage: Record<string, any> = {};
let useMemoryFallback = false;
let dbInitialized = false;

// Create a custom store to ensure proper initialization
const customStore = createStore('podcatcher-db', 'podcatcher-store');

const DB_KEYS = {
    PODCASTS: 'podcasts',
    EPISODES: 'episodes',
    SESSION: 'session',
    PREFERENCES: 'preferences',
    PLAYER_STATE: 'playerState',
};

// Default values for settings, used if no value is found in the database or 
// whenever the user clears all data (e.g. via Settings > Reset button)
const DEFAULT_PREFERENCES: UserPreferences = {
    playbackSpeed: 1.0,
    theme: 'dark',
    volume: 0.65,
    transcriptionProvider: 'assemblyai',
    compressionQuality: 96,
    autoPlayNext: true,
    skipForwardSeconds: 30,
    skipBackwardSeconds: 20,
    debugLogsEnabled: true, //Set to false for production stable build
    refreshIntervalMinutes: 5,
    includePrereleases: true,
};

// Test IndexedDB availability
// Test IndexedDB availability with retry
async function initDB(retries = 3): Promise<void> {
    if (dbInitialized) return;

    try {
        // Try a simple operation to test if IndexedDB is working
        await set('_test', true, customStore);
        await get('_test', customStore);
        dbInitialized = true;
        console.log('[DB] IndexedDB initialized successfully');
    } catch (error) {
        console.error(`[DB] IndexedDB initialization failed (attempt ${4 - retries}/3):`, error);

        if (retries > 0) {
            console.log('[DB] Retrying initialization in 500ms...');
            await new Promise(resolve => setTimeout(resolve, 500));
            return initDB(retries - 1);
        }

        console.error('[DB] Giving up on IndexedDB, using in-memory storage.');
        useMemoryFallback = true;
        dbInitialized = true;
    }
}

// Wrapper for get operations with error handling
async function safeGet<T>(key: string, defaultValue: T): Promise<T> {
    await initDB();

    if (useMemoryFallback) {
        return (memoryStorage[key] as T) ?? defaultValue;
    }

    try {
        const result = await get(key, customStore);
        return result ?? defaultValue;
    } catch (error) {
        console.error(`[DB] Failed to get ${key}, using default:`, error);
        useMemoryFallback = true;
        return (memoryStorage[key] as T) ?? defaultValue;
    }
}

// Wrapper for set operations with error handling
async function safeSet(key: string, value: any): Promise<void> {
    await initDB();

    if (useMemoryFallback) {
        memoryStorage[key] = value;
        return;
    }

    try {
        await set(key, value, customStore);
    } catch (error) {
        console.error(`[DB] Failed to set ${key}, using memory fallback:`, error);
        useMemoryFallback = true;
        memoryStorage[key] = value;
    }
}

// Wrapper for update operations with error handling
async function safeUpdate<T>(key: string, updater: (val: T) => T, defaultValue: T): Promise<void> {
    await initDB();

    if (useMemoryFallback) {
        const current = (memoryStorage[key] as T) ?? defaultValue;
        memoryStorage[key] = updater(current);
        return;
    }

    try {
        await update(key, (val) => updater((val as T) ?? defaultValue), customStore);
    } catch (error) {
        console.error(`[DB] Failed to update ${key}, using memory fallback:`, error);
        useMemoryFallback = true;
        const current = (memoryStorage[key] as T) ?? defaultValue;
        memoryStorage[key] = updater(current);
    }
}

export const db = {
    // Podcasts
    async getPodcast(id: number): Promise<Podcast | undefined> {
        const podcasts = await this.getPodcasts();
        return podcasts[id];
    },

    async getPodcasts(): Promise<Record<number, Podcast>> {
        return await safeGet(DB_KEYS.PODCASTS, {});
    },

    async savePodcast(podcast: Podcast): Promise<void> {
        await safeUpdate(
            DB_KEYS.PODCASTS,
            (val: Record<number, Podcast>) => ({
                ...val,
                [podcast.id]: podcast,
            }),
            {}
        );
    },

    async removePodcast(id: number): Promise<void> {
        await safeUpdate(
            DB_KEYS.PODCASTS,
            (val: Record<number, Podcast>) => {
                const copy = { ...val };
                delete copy[id];
                return copy;
            },
            {}
        );
    },

    // Episodes
    async getEpisode(id: number): Promise<Episode | undefined> {
        const episodes = await this.getEpisodes();
        return episodes[id];
    },

    async getEpisodes(): Promise<Record<number, Episode>> {
        return await safeGet(DB_KEYS.EPISODES, {});
    },

    async saveEpisode(episode: Episode): Promise<void> {
        await safeUpdate(
            DB_KEYS.EPISODES,
            (val: Record<number, Episode>) => ({
                ...val,
                [episode.id]: episode,
            }),
            {}
        );
    },

    async saveEpisodes(episodes: Episode[]): Promise<void> {
        await safeUpdate(
            DB_KEYS.EPISODES,
            (val: Record<number, Episode>) => {
                const next = { ...val };
                episodes.forEach(ep => next[ep.id] = ep);
                return next;
            },
            {}
        );
    },

    async removeEpisode(id: number): Promise<void> {
        await safeUpdate(
            DB_KEYS.EPISODES,
            (val: Record<number, Episode>) => {
                const copy = { ...val };
                delete copy[id];
                return copy;
            },
            {}
        );
    },

    // Session
    async getSession(): Promise<UserSession | undefined> {
        return await safeGet(DB_KEYS.SESSION, undefined);
    },

    async saveSession(session: UserSession): Promise<void> {
        await safeSet(DB_KEYS.SESSION, session);
    },

    async updateSession(updater: (session: UserSession) => UserSession): Promise<void> {
        const current = await this.getSession();
        if (!current) throw new Error('No session found');
        await safeSet(DB_KEYS.SESSION, updater(current));
    },

    // Preferences
    async getPreferences(): Promise<UserPreferences> {
        const stored = await safeGet(DB_KEYS.PREFERENCES, DEFAULT_PREFERENCES);
        return { ...DEFAULT_PREFERENCES, ...stored };
    },

    async savePreferences(prefs: Partial<UserPreferences>): Promise<void> {
        await safeUpdate(
            DB_KEYS.PREFERENCES,
            (val: UserPreferences) => ({
                ...val,
                ...prefs,
            }),
            DEFAULT_PREFERENCES
        );
    },

    // Player State
    async getPlayerState(): Promise<any> {
        return await safeGet(DB_KEYS.PLAYER_STATE, null);
    },

    async savePlayerState(state: any): Promise<void> {
        await safeSet(DB_KEYS.PLAYER_STATE, state);
    },

    // Transcripts
    async saveTranscript(episodeId: number, transcript: any): Promise<void> {
        await safeUpdate(
            DB_KEYS.EPISODES,
            (val: Record<number, any>) => {
                const episode = val[episodeId];
                if (!episode) return val;

                return {
                    ...val,
                    [episodeId]: {
                        ...episode,
                        transcript,
                        transcriptionStatus: 'completed'
                    }
                };
            },
            {}
        );
    },

    async getTranscript(episodeId: number): Promise<any> {
        const episode = await this.getEpisode(episodeId);
        return episode?.transcript;
    },

    // Clear all data
    async clearAll(): Promise<void> {
        if (useMemoryFallback) {
            memoryStorage = {};
            return;
        }

        try {
            // Instead of just clearing the store, delete the entire database
            // This ensures a completely fresh start and avoids some corruption issues
            const req = indexedDB.deleteDatabase('podcatcher-db');

            await new Promise<void>((resolve, reject) => {
                req.onsuccess = () => {
                    console.log('[DB] Database deleted successfully');
                    resolve();
                };
                req.onerror = () => {
                    console.error('[DB] Failed to delete database');
                    reject(req.error);
                };
                req.onblocked = () => {
                    console.warn('[DB] Database deletion blocked');
                    // Proceed anyway, as we can't force close other tabs/connections easily here
                    // but usually a reload follows this action
                    resolve();
                };
            });

            // Re-initialize to ensure subsequent calls work (though app usually restarts)
            dbInitialized = false;
        } catch (error) {
            console.error('[DB] Failed to clear database:', error);
            // Fallback to clearing the store if delete fails
            try {
                const { clear } = await import('idb-keyval');
                await clear(customStore);
            } catch (e) {
                console.error('[DB] Fallback clear failed:', e);
            }
            memoryStorage = {};
        }
    }
};

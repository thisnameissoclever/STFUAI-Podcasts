/**
 * Secure Storage Service
 * 
 * Provides secure storage for sensitive data like API keys using
 * Electron's safeStorage API (OS-level encryption).
 * 
 * Falls back to IndexedDB if secure storage is not available.
 */

// Keys used in secure storage
export const SECURE_KEYS = {
    ASSEMBLYAI_API_KEY: 'assemblyai-api-key',
    OPENROUTER_API_KEY: 'openrouter-api-key',
} as const;

export type SecureKeyName = typeof SECURE_KEYS[keyof typeof SECURE_KEYS];

/**
 * Check if secure storage is available on this system
 */
export async function isSecureStorageAvailable(): Promise<boolean> {
    if (!window.electronAPI?.secureStorageAvailable) {
        return false;
    }
    try {
        return await window.electronAPI.secureStorageAvailable();
    } catch {
        return false;
    }
}

/**
 * Get a value from secure storage
 */
export async function getSecureValue(key: SecureKeyName): Promise<string | null> {
    if (!window.electronAPI?.secureStorageGet) {
        console.warn('[SecureStorage] API not available, returning null');
        return null;
    }
    try {
        return await window.electronAPI.secureStorageGet(key);
    } catch (error) {
        console.error('[SecureStorage] Failed to get value:', error);
        return null;
    }
}

/**
 * Set a value in secure storage
 */
export async function setSecureValue(key: SecureKeyName, value: string): Promise<boolean> {
    if (!window.electronAPI?.secureStorageSet) {
        console.warn('[SecureStorage] API not available, cannot save');
        return false;
    }
    try {
        await window.electronAPI.secureStorageSet(key, value);
        return true;
    } catch (error) {
        console.error('[SecureStorage] Failed to set value:', error);
        return false;
    }
}

/**
 * Delete a value from secure storage
 */
export async function deleteSecureValue(key: SecureKeyName): Promise<boolean> {
    if (!window.electronAPI?.secureStorageDelete) {
        console.warn('[SecureStorage] API not available, cannot delete');
        return false;
    }
    try {
        return await window.electronAPI.secureStorageDelete(key);
    } catch (error) {
        console.error('[SecureStorage] Failed to delete value:', error);
        return false;
    }
}

/**
 * Migrate an API key from IndexedDB to secure storage
 * Returns true if migration was successful or not needed
 */
export async function migrateApiKeyToSecureStorage(
    key: SecureKeyName,
    indexedDbValue: string | undefined
): Promise<boolean> {
    if (!indexedDbValue) {
        return true; // Nothing to migrate
    }

    const isAvailable = await isSecureStorageAvailable();
    if (!isAvailable) {
        console.warn('[SecureStorage] Not available, keeping key in IndexedDB');
        return false;
    }

    // Check if already migrated
    const existingSecure = await getSecureValue(key);
    if (existingSecure) {
        console.log(`[SecureStorage] Key ${key} already exists in secure storage`);
        return true;
    }

    // Migrate to secure storage
    const success = await setSecureValue(key, indexedDbValue);
    if (success) {
        console.log(`[SecureStorage] Migrated ${key} to secure storage`);
    }
    return success;
}

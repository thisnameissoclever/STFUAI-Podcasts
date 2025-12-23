/**
 * Device ID Service
 * 
 * Generates and persists a unique device ID (UUID v4) for identifying this
 * installation. Used for conflict resolution in cloud sync - the server
 * tracks which device made each update so we can handle "last write wins"
 * when syncing across multiple devices.
 */

import { get, set } from 'idb-keyval';

const DEVICE_ID_KEY = 'stfuai_device_id';

/**
 * Generates a UUID v4 using the Web Crypto API.
 * Falls back to a pseudo-random approach if crypto.randomUUID isn't available.
 */
function generateUUID(): string {
    // Modern browsers support this natively
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }

    // Fallback for older environments (shouldn't hit this in Electron 25+)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Gets the device ID, generating and persisting one if it doesn't exist.
 * This ID stays constant for the lifetime of the installation.
 */
export async function getDeviceId(): Promise<string> {
    try {
        // Check if we already have a device ID
        const existingId = await get<string>(DEVICE_ID_KEY);
        if (existingId) {
            return existingId;
        }

        // Generate a new one and persist it
        const newId = generateUUID();
        await set(DEVICE_ID_KEY, newId);
        console.log('[DeviceId] Generated new device ID:', newId);
        return newId;
    } catch (error) {
        console.error('[DeviceId] Failed to get/set device ID:', error);
        // If storage fails, generate a temporary one (will be regenerated on restart)
        // This is a fallback - shouldn't normally hit this
        return generateUUID();
    }
}

/**
 * Clears the device ID. Primarily used when clearing all app data.
 */
export async function clearDeviceId(): Promise<void> {
    try {
        await set(DEVICE_ID_KEY, undefined);
        console.log('[DeviceId] Cleared device ID');
    } catch (error) {
        console.error('[DeviceId] Failed to clear device ID:', error);
    }
}

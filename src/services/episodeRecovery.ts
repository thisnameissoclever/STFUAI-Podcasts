/**
 * Episode Recovery Service
 * 
 * Provides a modular, reusable function to recover episodes with missing files.
 * When an episode file is missing (e.g., deleted, corrupted, or moved), this service:
 * 1. Preserves the user's current playback position
 * 2. Clears stale transcription and ad segment data
 * 3. Triggers a fresh download
 * 4. Waits for download completion
 * 5. Restores the playback position
 * 
 * Transcription and basic ad detection happen automatically after download
 * via the existing downloadEpisode() pipeline.
 */

import { db } from './db';
import { storageService } from './storage';
import type { Episode } from '../types';

export interface RecoveryResult {
    success: boolean;
    error?: string;
    episode?: Episode;
}

// Track episodes currently being recovered to prevent concurrent attempts
const activeRecoveries = new Map<number, Promise<RecoveryResult>>();

/**
 * Attempts to recover an episode with a missing file by re-downloading it.
 * 
 * @param episodeId - The ID of the episode to recover
 * @param preservePosition - Optional playback position to preserve (in seconds)
 * @returns RecoveryResult indicating success/failure and the updated episode
 */
export async function recoverMissingEpisode(
    episodeId: number,
    preservePosition?: number
): Promise<RecoveryResult> {
    // Check if recovery is already in progress for this episode
    const existingRecovery = activeRecoveries.get(episodeId);
    if (existingRecovery) {
        console.log(`[EpisodeRecovery] Recovery already in progress for episode ${episodeId}. Waiting for existing recovery...`);
        return existingRecovery;
    }

    // Create and store the recovery promise
    const recoveryPromise = performRecovery(episodeId, preservePosition);
    activeRecoveries.set(episodeId, recoveryPromise);

    try {
        const result = await recoveryPromise;
        return result;
    } finally {
        // Clean up when done (success or failure)
        activeRecoveries.delete(episodeId);
    }
}

/**
 * Internal function that performs the actual recovery.
 */
async function performRecovery(
    episodeId: number,
    preservePosition?: number
): Promise<RecoveryResult> {
    console.log(`[EpisodeRecovery] Starting recovery for episode ${episodeId}`);

    try {
        // Import dynamically to avoid circular dependencies
        const { usePodcastStore } = await import('../store/usePodcastStore');
        const podcastStore = usePodcastStore.getState();

        // Get the current episode data
        const episode = podcastStore.episodes[episodeId];
        if (!episode) {
            console.error(`[EpisodeRecovery] Episode ${episodeId} not found in store`);
            return { success: false, error: 'Episode not found' };
        }

        console.log(`[EpisodeRecovery] Found episode: "${episode.title}"`);

        // Preserve the playback position (use provided position or existing one, prioritizing non-zero values)
        const positionToRestore = (preservePosition && preservePosition > 0)
            ? preservePosition
            : (episode.playbackPosition || 0);
        console.log(`[EpisodeRecovery] Preserving playback position: ${positionToRestore}s`);

        // Reset the episode state to clear stale data and allow fresh download/transcription
        const resetEpisode: Episode = {
            ...episode,
            isDownloaded: false,
            localFilePath: undefined,
            transcript: undefined,
            adSegments: undefined,
            transcriptionStatus: undefined,
            adDetectionType: undefined,
            playbackPosition: positionToRestore, // Preserve position
        };

        // Persist the reset state to the database
        await db.saveEpisode(resetEpisode);

        // Update the store with the reset episode
        usePodcastStore.setState(state => ({
            episodes: { ...state.episodes, [episodeId]: resetEpisode }
        }));

        console.log(`[EpisodeRecovery] Episode reset. Triggering download...`);

        // Trigger the download (this will also trigger transcription afterward)
        await podcastStore.downloadEpisode(resetEpisode);

        // Wait for download to complete (poll until no longer downloading)
        let attempts = 0;
        const maxAttempts = 120; // 60 seconds timeout (500ms * 120)

        while (usePodcastStore.getState().isDownloading(episodeId) && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 500));
            attempts++;
        }

        // Check the final result
        const finalStore = usePodcastStore.getState();
        const recoveredEpisode = finalStore.episodes[episodeId];

        if (recoveredEpisode?.isDownloaded && recoveredEpisode.localFilePath) {
            // Ensure playback position is still set correctly
            const finalEpisode = {
                ...recoveredEpisode,
                playbackPosition: positionToRestore
            };

            // Update store with correct position
            usePodcastStore.setState(state => ({
                episodes: { ...state.episodes, [episodeId]: finalEpisode }
            }));
            await db.saveEpisode(finalEpisode);

            console.log(`[EpisodeRecovery] Recovery successful for episode ${episodeId}`);
            return { success: true, episode: finalEpisode };
        } else {
            console.error(`[EpisodeRecovery] Download did not complete successfully for episode ${episodeId}`);
            return { success: false, error: 'Download failed or timed out' };
        }

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[EpisodeRecovery] Recovery failed for episode ${episodeId}:`, error);
        return { success: false, error: errorMessage };
    }
}

/**
 * Verifies that an episode's file exists on disk.
 * 
 * @param episode - The episode to verify
 * @returns true if the file exists, false otherwise
 */
export async function verifyEpisodeFileExists(episode: Episode): Promise<boolean> {
    if (!episode.isDownloaded || !episode.localFilePath) {
        return false;
    }

    const filename = `${episode.id}.mp3`;
    try {
        const exists = await storageService.checkFileExists(filename);
        if (!exists) {
            console.warn(`[EpisodeRecovery] File missing for episode ${episode.id}: ${filename}`);
        }
        return exists;
    } catch (error) {
        console.error(`[EpisodeRecovery] Error checking file existence for episode ${episode.id}:`, error);
        return false;
    }
}

/**
 * Verifies and recovers multiple episodes if their files are missing.
 * Typically called on app startup to ensure queued/playing episodes have valid files.
 * 
 * @param episodes - Array of episodes to verify
 * @returns Array of recovery results for any episodes that needed recovery
 */
export async function verifyAndRecoverEpisodes(episodes: Episode[]): Promise<RecoveryResult[]> {
    const results: RecoveryResult[] = [];

    for (const episode of episodes) {
        // Only check episodes that claim to be downloaded
        if (!episode.isDownloaded) {
            continue;
        }

        const fileExists = await verifyEpisodeFileExists(episode);

        if (!fileExists) {
            console.log(`[EpisodeRecovery] Episode "${episode.title}" has missing file. Attempting recovery...`);
            const result = await recoverMissingEpisode(episode.id, episode.playbackPosition);
            results.push(result);
        }
    }

    return results;
}

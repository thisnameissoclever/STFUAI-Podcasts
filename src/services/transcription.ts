// src/services/transcription.ts
// Transcription service - now routes to cloud backend

import type { Transcript } from '../types';
import { processEpisodeInCloud, CloudJobStatus } from './cloudApi';
import { db } from './db';

/**
 * Transcribe an episode using the cloud backend
 * 
 * @param filename - Local filename (e.g., "12345.mp3")
 * @param episodeId - Episode ID in local database
 * @param onProgress - Optional callback for progress updates
 */
export async function transcribeEpisode(
    filename: string,
    episodeId: number,
    onProgress?: (status: CloudJobStatus) => void
): Promise<Transcript> {
    // Get episode metadata for the cloud API
    const episodes = await db.getEpisodes();
    const episode = episodes[episodeId];

    if (!episode) {
        throw new Error(`Episode ${episodeId} not found in database`);
    }

    console.log(`[Transcription] Starting cloud processing for: ${episode.title}`);

    // Read the local file
    if (!window.electronAPI) {
        throw new Error('Electron API not available');
    }
    // Read the local file - use filename only, not full path
    // (readFile IPC handler prepends the podcast directory)
    const fileBuffer = await window.electronAPI.readFile(filename);

    // Process in cloud
    const results = await processEpisodeInCloud(
        fileBuffer,
        filename,
        {
            feedId: episode.feedId,
            guid: episode.guid,
            title: episode.title,
            description: episode.description,
            durationSeconds: episode.duration
        },
        onProgress
    );

    console.log(`[Transcription] Cloud processing complete. ${results.detectedSegments.length} segments detected.`);

    // Convert cloud response to local Transcript format
    const transcript: Transcript = {
        episodeId,
        text: results.transcript.text,
        segments: results.transcript.segments,
        language: results.transcript.language,
        duration: results.transcript.duration,
        createdAt: Date.now()
    };

    return transcript;
}

/**
 * Get the detected segments from the most recent cloud processing
 * (These are returned alongside the transcript from processEpisodeInCloud)
 */
export { processEpisodeInCloud, CloudJobStatus } from './cloudApi';

// =============================================================================
// ORIGINAL IMPLEMENTATION - COMMENTED OUT (MARKED FOR FUTURE DELETION)
// =============================================================================
/*
import type { Transcript } from '../types';
import { db } from './db';

// Main transcription service that routes to the appropriate provider
// based on user preferences
export async function transcribeEpisode(
    filename: string,
    episodeId: number
): Promise<Transcript> {
    // Get user's transcription provider preference
    const prefs = await db.getPreferences();
    const provider = prefs.transcriptionProvider || 'assemblyai';
    const compressionQuality = prefs.compressionQuality;

    console.log(`[Transcription] Using provider: ${provider}, compression: ${compressionQuality === 0 ? 'Original (none)' : `${compressionQuality}kbps`}`);

    // AssemblyAI is the only supported provider
    const { transcribeEpisode: transcribeWithAssemblyAI } = await import('./assemblyai');
    return transcribeWithAssemblyAI(filename, episodeId, prefs.assemblyAiApiKey, compressionQuality);
}
*/

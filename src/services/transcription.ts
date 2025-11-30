import type { Transcript } from '../types';
import { db } from './db';

/**
 * Main transcription service that routes to the appropriate provider
 * based on user preferences
 */
export async function transcribeEpisode(
    filename: string,
    episodeId: number
): Promise<Transcript> {
    // Get user's transcription provider preference
    const prefs = await db.getPreferences();

    // Force AssemblyAI as it is currently the only supported provider
    const provider = 'assemblyai';

    console.log(`[Transcription] Using provider: ${provider}`);

    const { transcribeEpisode: transcribeWithAssemblyAI } = await import('./assemblyai');
    return transcribeWithAssemblyAI(filename, episodeId, prefs.assemblyAiApiKey);
}

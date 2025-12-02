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
    const provider = prefs.transcriptionProvider || 'assemblyai';

    console.log(`[Transcription] Using provider: ${provider}`);

    //Keeping this even though this should never fire because we're removing Whisper-1 
    // transcription model support. 
    if (provider === 'whisper') {
        const { transcribeEpisode: transcribeWithWhisper } = await import('./whisper');
        // Whisper doesn't support speaker labels in our current implementation
        console.warn('[Transcription] Whisper provider selected. Speaker diarization (and thus basic ad detection) will be unavailable.');
        return transcribeWithWhisper(filename, episodeId, prefs.openAiApiKey);
    }

    // Default to AssemblyAI
    const { transcribeEpisode: transcribeWithAssemblyAI } = await import('./assemblyai');
    return transcribeWithAssemblyAI(filename, episodeId, prefs.assemblyAiApiKey);
}

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
    const compressionQuality = prefs.compressionQuality;

    console.log(`[Transcription] Using provider: ${provider}, compression: ${compressionQuality === 0 ? 'Original (none)' : `${compressionQuality}kbps`}`);

    if (provider === 'openai-whisper') {
        const { transcribeEpisode: transcribeWithWhisper } = await import('./whisper');
        // OpenAI Whisper doesn't support speaker labels
        console.warn('[Transcription] OpenAI Whisper selected. Speaker diarization (and thus basic ad detection) will be unavailable.');
        return transcribeWithWhisper(filename, episodeId, prefs.openAiApiKey, compressionQuality);
    }

    // Default to AssemblyAI
    const { transcribeEpisode: transcribeWithAssemblyAI } = await import('./assemblyai');
    return transcribeWithAssemblyAI(filename, episodeId, prefs.assemblyAiApiKey, compressionQuality);
}

import type { Transcript, TranscriptSegment, TranscriptWord } from '../types';


const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';

const API_ENDPOINT = 'https://api.openai.com/v1/audio/transcriptions';

/**
 * Transcribe an episode audio file using OpenAI Whisper API
 * Always compresses audio before upload
    * @param filename The downloaded filename(e.g., "12345.mp3")
        * @param episodeId The episode ID
            * @param apiKeyOverride Optional API key to use instead of env var
 */
export async function transcribeEpisode(
    filename: string,
    episodeId: number,
    apiKeyOverride?: string
): Promise<Transcript> {
    const apiKey = apiKeyOverride || OPENAI_API_KEY;

    if (!apiKey) {
        throw new Error('OpenAI API key is required for Whisper transcription. Please check your settings.');
    }

    try {
        if (!window.electronAPI) {
            throw new Error('Electron API not available');
        }

        // Step 1: Compress audio
        console.log(`[Whisper] Compressing audio file: ${filename}...`);
        const compressedFilename = await window.electronAPI.compressAudio(filename, 64);
        console.log(`[Whisper] Compression complete: ${compressedFilename}`);

        // Step 2: Read compressed file
        const fileBuffer = await window.electronAPI.readFile(compressedFilename);
        const blob = new Blob([fileBuffer], { type: 'audio/mpeg' });

        // Step 3: Create form data for API request
        const formData = new FormData();
        formData.append('file', blob, compressedFilename);
        formData.append('model', 'whisper-1');
        formData.append('response_format', 'verbose_json');
        formData.append('timestamp_granularities[]', 'word');

        console.log(`[Whisper] Sending request to OpenAI API...`);
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
            },
            body: formData,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('[Whisper] Transcription complete');

        // Step 4: Parse response into our format
        const words: TranscriptWord[] = [];
        const segments: TranscriptSegment[] = [];
        let fullText = '';

        if (data.words) {
            data.words.forEach((w: any) => {
                words.push({
                    word: w.word,
                    startTime: w.start,
                    endTime: w.end,
                });
            });
        }

        // Group words into segments (split by sentence or every ~5 words for better granularity)
        const wordsPerSegment = 1;
        for (let i = 0; i < words.length; i += wordsPerSegment) {
            const segmentWords = words.slice(i, i + wordsPerSegment);
            if (segmentWords.length > 0) {
                const text = segmentWords.map(w => w.word).join(' ');
                fullText += text + ' ';

                segments.push({
                    id: Math.floor(i / wordsPerSegment),
                    start: segmentWords[0].startTime,
                    end: segmentWords[segmentWords.length - 1].endTime,
                    text: text.trim(),
                    words: segmentWords,
                });
            }
        }

        const transcript: Transcript = {
            episodeId,
            text: fullText.trim(),
            segments,
            language: data.language || 'en',
            duration: words.length > 0 ? words[words.length - 1].endTime : 0,
            createdAt: Date.now(),
        };

        console.log('[Whisper] Transcript processed:', transcript);

        // Cleanup: Delete the compressed file
        try {
            await window.electronAPI.deleteFile(compressedFilename);
            console.log(`[Whisper] Deleted compressed file: ${compressedFilename}`);
        } catch (cleanupError) {
            console.warn(`[Whisper] Failed to delete compressed file: ${compressedFilename}`, cleanupError);
        }

        return transcript;
    } catch (error) {
        console.error('[Whisper] Transcription failed:', error);
        throw error;
    }
}

import type { Transcript, TranscriptSegment, TranscriptWord, CompressionQuality } from '../types';

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';
const API_ENDPOINT = 'https://api.openai.com/v1/audio/transcriptions';

/**
 * Transcribe an episode audio file using OpenAI Whisper API
 * @param filename The downloaded filename (e.g., "12345.mp3")
 * @param episodeId The episode ID
 * @param apiKeyOverride Optional API key to use instead of env var
 * @param compressionQuality Bitrate for compression (0 = no compression, use original)
 */
export async function transcribeEpisode(
    filename: string,
    episodeId: number,
    apiKeyOverride?: string,
    compressionQuality: CompressionQuality = 16
): Promise<Transcript> {
    const apiKey = apiKeyOverride || OPENAI_API_KEY;

    if (!apiKey) {
        throw new Error('OpenAI API key is required for Whisper transcription. Please check your settings.');
    }

    try {
        if (!window.electronAPI) {
            throw new Error('Electron API not available');
        }

        // Step 1: Prepare audio file (compress or use original based on user preference)
        let fileToUpload = filename;
        let didCompress = false;

        if (compressionQuality === 0) {
            // User selected "Original" - skip compression entirely
            console.log(`[Whisper] Using original file (no compression): ${filename}`);
        } else {
            // Compress to the specified bitrate
            console.log(`[Whisper] Compressing audio file: ${filename} to ${compressionQuality}kbps...`);
            fileToUpload = await window.electronAPI.compressAudio(filename, compressionQuality);
            didCompress = true;
            console.log(`[Whisper] Compression complete: ${fileToUpload}`);
        }

        // Step 2: Read file
        const fileBuffer = await window.electronAPI.readFile(fileToUpload);
        const blob = new Blob([fileBuffer], { type: 'audio/mpeg' });

        // Step 3: Create form data for API request
        const formData = new FormData();
        formData.append('file', blob, fileToUpload.split('/').pop() || 'audio.mp3');
        formData.append('model', 'whisper-1');
        formData.append('response_format', 'verbose_json');
        formData.append('timestamp_granularities[]', 'word');
        formData.append('timestamp_granularities[]', 'segment');

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

        // Step 4: Store raw verbose_json response
        const rawVerboseJson = JSON.stringify(data);

        // Step 5: Parse response into our format
        const words: TranscriptWord[] = [];
        const segments: TranscriptSegment[] = [];
        let fullText = data.text || '';

        // Parse word-level timestamps
        if (data.words && Array.isArray(data.words)) {
            data.words.forEach((w: any) => {
                words.push({
                    word: w.word,
                    startTime: w.start,
                    endTime: w.end,
                    // Note: No speaker field - OpenAI Whisper doesn't provide speaker diarization
                });
            });
        }

        // Parse segments from OpenAI's response
        if (data.segments && Array.isArray(data.segments)) {
            data.segments.forEach((seg: any) => {
                // Extract words for this segment if available
                const segmentWords: TranscriptWord[] = [];
                if (seg.words && Array.isArray(seg.words)) {
                    seg.words.forEach((w: any) => {
                        segmentWords.push({
                            word: w.word,
                            startTime: w.start,
                            endTime: w.end,
                        });
                    });
                }

                segments.push({
                    id: seg.id,
                    start: seg.start,
                    end: seg.end,
                    text: seg.text.trim(),
                    words: segmentWords,
                    // Note: No speaker field - OpenAI Whisper doesn't provide speaker diarization
                });
            });
        }

        const transcript: Transcript = {
            episodeId,
            text: fullText.trim(),
            segments,
            language: data.language || 'en',
            duration: data.duration || (words.length > 0 ? words[words.length - 1].endTime : 0),
            createdAt: Date.now(),
            rawVerboseJson, // Store the raw response for debugging/advanced use
        };

        console.log('[Whisper] Transcript processed:', {
            episodeId: transcript.episodeId,
            duration: transcript.duration,
            segmentCount: transcript.segments.length,
            wordCount: words.length,
            language: transcript.language,
        });

        // Cleanup: Only delete the compressed file if we created one
        if (didCompress) {
            try {
                await window.electronAPI.deleteFile(fileToUpload);
                console.log(`[Whisper] Deleted compressed file: ${fileToUpload}`);
            } catch (cleanupError) {
                console.warn(`[Whisper] Failed to delete compressed file: ${fileToUpload}`, cleanupError);
            }
        }

        return transcript;
    } catch (error) {
        console.error('[Whisper] Transcription failed:', error);
        throw error;
    }
}

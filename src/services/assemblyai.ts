import axios from 'axios';
import type { Transcript, TranscriptSegment, TranscriptWord } from '../types';

const DEFAULT_API_KEY = import.meta.env.VITE_ASSEMBLYAI_API_KEY || '';
const BASE_URL = 'https://api.assemblyai.com/v2';

/**
 * Transcribe an episode using AssemblyAI API
 */
export async function transcribeEpisode(
    filename: string,
    episodeId: number,
    apiKeyOverride?: string
): Promise<Transcript> {
    const apiKey = apiKeyOverride || DEFAULT_API_KEY;
    if (!apiKey) {
        throw new Error('AssemblyAI API key is missing. Please check your settings or .env file.');
    }

    const headers = {
        authorization: apiKey,
    };

    try {
        if (!window.electronAPI) {
            throw new Error('Electron API not available');
        }

        // Step 1: Read file
        console.log(`[AssemblyAI] Reading file: ${filename}`);
        // We don't compress for AssemblyAI as it handles large files well, 
        // but we could if bandwidth is a concern. For now, upload raw or maybe compress?
        // User said "supports things like advanced punctuation". 
        // Let's stick to the raw file or maybe the compressed one if we want to save upload time.
        // Whisper implementation compresses to 64kbps. 
        // Let's use the same compression logic to save bandwidth/time, as podcast files can be huge.
        // But wait, user said "You can use the already-compressed test file".
        // I'll use compression to be safe and efficient.

        console.log(`[AssemblyAI] Compressing audio file: ${filename}...`);
        const compressedFilename = await window.electronAPI.compressAudio(filename, 64); // Default to 64kbps
        console.log(`[AssemblyAI] Compression complete: ${compressedFilename}`);

        const fileBuffer = await window.electronAPI.readFile(compressedFilename);

        // Step 2: Upload file
        console.log('[AssemblyAI] Uploading file...');
        const uploadResponse = await axios.post(`${BASE_URL}/upload`, fileBuffer, {
            headers: { ...headers, 'content-type': 'application/octet-stream' }
        });
        const uploadUrl = uploadResponse.data.upload_url;
        console.log('[AssemblyAI] File uploaded:', uploadUrl);

        // Step 3: Submit transcription job
        console.log('[AssemblyAI] Submitting transcription job...');
        const transcriptResponse = await axios.post(`${BASE_URL}/transcript`, {
            audio_url: uploadUrl,
            punctuate: true,
            format_text: true,
            speaker_labels: true,
            speech_models: [
                "universal"
            ],
            speech_understanding: {
                "request": {
                    "speaker_identification": {
                        "speaker_type": "role",
                        "known_values": [
                            "Advertiser",
                            "Advertisement",
                            "Sponsor",
                            "Host",
                            "Co-host",
                            "Guest"
                        ]
                    }
                }
            }
        }, { headers });

        const transcriptId = transcriptResponse.data.id;
        console.log(`[AssemblyAI] Job submitted. ID: ${transcriptId}`);

        // Step 4: Poll for completion
        let status = transcriptResponse.data.status;
        let result = transcriptResponse.data;

        while (status === 'queued' || status === 'processing') {
            await new Promise(resolve => setTimeout(resolve, 3000)); // Poll every 3s
            const pollResponse = await axios.get(`${BASE_URL}/transcript/${transcriptId}`, { headers });
            result = pollResponse.data;
            status = result.status;
            console.debug(`[AssemblyAI] Status: ${status}`);
        }

        if (status === 'error') {
            throw new Error(`AssemblyAI Transcription failed: ${result.error}`);
        }

        console.log('[AssemblyAI] Transcription complete');

        // Step 5: Parse response
        // Step 5: Parse response
        const words: TranscriptWord[] = [];
        const segments: TranscriptSegment[] = [];
        let fullText = result.text || '';

        if (result.words) {
            result.words.forEach((w: any) => {
                words.push({
                    word: w.text,
                    startTime: w.start / 1000, // AssemblyAI returns ms
                    endTime: w.end / 1000,
                    speaker: w.speaker
                });
            });
        }

        // Refined Segmentation Logic
        let currentSegmentWords: TranscriptWord[] = [];
        let currentSegmentStart = 0;

        if (words.length > 0) {
            currentSegmentStart = words[0].startTime;
            let currentSpeaker = words[0].speaker;

            for (let i = 0; i < words.length; i++) {
                const word = words[i];
                const prevWord = i > 0 ? words[i - 1] : null;

                // Check for segment break conditions
                const speakerChanged = word.speaker !== currentSpeaker;
                const timeLimitExceeded = (word.endTime - currentSegmentStart) > 60;
                const significantPause = prevWord ? (word.startTime - prevWord.endTime) > 2.0 : false;

                if (currentSegmentWords.length > 0 && (speakerChanged || timeLimitExceeded || significantPause)) {
                    // Push current segment
                    const segmentText = currentSegmentWords.map(w => w.word).join(' ');
                    segments.push({
                        id: segments.length,
                        start: currentSegmentWords[0].startTime,
                        end: currentSegmentWords[currentSegmentWords.length - 1].endTime,
                        text: segmentText,
                        words: [...currentSegmentWords],
                        speaker: currentSpeaker
                    });

                    // Start new segment
                    currentSegmentWords = [];
                    currentSegmentStart = word.startTime;
                    currentSpeaker = word.speaker;
                }

                currentSegmentWords.push(word);
            }

            // Push final segment
            if (currentSegmentWords.length > 0) {
                const segmentText = currentSegmentWords.map(w => w.word).join(' ');
                segments.push({
                    id: segments.length,
                    start: currentSegmentWords[0].startTime,
                    end: currentSegmentWords[currentSegmentWords.length - 1].endTime,
                    text: segmentText,
                    words: [...currentSegmentWords],
                    speaker: currentSpeaker
                });
            }
        }

        const transcript: Transcript = {
            episodeId,
            text: fullText,
            segments,
            language: result.language_code || 'en',
            duration: result.audio_duration || 0,
            createdAt: Date.now(),
        };

        // Cleanup
        try {
            await window.electronAPI.deleteFile(compressedFilename);
        } catch (e) {
            console.warn('Failed to delete compressed file', e);
        }

        return transcript;

    } catch (error) {
        console.error('[AssemblyAI] Transcription failed:', error);
        throw error;
    }
}

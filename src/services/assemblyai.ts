// =============================================================================
// ENTIRE FILE COMMENTED OUT - MARKED FOR FUTURE DELETION
// Transcription is now handled by cloud backend via src/services/cloudApi.ts
// =============================================================================

import type { Transcript, CompressionQuality } from '../types';

// Stub function to maintain exports if anything still imports this file
export async function transcribeEpisode(
    _filename: string,
    _episodeId: number,
    _apiKeyOverride?: string,
    _compressionQuality: CompressionQuality = 16
): Promise<Transcript> {
    throw new Error('AssemblyAI transcription is deprecated. Use cloud backend instead (src/services/cloudApi.ts).');
}

/*
// ORIGINAL IMPLEMENTATION - COMMENTED OUT

import axios from 'axios';
import type { Transcript, TranscriptSegment, TranscriptWord, CompressionQuality } from '../types';
import { getSecureValue, SECURE_KEYS } from './secureStorage';

const BASE_URL = 'https://api.assemblyai.com/v2';

// Transcribe an episode using AssemblyAI API
// @param filename The downloaded filename (e.g., "12345.mp3")
// @param episodeId The episode ID
// @param apiKeyOverride Optional API key to use instead of secure storage
// @param compressionQuality Bitrate for compression (0 = no compression, use original)
export async function transcribeEpisode(
    filename: string,
    episodeId: number,
    apiKeyOverride?: string,
    compressionQuality: CompressionQuality = 16
): Promise<Transcript> {
    // Priority: 1) Override, 2) Secure storage, 3) Dev-only env fallback
    let apiKey = apiKeyOverride;
    if (!apiKey) {
        apiKey = await getSecureValue(SECURE_KEYS.ASSEMBLYAI_API_KEY) || '';
    }
    if (!apiKey) {
        apiKey = import.meta.env.VITE_ASSEMBLYAI_API_KEY || '';
    }
    if (!apiKey) {
        throw new Error('AssemblyAI API key is missing. Please add your API key in Settings.');
    }

    const headers = {
        authorization: apiKey,
    };

    try {
        if (!window.electronAPI) {
            throw new Error('Electron API not available');
        }

        // Step 1: Prepare audio file (compress or use original based on user preference)
        let fileToUpload = filename;
        let didCompress = false;

        if (compressionQuality === 0) {
            // User selected "Original" - skip compression entirely
            console.log(`[AssemblyAI] Using original file (no compression): ${filename}`);
        } else {
            // Compress to the specified bitrate
            console.log(`[AssemblyAI] Compressing audio file: ${filename} to ${compressionQuality}kbps...`);
            fileToUpload = await window.electronAPI.compressAudio(filename, compressionQuality);
            didCompress = true;
            console.log(`[AssemblyAI] Compression complete: ${fileToUpload}`);
        }

        const fileBuffer = await window.electronAPI.readFile(fileToUpload);

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
                            "Host",
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

        // Cleanup: Only delete the compressed file if we created one
        if (didCompress) {
            try {
                await window.electronAPI.deleteFile(fileToUpload);
                console.log(`[AssemblyAI] Deleted compressed file: ${fileToUpload}`);
            } catch (e) {
                console.warn('Failed to delete compressed file', e);
            }
        }

        return transcript;

    } catch (error) {
        console.error('[AssemblyAI] Transcription failed:', error);
        throw error;
    }
}
*/

import { describe, it, expect, vi, beforeAll } from 'vitest';

// =============================================================================
// TRANSCRIPTION SERVICE TESTS
// Updated for cloud-based transcription backend
// =============================================================================

// Mock window.electronAPI
const mockElectronAPI = {
    compressAudio: vi.fn(),
    readFile: vi.fn(),
    deleteFile: vi.fn(),
};

// Setup global window
global.window = {
    electronAPI: mockElectronAPI,
} as any;

// Mock the cloudApi module
vi.mock('../src/services/cloudApi', () => ({
    processEpisodeInCloud: vi.fn()
}));

// Mock the db module
vi.mock('../src/services/db', () => ({
    db: {
        getEpisodes: vi.fn(),
        getPreferences: vi.fn()
    }
}));

import { transcribeEpisode } from '../src/services/transcription';
import { processEpisodeInCloud } from '../src/services/cloudApi';
import { db } from '../src/services/db';

describe('Transcription Service - Cloud Backend', () => {
    const episodeId = 12345;

    beforeAll(() => {
        // Mock episode in database
        vi.mocked(db.getEpisodes).mockResolvedValue({
            [episodeId]: {
                id: episodeId,
                feedId: 1,
                guid: 'test-episode-guid',
                title: 'Test Episode',
                description: 'A test episode',
                duration: 3600,
                localFilePath: '/path/to/episode.mp3',
                isDownloaded: true
            }
        } as any);
    });

    describe('transcribeEpisode', () => {
        it('should call cloud API with episode metadata', async () => {
            const mockFileBuffer = new ArrayBuffer(100);
            mockElectronAPI.readFile.mockResolvedValue(mockFileBuffer);

            const mockCloudResults = {
                jobId: 'test-job',
                transcript: {
                    id: 1,
                    text: 'This is the transcript text',
                    segments: [{ id: 0, start: 0, end: 10, text: 'Hello', words: [] }],
                    language: 'en',
                    duration: 600,
                    wordCount: 100
                },
                detectedSegments: [
                    {
                        startTime: '0:00',
                        endTime: '0:30',
                        startTimeSeconds: 0,
                        endTimeSeconds: 30,
                        confidence: 95,
                        type: 'advertisement',
                        description: 'Sponsor read'
                    }
                ],
                detectionMethod: 'advanced' as const
            };

            vi.mocked(processEpisodeInCloud).mockResolvedValue(mockCloudResults);

            const result = await transcribeEpisode(`${episodeId}.mp3`, episodeId);

            expect(processEpisodeInCloud).toHaveBeenCalledWith(
                mockFileBuffer,
                `${episodeId}.mp3`,
                expect.objectContaining({
                    feedId: 1,
                    guid: 'test-episode-guid',
                    title: 'Test Episode'
                }),
                undefined // onProgress callback
            );

            expect(result.episodeId).toBe(episodeId);
            expect(result.text).toBe('This is the transcript text');
            expect(result.duration).toBe(600);
        });

        it('should throw error if episode not found in database', async () => {
            vi.mocked(db.getEpisodes).mockResolvedValue({});

            await expect(
                transcribeEpisode('99999.mp3', 99999)
            ).rejects.toThrow('Episode 99999 not found in database');
        });

        it('should throw error if Electron API not available', async () => {
            const originalElectronAPI = global.window.electronAPI;
            global.window.electronAPI = undefined as any;

            vi.mocked(db.getEpisodes).mockResolvedValue({
                [episodeId]: {
                    id: episodeId,
                    feedId: 1,
                    guid: 'test',
                    localFilePath: '/path/to/file.mp3'
                }
            } as any);

            await expect(
                transcribeEpisode(`${episodeId}.mp3`, episodeId)
            ).rejects.toThrow('Electron API not available');

            global.window.electronAPI = originalElectronAPI;
        });

        it('should pass progress callback to cloud API', async () => {
            const mockFileBuffer = new ArrayBuffer(100);
            mockElectronAPI.readFile.mockResolvedValue(mockFileBuffer);

            vi.mocked(db.getEpisodes).mockResolvedValue({
                [episodeId]: {
                    id: episodeId,
                    feedId: 1,
                    guid: 'test',
                    localFilePath: '/path/to/file.mp3'
                }
            } as any);

            vi.mocked(processEpisodeInCloud).mockResolvedValue({
                jobId: 'test',
                transcript: { text: 'test', segments: [], language: 'en', duration: 100 },
                detectedSegments: [],
                detectionMethod: 'basic'
            } as any);

            const progressCallback = vi.fn();
            await transcribeEpisode(`${episodeId}.mp3`, episodeId, progressCallback);

            expect(processEpisodeInCloud).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                expect.anything(),
                progressCallback
            );
        });
    });
});

// =============================================================================
// LEGACY TESTS - COMMENTED OUT
// These tests were for the old direct AssemblyAI integration
// =============================================================================

/*
import path from 'path';
import fs from 'fs';
import { transcribeEpisode } from '../src/services/whisper';

describe('Transcription Services - LEGACY', () => {
    const testFile = path.resolve(__dirname, 'assets/test_episode_2_compressed.mp3');
    const episodeId = 12345;

    beforeAll(() => {
        // Verify test file exists
        if (!fs.existsSync(testFile)) {
            throw new Error(`Test file not found: ${testFile}`);
        }
    });

    describe.skip('Whisper', () => {
        it('should transcribe the test file successfully', async () => {
            // ... old whisper test
        }, 60000);
    });

    describe('AssemblyAI', () => {
        it('should transcribe the test file successfully', async () => {
            // Check for API key
            // @ts-ignore
            const apiKey = import.meta.env.VITE_ASSEMBLYAI_API_KEY;
            if (!apiKey) {
                console.warn('Skipping AssemblyAI test: VITE_ASSEMBLYAI_API_KEY not found');
                return;
            }

            // Mock compressAudio to return the test file path directly
            mockElectronAPI.compressAudio.mockResolvedValue(testFile);

            // Mock readFile to return the file buffer
            mockElectronAPI.readFile.mockImplementation(async (filename) => {
                return fs.readFileSync(filename);
            });

            // Mock deleteFile to do nothing
            mockElectronAPI.deleteFile.mockResolvedValue(undefined);

            const { transcribeEpisode: transcribeAssemblyAI } = await import('../src/services/assemblyai');

            console.log('Starting AssemblyAI transcription test...');
            const transcript = await transcribeAssemblyAI(testFile, episodeId);

            console.log('AssemblyAI Transcript Result:', transcript.text.substring(0, 100) + '...');

            expect(transcript).toBeDefined();
            expect(transcript.episodeId).toBe(episodeId);
            expect(transcript.text).toBeTruthy();
            expect(transcript.segments.length).toBeGreaterThan(0);

            // Verify word-level timestamps
            if (transcript.segments[0].words && transcript.segments[0].words.length > 0) {
                const firstWord = transcript.segments[0].words[0];
                expect(firstWord.startTime).toBeDefined();
                expect(firstWord.endTime).toBeDefined();
            }
        }, 120000);
    });
});
*/

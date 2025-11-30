import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs';
import { transcribeEpisode } from '../src/services/whisper';

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

describe('Transcription Services', () => {
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
            // Mock compressAudio to return the test file path directly (since it's already compressed)
            mockElectronAPI.compressAudio.mockResolvedValue(testFile);

            // Mock readFile to return the file buffer
            mockElectronAPI.readFile.mockImplementation(async (filename) => {
                return fs.readFileSync(filename);
            });

            // Mock deleteFile to do nothing
            mockElectronAPI.deleteFile.mockResolvedValue(undefined);

            console.log('Starting Whisper transcription test...');
            const transcript = await transcribeEpisode(testFile, episodeId);

            console.log('Whisper Transcript Result:', transcript.text.substring(0, 100) + '...');

            expect(transcript).toBeDefined();
            expect(transcript.episodeId).toBe(episodeId);
            expect(transcript.text).toBeTruthy();
            expect(transcript.segments.length).toBeGreaterThan(0);
            expect(transcript.segments[0].words).toBeDefined();

            // Verify word-level timestamps
            const firstWord = transcript.segments[0].words[0];
            expect(firstWord.startTime).toBeDefined();
            expect(firstWord.endTime).toBeDefined();
        }, 60000); // Increase timeout for API call
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
        }, 120000); // Long timeout for upload + processing
    });
});

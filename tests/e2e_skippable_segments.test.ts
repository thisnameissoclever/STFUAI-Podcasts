import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePodcastStore } from '../src/store/usePodcastStore';
import { db } from '../src/services/db';
import type { Episode } from '../src/types';

// =============================================================================
// E2E SKIPPABLE SEGMENT FLOW TESTS
// Updated for cloud-based transcription and ad detection
// =============================================================================

// Mock dependencies
vi.mock('../src/services/db', () => ({
    db: {
        saveTranscript: vi.fn(),
        saveEpisode: vi.fn(),
        getPodcasts: vi.fn().mockResolvedValue({}),
        getEpisodes: vi.fn().mockResolvedValue({}),
        getPreferences: vi.fn().mockResolvedValue({})
    }
}));

// Mock the cloud API - now the primary transcription service
vi.mock('../src/services/cloudApi', () => ({
    processEpisodeInCloud: vi.fn().mockImplementation(async (_buffer, _filename, metadata, _onProgress) => {
        return {
            jobId: 'mock-job-id',
            episodeId: metadata.feedId,
            transcript: {
                id: 1,
                text: 'This is the mock transcript from cloud',
                segments: [
                    { id: 1, start: 0, end: 10, text: 'Intro', words: [], speaker: 'Host' },
                    { id: 2, start: 10, end: 25, text: 'Ad break', words: [], speaker: 'Advertiser' },
                    { id: 3, start: 25, end: 60, text: 'Main content', words: [], speaker: 'Host' },
                ],
                language: 'en',
                duration: 60,
                wordCount: 50
            },
            detectedSegments: [
                {
                    startTime: "0:10",
                    endTime: "0:25",
                    startTimeSeconds: 10,
                    endTimeSeconds: 25,
                    confidence: 95,
                    type: "advertisement",
                    description: "Cloud detected sponsor read"
                }
            ],
            detectionMethod: 'advanced'
        };
    })
}));

// Mock window.electronAPI
const mockElectronAPI = {
    readFile: vi.fn().mockResolvedValue(new ArrayBuffer(100))
};
global.window = { electronAPI: mockElectronAPI } as unknown as Window & typeof globalThis;

describe('E2E Skippable Segment Flow', () => {
    beforeEach(() => {
        usePodcastStore.setState({
            episodes: {
                1: {
                    id: 1,
                    feedId: 1,
                    guid: 'test-guid',
                    title: 'Test Episode',
                    isDownloaded: true,
                    localFilePath: '/path/to/file.mp3',
                    duration: 60
                } as Episode
            }
        });
        vi.clearAllMocks();
    });

    it('should transcribe and detect segments via cloud backend in one call', async () => {
        const store = usePodcastStore.getState();

        // Trigger transcription - this now calls cloud API
        await store.transcribeEpisode(1);

        // Verify transcript AND segments were saved from cloud response
        const episode = usePodcastStore.getState().episodes[1];

        expect(episode.transcript).toBeDefined();
        expect(episode.transcript!.text).toBe('This is the mock transcript from cloud');
        expect(episode.transcript!.duration).toBe(60);

        // Ad segments should come from cloud, not local detection
        expect(episode.adSegments).toBeDefined();
        expect(episode.adSegments).toHaveLength(1);
        expect(episode.adSegments![0].type).toBe('advertisement');
        expect(episode.adSegments![0].startTimeSeconds).toBe(10);
        expect(episode.adSegments![0].endTimeSeconds).toBe(25);
        expect(episode.adSegments![0].description).toBe('Cloud detected sponsor read');

        // Detection method should be from cloud
        expect(episode.adDetectionType).toBe('advanced');

        // Verify DB saves were called
        expect(db.saveTranscript).toHaveBeenCalled();
        expect(db.saveEpisode).toHaveBeenCalledWith(expect.objectContaining({
            id: 1,
            adSegments: expect.arrayContaining([
                expect.objectContaining({ type: 'advertisement' })
            ]),
            adDetectionType: 'advanced'
        }));
    });

    it('should update transcription status during cloud processing', async () => {
        const store = usePodcastStore.getState();

        // Initially no status
        expect(usePodcastStore.getState().episodes[1].transcriptionStatus).toBeUndefined();

        // Start transcription
        const transcriptionPromise = store.transcribeEpisode(1);

        // Status should be 'processing' while in progress
        expect(usePodcastStore.getState().episodes[1].transcriptionStatus).toBe('processing');

        // Wait for completion
        await transcriptionPromise;

        // Status should be 'completed' after finishing
        expect(usePodcastStore.getState().episodes[1].transcriptionStatus).toBe('completed');
    });

    it('detectAds function should be a no-op since cloud handles detection', async () => {
        // Setup: Episode with existing segments from cloud
        usePodcastStore.setState({
            episodes: {
                1: {
                    id: 1,
                    title: 'Test Episode',
                    isDownloaded: true,
                    localFilePath: '/path/to/file.mp3',
                    duration: 60,
                    transcript: {
                        episodeId: 1,
                        text: 'Mock transcript',
                        segments: [],
                        language: 'en',
                        duration: 60,
                        createdAt: Date.now()
                    },
                    adSegments: [
                        {
                            startTime: "0:10",
                            endTime: "0:25",
                            startTimeSeconds: 10,
                            endTimeSeconds: 25,
                            confidence: 95,
                            type: "advertisement",
                            description: "Cloud detected ad"
                        }
                    ],
                    adDetectionType: 'advanced'
                } as Episode
            }
        });

        const store = usePodcastStore.getState();

        // Call detectAds - should be a no-op now
        await store.detectAds(1);

        // Segments should remain unchanged (not replaced)
        const episode = usePodcastStore.getState().episodes[1];
        expect(episode.adSegments).toHaveLength(1);
        expect(episode.adSegments![0].description).toBe('Cloud detected ad');
    });
});

// =============================================================================
// LEGACY E2E TESTS - COMMENTED OUT
// These tests were for the old local basic+advanced detection flow
// =============================================================================

/*
describe('E2E Skippable Segment Flow - LEGACY', () => {
    it('should automatically detect basic segments after transcription', async () => {
        // Old test: verified local basic segment detection
        // This is now handled by cloud backend
    });

    it('should replace basic segments with advanced segments when requested', async () => {
        // Old test: verified local advanced detection replaced basic
        // This is now handled by cloud backend in one step
    });
});
*/

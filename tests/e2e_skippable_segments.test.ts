import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePodcastStore } from '../src/store/usePodcastStore';
import { db } from '../src/services/db';
import type { Transcript, Episode } from '../src/types';

// Mock dependencies
vi.mock('../src/services/db', () => ({
    db: {
        saveTranscript: vi.fn(),
        saveEpisode: vi.fn(),
        getPodcasts: vi.fn().mockResolvedValue({}),
        getEpisodes: vi.fn().mockResolvedValue({}),
    }
}));

// Mock transcription service
vi.mock('../src/services/transcription', () => ({
    transcribeEpisode: vi.fn().mockImplementation(async (filename, id) => {
        return {
            episodeId: id,
            text: 'Mock transcript',
            segments: [
                { id: 1, start: 0, end: 10, text: 'Intro', words: [], speaker: 'Host' },
                { id: 2, start: 10, end: 20, text: 'Ad', words: [], speaker: 'Advertiser' }, // Basic ad
                { id: 3, start: 20, end: 30, text: 'Content', words: [], speaker: 'Host' },
            ],
            language: 'en',
            duration: 30,
            createdAt: Date.now()
        } as Transcript;
    })
}));

// Mock skippableSegments service
vi.mock('../src/services/skippableSegments', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual as any,
        detectAdvancedSegments: vi.fn().mockResolvedValue([
            {
                startTime: "0:05",
                endTime: "0:25", // Different from basic
                startTimeSeconds: 5,
                endTimeSeconds: 25,
                confidence: 95,
                type: "advertisement",
                description: "Advanced Ad"
            }
        ])
    };
});

describe('E2E Skippable Segment Flow', () => {
    beforeEach(() => {
        usePodcastStore.setState({
            episodes: {
                1: {
                    id: 1,
                    title: 'Test Episode',
                    isDownloaded: true,
                    localFilePath: '/path/to/file.mp3',
                    duration: 30
                } as Episode
            }
        });
        vi.clearAllMocks();
    });

    it('should automatically detect basic segments after transcription', async () => {
        const store = usePodcastStore.getState();

        // 1. Trigger transcription
        await store.transcribeEpisode(1);

        // 2. Verify basic ads were detected and saved
        const episode = usePodcastStore.getState().episodes[1];
        expect(episode.transcript).toBeDefined();
        expect(episode.adSegments).toBeDefined();
        expect(episode.adSegments).toHaveLength(1);
        expect(episode.adSegments![0].type).toBe('advertisement');
        expect(episode.adSegments![0].startTimeSeconds).toBe(10);
        expect(episode.adSegments![0].endTimeSeconds).toBe(20);
        expect(episode.adSegments![0].description).toBe('Detected via transcript diarization analysis. Click "Analyze" to perform advanced skippable segment detection.');

        // Verify DB save was called with updated episode
        expect(db.saveEpisode).toHaveBeenCalledWith(expect.objectContaining({
            id: 1,
            adSegments: expect.arrayContaining([
                expect.objectContaining({ type: 'advertisement' })
            ])
        }));
    });

    it('should replace basic segments with advanced segments when requested', async () => {
        const store = usePodcastStore.getState();

        // Setup: Episode already has basic ads
        usePodcastStore.setState({
            episodes: {
                1: {
                    id: 1,
                    title: 'Test Episode',
                    isDownloaded: true,
                    localFilePath: '/path/to/file.mp3',
                    duration: 30,
                    transcript: {
                        episodeId: 1,
                        text: 'Mock transcript',
                        segments: [],
                        language: 'en',
                        duration: 30,
                        createdAt: Date.now()
                    },
                    adSegments: [
                        {
                            startTime: "0:10",
                            endTime: "0:20",
                            startTimeSeconds: 10,
                            endTimeSeconds: 20,
                            confidence: 100,
                            type: "advertisement",
                            description: "Basic Ad"
                        }
                    ]
                } as Episode
            }
        });

        // 1. Trigger advanced detection
        await store.detectAds(1);

        // 2. Verify segments were REPLACED
        const episode = usePodcastStore.getState().episodes[1];
        expect(episode.adSegments).toHaveLength(1);
        expect(episode.adSegments![0].description).toBe('Advanced Ad');
        expect(episode.adSegments![0].startTimeSeconds).toBe(5); // From mock
    });
});

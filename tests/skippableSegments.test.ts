import { describe, it, expect, vi } from 'vitest';
import { detectBasicSegments, detectAdvancedSegments } from '../src/services/skippableSegments';
import type { Transcript, Episode } from '../src/types';

// Mock fetch for OpenAI
global.fetch = vi.fn();

describe('Skippable Segment Detection', () => {
    describe('detectBasicSegments (Speaker Labels)', () => {
        it('should return empty array if no segments', () => {
            const transcript: Transcript = {
                episodeId: 1,
                text: '',
                segments: [],
                language: 'en',
                duration: 0,
                createdAt: 0
            };
            const result = detectBasicSegments(transcript);
            expect(result).toEqual([]);
        });

        it('should detect single advertiser segment', () => {
            const transcript: Transcript = {
                episodeId: 1,
                text: 'Buy our stuff',
                segments: [
                    { id: 1, start: 0, end: 10, text: 'Intro', words: [], speaker: 'Host' },
                    { id: 2, start: 10, end: 20, text: 'Buy stuff', words: [], speaker: 'Advertiser' },
                    { id: 3, start: 20, end: 30, text: 'Content', words: [], speaker: 'Host' },
                ],
                language: 'en',
                duration: 30,
                createdAt: 0
            };

            const result = detectBasicSegments(transcript);
            expect(result).toHaveLength(1);
            expect(result[0].startTimeSeconds).toBe(10);
            expect(result[0].endTimeSeconds).toBe(20);
            expect(result[0].type).toBe('advertisement');
            expect(result[0].confidence).toBe(100);
        });

        it('should merge adjacent advertiser segments', () => {
            const transcript: Transcript = {
                episodeId: 1,
                text: 'Buy our stuff',
                segments: [
                    { id: 1, start: 0, end: 10, text: 'Intro', words: [], speaker: 'Host' },
                    { id: 2, start: 10, end: 20, text: 'Buy stuff', words: [], speaker: 'Advertiser' },
                    { id: 3, start: 20, end: 30, text: 'More ads', words: [], speaker: 'Advertiser' },
                    { id: 4, start: 30, end: 40, text: 'Content', words: [], speaker: 'Host' },
                ],
                language: 'en',
                duration: 40,
                createdAt: 0
            };

            const result = detectBasicSegments(transcript);
            expect(result).toHaveLength(1);
            expect(result[0].startTimeSeconds).toBe(10);
            expect(result[0].endTimeSeconds).toBe(30);
        });

        it('should handle multiple separate ad blocks', () => {
            const transcript: Transcript = {
                episodeId: 1,
                text: 'Buy our stuff',
                segments: [
                    { id: 1, start: 0, end: 10, text: 'Intro', words: [], speaker: 'Host' },
                    { id: 2, start: 10, end: 20, text: 'Ad 1', words: [], speaker: 'Advertiser' },
                    { id: 3, start: 20, end: 30, text: 'Content', words: [], speaker: 'Host' },
                    { id: 4, start: 30, end: 40, text: 'Ad 2', words: [], speaker: 'Advertiser' },
                ],
                language: 'en',
                duration: 40,
                createdAt: 0
            };

            const result = detectBasicSegments(transcript);
            expect(result).toHaveLength(2);
            expect(result[0].startTimeSeconds).toBe(10);
            expect(result[0].endTimeSeconds).toBe(20);
            expect(result[1].startTimeSeconds).toBe(30);
            expect(result[1].endTimeSeconds).toBe(40);
        });

        it('should handle case-insensitive speaker labels', () => {
            const transcript: Transcript = {
                episodeId: 1,
                text: 'Buy our stuff',
                segments: [
                    { id: 1, start: 0, end: 10, text: 'Ad', words: [], speaker: 'advertiser' },
                ],
                language: 'en',
                duration: 10,
                createdAt: 0
            };

            const result = detectBasicSegments(transcript);
            expect(result).toHaveLength(1);
        });
    });

    describe('detectAdvancedSegments (OpenAI)', () => {
        it('should call OpenAI API and parse result', async () => {
            const mockResponse = {
                choices: [{
                    message: {
                        content: JSON.stringify([
                            {
                                startTime: "0:10",
                                endTime: "0:20",
                                confidence: 90,
                                type: "advertisement",
                                description: "Test Ad"
                            }
                        ])
                    }
                }]
            };

            (fetch as any).mockResolvedValue({
                ok: true,
                json: async () => mockResponse
            });

            const episode: Episode = {
                id: 1,
                title: 'Test Episode',
                duration: 60,
                transcript: {
                    episodeId: 1,
                    text: 'Full text',
                    segments: [],
                    language: 'en',
                    duration: 60,
                    createdAt: 0
                }
            } as any;

            const result = await detectAdvancedSegments(episode);
            expect(result).toHaveLength(1);
            expect(result[0].startTimeSeconds).toBe(10);
            expect(result[0].endTimeSeconds).toBe(20);
            expect(result[0].type).toBe('advertisement');
        });

        it('should filter out invalid segments where end time is before start time', async () => {
            const mockResponse = {
                choices: [{
                    message: {
                        content: JSON.stringify([
                            {
                                startTime: "0:10",
                                endTime: "0:20",
                                confidence: 90,
                                type: "advertisement",
                                description: "Valid Ad"
                            },
                            {
                                startTime: "0:30",
                                endTime: "0:25", // Invalid: End before Start
                                confidence: 90,
                                type: "advertisement",
                                description: "Invalid Ad"
                            }
                        ])
                    }
                }]
            };

            (fetch as any).mockResolvedValue({
                ok: true,
                json: async () => mockResponse
            });

            const episode: Episode = {
                id: 1,
                title: 'Test Episode',
                duration: 60,
                transcript: {
                    episodeId: 1,
                    text: 'Full text',
                    segments: [],
                    language: 'en',
                    duration: 60,
                    createdAt: 0
                }
            } as any;

            const result = await detectAdvancedSegments(episode);
            expect(result).toHaveLength(1);
            expect(result[0].description).toBe("Valid Ad");
        });
    });
});

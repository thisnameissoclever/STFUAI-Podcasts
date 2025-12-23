import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// CLOUD API TESTS
// Tests for the new cloud-based transcription and ad detection service
// =============================================================================

// Mock the supabaseClient module
vi.mock('../src/services/supabaseClient', () => ({
    getAccessToken: vi.fn()
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

import { CLOUD_CONFIG } from '../src/config/cloud';
import {
    uploadEpisodeToCloud,
    getCloudJobStatus,
    getCloudJobResults,
    waitForCloudJobCompletion
} from '../src/services/cloudApi';
import { getAccessToken } from '../src/services/supabaseClient';

describe('Cloud API Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default: user is authenticated
        vi.mocked(getAccessToken).mockResolvedValue('mock-access-token');
    });

    describe('CLOUD_CONFIG', () => {
        it('should have valid Supabase URL', () => {
            expect(CLOUD_CONFIG.SUPABASE_URL).toMatch(/^https:\/\/.+\.supabase\.co$/);
        });

        it('should have required endpoint paths', () => {
            expect(CLOUD_CONFIG.ENDPOINTS.UPLOAD_EPISODE).toBeDefined();
            expect(CLOUD_CONFIG.ENDPOINTS.GET_JOB_STATUS).toBeDefined();
            expect(CLOUD_CONFIG.ENDPOINTS.GET_JOB_RESULTS).toBeDefined();
        });

        it('should have reasonable polling configuration', () => {
            expect(CLOUD_CONFIG.POLLING_INTERVAL_MS).toBeGreaterThan(0);
            expect(CLOUD_CONFIG.MAX_POLL_ATTEMPTS).toBeGreaterThan(0);
        });
    });

    describe('uploadEpisodeToCloud', () => {
        it('should throw when not authenticated', async () => {
            vi.mocked(getAccessToken).mockResolvedValue(null);

            const fileBuffer = new ArrayBuffer(100);
            const metadata = { feedId: 1, guid: 'test-guid' };

            await expect(
                uploadEpisodeToCloud(fileBuffer, 'test.mp3', metadata)
            ).rejects.toThrow('Not authenticated');
        });

        it('should upload file and return job ID on success', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ jobId: 'test-job-id' })
            });

            const fileBuffer = new ArrayBuffer(100);
            const metadata = { feedId: 1, guid: 'test-guid', title: 'Test Episode' };

            const jobId = await uploadEpisodeToCloud(fileBuffer, 'test.mp3', metadata);

            expect(jobId).toBe('test-job-id');
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining(CLOUD_CONFIG.ENDPOINTS.UPLOAD_EPISODE),
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Authorization': 'Bearer mock-access-token'
                    })
                })
            );
        });

        it('should throw on upload failure', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                json: () => Promise.resolve({ error: 'Server error' })
            });

            const fileBuffer = new ArrayBuffer(100);
            const metadata = { feedId: 1, guid: 'test-guid' };

            await expect(
                uploadEpisodeToCloud(fileBuffer, 'test.mp3', metadata)
            ).rejects.toThrow('Server error');
        });
    });

    describe('getCloudJobStatus', () => {
        it('should return job status', async () => {
            const mockStatus = {
                jobId: 'test-job',
                status: 'transcribing',
                progress: 50,
                createdAt: '2025-12-22T00:00:00Z',
                updatedAt: '2025-12-22T00:01:00Z'
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockStatus)
            });

            const status = await getCloudJobStatus('test-job');

            expect(status.status).toBe('transcribing');
            expect(status.progress).toBe(50);
        });
    });

    describe('getCloudJobResults', () => {
        it('should return transcript and detected segments', async () => {
            const mockResults = {
                jobId: 'test-job',
                episodeId: 12345,
                transcript: {
                    id: 1,
                    text: 'Test transcript text',
                    segments: [],
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
                        description: 'Pre-roll ad'
                    }
                ],
                detectionMethod: 'advanced'
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockResults)
            });

            const results = await getCloudJobResults('test-job');

            expect(results.transcript.text).toBe('Test transcript text');
            expect(results.detectedSegments).toHaveLength(1);
            expect(results.detectedSegments[0].type).toBe('advertisement');
            expect(results.detectionMethod).toBe('advanced');
        });
    });

    describe('waitForCloudJobCompletion', () => {
        it('should poll until job completes and return results', async () => {
            // First poll: still processing
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    jobId: 'test-job',
                    status: 'transcribing',
                    progress: 50
                })
            });

            // Second poll: completed
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    jobId: 'test-job',
                    status: 'completed',
                    progress: 100
                })
            });

            // Results fetch
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    jobId: 'test-job',
                    transcript: { text: 'Done' },
                    detectedSegments: [],
                    detectionMethod: 'basic'
                })
            });

            const progressUpdates: any[] = [];
            const results = await waitForCloudJobCompletion('test-job', (status) => {
                progressUpdates.push(status);
            });

            expect(progressUpdates).toHaveLength(2);
            expect(progressUpdates[0].status).toBe('transcribing');
            expect(progressUpdates[1].status).toBe('completed');
            expect(results.transcript.text).toBe('Done');
        }, 10000);

        it('should throw on job failure', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    jobId: 'test-job',
                    status: 'failed',
                    error: 'Transcription failed'
                })
            });

            await expect(
                waitForCloudJobCompletion('test-job')
            ).rejects.toThrow('Transcription failed');
        });
    });
});

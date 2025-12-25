/**
 * Cloud Sync Service Tests
 * 
 * Unit tests for the cloud sync functionality.
 * These tests mock fetch and auth to verify the sync service behavior.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the dependencies before importing the module under test
vi.mock('../src/services/supabaseClient', () => ({
    getSession: vi.fn(),
}));

vi.mock('../src/services/deviceId', () => ({
    getDeviceId: vi.fn().mockResolvedValue('test-device-id-12345'),
}));

vi.mock('../src/config/cloud', () => ({
    CLOUD_CONFIG: {
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_ANON_KEY: 'test-anon-key',
    },
}));

// Import after mocks are set up
import { getSession } from '../src/services/supabaseClient';
import {
    fetchSubscriptions,
    pushSubscription,
    deleteSubscription,
    fetchEpisodeStates,
    upsertEpisodeState,
    fetchQueue,
    upsertQueue,
    fetchPlayerState,
    upsertPlayerState,
    isCloudSyncAvailable,
} from '../src/services/cloudSync';

const mockGetSession = vi.mocked(getSession);

describe('cloudSync service', () => {
    let mockFetch: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup authenticated session by default
        mockGetSession.mockResolvedValue({
            access_token: 'test-access-token',
            refresh_token: 'test-refresh-token',
            user: { id: 'user-123', email: 'test@example.com' },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);

        // Setup global fetch mock
        mockFetch = vi.fn();
        global.fetch = mockFetch as typeof fetch;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('isCloudSyncAvailable', () => {
        it('returns true when user is authenticated', async () => {
            const result = await isCloudSyncAvailable();
            expect(result).toBe(true);
        });

        it('returns false when user is not authenticated', async () => {
            mockGetSession.mockResolvedValue(null);
            const result = await isCloudSyncAvailable();
            expect(result).toBe(false);
        });
    });

    describe('fetchSubscriptions', () => {
        it('fetches subscriptions successfully', async () => {
            const mockSubs = [
                { id: 1, user_id: 'user-123', feed_url: 'https://example.com/rss', title: 'Test Podcast', image_url: '', created_at: '2025-01-01T00:00:00Z', test_data: false },
            ];

            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Headers({ 'content-length': '100' }),
                json: () => Promise.resolve(mockSubs),
            });

            const result = await fetchSubscriptions();

            expect(result).toEqual(mockSubs);
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/rest/v1/subscriptions'),
                expect.objectContaining({
                    method: 'GET',
                    headers: expect.objectContaining({
                        'Authorization': 'Bearer test-access-token',
                        'apikey': 'test-anon-key',
                    }),
                })
            );
        });

        it('throws error when not authenticated', async () => {
            mockGetSession.mockResolvedValue(null);

            await expect(fetchSubscriptions()).rejects.toThrow('Not authenticated');
        });
    });

    describe('pushSubscription', () => {
        it('creates subscription successfully', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                status: 201,
                headers: new Headers({ 'content-length': '0' }),
                json: () => Promise.resolve([]),
            });

            await pushSubscription({
                feed_url: 'https://example.com/rss',
                title: 'Test Podcast',
                image_url: 'https://example.com/image.jpg',
            });

            expect(mockFetch).toHaveBeenCalledWith(
                'https://test.supabase.co/rest/v1/subscriptions',
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({
                        feed_url: 'https://example.com/rss',
                        title: 'Test Podcast',
                        image_url: 'https://example.com/image.jpg',
                        user_id: 'user-123',
                    }),
                })
            );
        });
    });

    describe('deleteSubscription', () => {
        it('deletes subscription by feed URL', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                status: 204,
                headers: new Headers(),
            });

            await deleteSubscription('https://example.com/rss');

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('feed_url=eq.https%3A%2F%2Fexample.com%2Frss'),
                expect.objectContaining({
                    method: 'DELETE',
                })
            );
        });
    });

    describe('fetchEpisodeStates', () => {
        it('fetches episode states successfully', async () => {
            const mockStates = [
                {
                    id: 1,
                    user_id: 'user-123',
                    feed_url: 'https://example.com/rss',
                    episode_guid: 'episode-guid-1',
                    is_played: false,
                    position_seconds: 120,
                    last_played_at: '2025-01-01T00:00:00Z',
                    device_id: 'device-1',
                    updated_at: '2025-01-01T00:00:00Z',
                },
            ];

            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Headers({ 'content-length': '100' }),
                json: () => Promise.resolve(mockStates),
            });

            const result = await fetchEpisodeStates();

            expect(result).toEqual(mockStates);
        });
    });

    describe('upsertEpisodeState', () => {
        it('upserts episode state with correct headers', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                status: 201,
                headers: new Headers({ 'content-length': '0' }),
            });

            await upsertEpisodeState({
                feed_url: 'https://example.com/rss',
                episode_guid: 'episode-guid-1',
                is_played: false,
                position_seconds: 300,
                last_played_at: '2025-01-01T00:00:00Z',
                device_id: 'test-device-id',
            });

            expect(mockFetch).toHaveBeenCalledWith(
                'https://test.supabase.co/rest/v1/user_episode_state',
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Prefer': 'resolution=merge-duplicates,return=minimal',
                    }),
                })
            );
        });
    });

    describe('fetchQueue', () => {
        it('returns queue when it exists', async () => {
            const mockQueue = {
                user_id: 'user-123',
                items: [
                    { feedUrl: 'https://example.com/rss', episodeGuid: 'ep-1' },
                    { feedUrl: 'https://example.com/rss', episodeGuid: 'ep-2' },
                ],
                device_id: 'device-1',
                updated_at: '2025-01-01T00:00:00Z',
            };

            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Headers({ 'content-length': '100' }),
                json: () => Promise.resolve([mockQueue]),
            });

            const result = await fetchQueue();

            expect(result).toEqual(mockQueue);
        });

        it('returns null when queue does not exist', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Headers({ 'content-length': '2' }),
                json: () => Promise.resolve([]),
            });

            const result = await fetchQueue();

            expect(result).toBeNull();
        });
    });

    describe('upsertQueue', () => {
        it('upserts queue items with device ID and user ID', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                status: 201,
                headers: new Headers({ 'content-length': '0' }),
            });

            const items = [
                { feedUrl: 'https://example.com/rss', episodeGuid: 'ep-1' },
                { feedUrl: 'https://example.com/rss', episodeGuid: 'ep-2' },
            ];

            await upsertQueue(items);

            expect(mockFetch).toHaveBeenCalledWith(
                'https://test.supabase.co/rest/v1/user_queue',
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({
                        items,
                        device_id: 'test-device-id-12345',
                        user_id: 'user-123',
                    }),
                })
            );
        });
    });

    describe('fetchPlayerState', () => {
        it('returns player state when it exists', async () => {
            const mockState = {
                user_id: 'user-123',
                feed_url: 'https://example.com/rss',
                episode_guid: 'ep-1',
                playback_state: 'playing' as const,
                position_seconds: 500,
                device_id: 'device-1',
                updated_at: '2025-01-01T00:00:00Z',
            };

            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Headers({ 'content-length': '100' }),
                json: () => Promise.resolve([mockState]),
            });

            const result = await fetchPlayerState();

            expect(result).toEqual(mockState);
        });

        it('returns null when no player state exists', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Headers({ 'content-length': '2' }),
                json: () => Promise.resolve([]),
            });

            const result = await fetchPlayerState();

            expect(result).toBeNull();
        });
    });

    describe('upsertPlayerState', () => {
        it('upserts player state with correct payload and user ID', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                status: 201,
                headers: new Headers({ 'content-length': '0' }),
            });

            await upsertPlayerState({
                feed_url: 'https://example.com/rss',
                episode_guid: 'ep-1',
                playback_state: 'paused',
                position_seconds: 600,
                device_id: 'test-device-id',
            });

            expect(mockFetch).toHaveBeenCalledWith(
                'https://test.supabase.co/rest/v1/user_player_state',
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Prefer': 'resolution=merge-duplicates,return=minimal',
                    }),
                    body: JSON.stringify({
                        feed_url: 'https://example.com/rss',
                        episode_guid: 'ep-1',
                        playback_state: 'paused',
                        position_seconds: 600,
                        device_id: 'test-device-id',
                        user_id: 'user-123',
                    }),
                })
            );
        });
    });

    describe('error handling', () => {
        it('throws error on API failure', async () => {
            mockFetch.mockResolvedValue({
                ok: false,
                status: 500,
                text: () => Promise.resolve('Internal Server Error'),
            });

            await expect(fetchSubscriptions()).rejects.toThrow('Cloud sync failed: 500');
        });

        it('throws error on 401 unauthorized', async () => {
            mockFetch.mockResolvedValue({
                ok: false,
                status: 401,
                text: () => Promise.resolve('Unauthorized'),
            });

            await expect(fetchSubscriptions()).rejects.toThrow('Cloud sync failed: 401');
        });
    });
});

/**
 * Cloud Sync Service
 * 
 * Supabase REST API wrapper for syncing user library data:
 * - Subscriptions (podcasts the user follows)
 * - Episode state (played/resume position)
 * - Queue (up next list)
 * - Player state (currently playing episode)
 * 
 * Uses "Last Write Wins" strategy with device_id for conflict resolution.
 */

import { getSession } from './supabaseClient';
import { getDeviceId } from './deviceId';
import { CLOUD_CONFIG } from '../config/cloud';
import type {
    CloudSubscription,
    SubscriptionPayload,
    CloudEpisodeState,
    EpisodeStatePayload,
    CloudUserQueue,
    QueuePayload,
    CloudPlayerState,
    PlayerStatePayload,
    QueueItem,
} from '../types/cloudSync';

// =========================================================================
// Helpers
// =========================================================================

/**
 * Gets the auth headers for Supabase REST API calls.
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
    const session = await getSession();
    if (!session?.access_token) {
        throw new Error('Not authenticated - please sign in');
    }

    return {
        'Content-Type': 'application/json',
        'apikey': CLOUD_CONFIG.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${session.access_token}`,
    };
}

/**
 * Gets the current user's ID from the session.
 * Required for RLS policy compliance on insert/upsert operations.
 */
async function getUserId(): Promise<string> {
    const session = await getSession();
    if (!session?.user?.id) {
        throw new Error('Not authenticated - please sign in');
    }
    return session.user.id;
}

/**
 * Makes a REST API call to Supabase.
 * We use fetch directly instead of the Supabase client for more control
 * over headers (especially the Prefer header for upserts).
 */
async function supabaseRest<T>(
    endpoint: string,
    options: {
        method?: 'GET' | 'POST' | 'DELETE' | 'PATCH';
        body?: unknown;
        prefer?: string;  // For upsert behavior
        params?: Record<string, string>;
    } = {}
): Promise<T> {
    const { method = 'GET', body, prefer, params } = options;

    let url = `${CLOUD_CONFIG.SUPABASE_URL}/rest/v1/${endpoint}`;
    if (params) {
        const searchParams = new URLSearchParams(params);
        url += `?${searchParams.toString()}`;
    }

    const headers = await getAuthHeaders();
    if (prefer) {
        headers['Prefer'] = prefer;
    }

    const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('[CloudSync] API error:', response.status, errorText);
        throw new Error(`Cloud sync failed: ${response.status} - ${errorText}`);
    }

    // DELETE often returns empty response
    if (response.status === 204 || response.headers.get('content-length') === '0') {
        return [] as unknown as T;
    }

    return response.json();
}

// =========================================================================
// Subscriptions
// =========================================================================

/**
 * Fetches all subscriptions for the current user.
 */
export async function fetchSubscriptions(): Promise<CloudSubscription[]> {
    console.log('[CloudSync] Fetching subscriptions...');
    const subs = await supabaseRest<CloudSubscription[]>('subscriptions', {
        params: { select: '*' },
    });
    console.log(`[CloudSync] Fetched ${subs.length} subscriptions`);
    return subs;
}

/**
 * Pushes a new subscription to the cloud.
 */
export async function pushSubscription(payload: SubscriptionPayload): Promise<void> {
    console.log('[CloudSync] Pushing subscription:', payload.title);
    const userId = await getUserId();
    await supabaseRest('subscriptions', {
        method: 'POST',
        body: { ...payload, user_id: userId },
        prefer: 'return=minimal',
    });
}

/**
 * Deletes a subscription by feed URL.
 */
export async function deleteSubscription(feedUrl: string): Promise<void> {
    console.log('[CloudSync] Deleting subscription:', feedUrl);
    await supabaseRest('subscriptions', {
        method: 'DELETE',
        params: { feed_url: `eq.${feedUrl}` },
    });
}

// =========================================================================
// Episode State
// =========================================================================

/**
 * Fetches all episode states for the current user.
 */
export async function fetchEpisodeStates(): Promise<CloudEpisodeState[]> {
    console.log('[CloudSync] Fetching episode states...');
    const states = await supabaseRest<CloudEpisodeState[]>('user_episode_state', {
        params: { select: '*' },
    });
    console.log(`[CloudSync] Fetched ${states.length} episode states`);
    return states;
}

/**
 * Upserts an episode state (creates or updates based on composite key).
 * Uses Last Write Wins strategy.
 */
export async function upsertEpisodeState(payload: EpisodeStatePayload): Promise<void> {
    console.log('[CloudSync] Upserting episode state:', payload.episode_guid);
    const userId = await getUserId();
    await supabaseRest('user_episode_state', {
        method: 'POST',
        body: { ...payload, user_id: userId },
        // This tells Supabase to update if the row already exists
        prefer: 'resolution=merge-duplicates,return=minimal',
    });
}

/**
 * Convenience function to push current playback position.
 */
export async function pushPlaybackPosition(
    feedUrl: string,
    episodeGuid: string,
    positionSeconds: number,
    isPlayed: boolean
): Promise<void> {
    const deviceId = await getDeviceId();
    await upsertEpisodeState({
        feed_url: feedUrl,
        episode_guid: episodeGuid,
        is_played: isPlayed,
        position_seconds: positionSeconds,
        last_played_at: new Date().toISOString(),
        device_id: deviceId,
    });
}

// =========================================================================
// Queue
// =========================================================================

/**
 * Fetches the user's queue.
 */
export async function fetchQueue(): Promise<CloudUserQueue | null> {
    console.log('[CloudSync] Fetching queue...');
    const queues = await supabaseRest<CloudUserQueue[]>('user_queue', {
        params: { select: '*', limit: '1' },
    });
    if (queues.length === 0) {
        console.log('[CloudSync] No queue found');
        return null;
    }
    console.log(`[CloudSync] Fetched queue with ${queues[0].items.length} items`);
    return queues[0];
}

/**
 * Upserts the user's queue.
 */
export async function upsertQueue(items: QueueItem[]): Promise<void> {
    const deviceId = await getDeviceId();
    const userId = await getUserId();
    console.log(`[CloudSync] Upserting queue with ${items.length} items`);

    const payload: QueuePayload = {
        items,
        device_id: deviceId,
    };

    await supabaseRest('user_queue', {
        method: 'POST',
        body: { ...payload, user_id: userId },
        prefer: 'resolution=merge-duplicates,return=minimal',
    });
}

// =========================================================================
// Player State
// =========================================================================

/**
 * Fetches the current player state (what's playing on other devices).
 */
export async function fetchPlayerState(): Promise<CloudPlayerState | null> {
    console.log('[CloudSync] Fetching player state...');
    const states = await supabaseRest<CloudPlayerState[]>('user_player_state', {
        params: { select: '*', limit: '1' },
    });
    if (states.length === 0) {
        console.log('[CloudSync] No player state found');
        return null;
    }
    console.log('[CloudSync] Fetched player state:', states[0].playback_state);
    return states[0];
}

/**
 * Upserts the current player state.
 * Call this when playback starts, pauses, stops, or position changes significantly.
 */
export async function upsertPlayerState(payload: PlayerStatePayload): Promise<void> {
    console.log('[CloudSync] Upserting player state:', payload.playback_state);
    const userId = await getUserId();
    await supabaseRest('user_player_state', {
        method: 'POST',
        body: { ...payload, user_id: userId },
        prefer: 'resolution=merge-duplicates,return=minimal',
    });
}

// Debounce timer for player state updates
let playerStateDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const PLAYER_STATE_DEBOUNCE_MS = 5000;  // 5 seconds

/**
 * Debounced player state update - prevents spamming the API during playback.
 * Updates are batched and sent every 5 seconds at most.
 */
export function debouncedPlayerStateUpdate(payload: PlayerStatePayload): void {
    if (playerStateDebounceTimer) {
        clearTimeout(playerStateDebounceTimer);
    }

    playerStateDebounceTimer = setTimeout(async () => {
        try {
            await upsertPlayerState(payload);
        } catch (error) {
            console.error('[CloudSync] Debounced player state update failed:', error);
        }
        playerStateDebounceTimer = null;
    }, PLAYER_STATE_DEBOUNCE_MS);
}

/**
 * Immediately flushes any pending debounced player state update.
 * Call this when the user pauses or stops playback.
 */
export async function flushPlayerStateUpdate(payload: PlayerStatePayload): Promise<void> {
    if (playerStateDebounceTimer) {
        clearTimeout(playerStateDebounceTimer);
        playerStateDebounceTimer = null;
    }
    await upsertPlayerState(payload);
}

// =========================================================================
// Initial Sync (called on app load after auth)
// =========================================================================

/**
 * Checks if the user is authenticated and cloud sync is available.
 */
export async function isCloudSyncAvailable(): Promise<boolean> {
    const session = await getSession();
    return !!session?.user;
}

/**
 * Performs initial sync on app load.
 * - Fetches cloud subscriptions and adds any missing ones to local store
 * - Pushes any local-only subscriptions to cloud
 * 
 * This uses a simple merge strategy:
 * - Cloud subscriptions not in local → add to local
 * - Local subscriptions not in cloud → push to cloud
 */
export async function performInitialSync(): Promise<void> {
    const available = await isCloudSyncAvailable();
    if (!available) {
        console.log('[CloudSync] User not authenticated, skipping initial sync');
        return;
    }

    console.log('[CloudSync] Starting initial sync...');

    try {
        // Sync subscriptions
        await syncSubscriptions();

        // Note: We don't sync queue/episode state on initial load to avoid 
        // overwriting local state that may be more recent. The ongoing sync
        // (via store hooks) handles keeping things in sync during normal use.

        console.log('[CloudSync] Initial sync complete');
    } catch (error) {
        console.error('[CloudSync] Initial sync failed:', error);
        // Don't throw - we don't want sync failures to block app startup
    }
}

/**
 * Syncs subscriptions between local and cloud.
 */
async function syncSubscriptions(): Promise<void> {
    // Dynamic import to avoid circular dependency
    const { usePodcastStore } = await import('../store/usePodcastStore');
    const { db } = await import('./db');
    const { parseFeed } = await import('./api');

    const localSubs = usePodcastStore.getState().subscriptions;
    const cloudSubs = await fetchSubscriptions();

    // Build lookup maps
    const localByFeedUrl = new Map<string, number>();
    for (const [id, podcast] of Object.entries(localSubs)) {
        localByFeedUrl.set(podcast.url, Number(id));
    }

    const cloudByFeedUrl = new Set(cloudSubs.map(s => s.feed_url));

    // Cloud → Local: Add cloud subscriptions that are missing locally
    for (const cloudSub of cloudSubs) {
        if (!localByFeedUrl.has(cloudSub.feed_url)) {
            console.log(`[CloudSync] Adding cloud subscription locally: ${cloudSub.title}`);
            try {
                // We need to fetch the full podcast data from the feed
                const podcast = await parseFeed(cloudSub.feed_url);
                if (podcast) {
                    await db.savePodcast({
                        ...podcast,
                        autoAddToQueue: true,
                        subscribedAt: Date.now(),
                    });
                    usePodcastStore.setState((state) => ({
                        subscriptions: {
                            ...state.subscriptions,
                            [podcast.id]: { ...podcast, autoAddToQueue: true, subscribedAt: Date.now() }
                        }
                    }));
                }
            } catch (err) {
                console.error(`[CloudSync] Failed to add subscription ${cloudSub.feed_url}:`, err);
            }
        }
    }

    // Local → Cloud: Push local subscriptions that are missing in cloud
    for (const [_, podcast] of Object.entries(localSubs)) {
        if (!cloudByFeedUrl.has(podcast.url)) {
            console.log(`[CloudSync] Pushing local subscription to cloud: ${podcast.title}`);
            try {
                await pushSubscription({
                    feed_url: podcast.url,
                    title: podcast.title,
                    image_url: podcast.image || '',
                });
            } catch (err) {
                console.error(`[CloudSync] Failed to push subscription ${podcast.url}:`, err);
            }
        }
    }
}

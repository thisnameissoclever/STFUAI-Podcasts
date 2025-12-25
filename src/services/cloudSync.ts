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
import type { Podcast, Episode } from '../types';
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
 * - Restores queue, player state, and episode states from cloud
 * 
 * This uses a simple merge strategy:
 * - Cloud subscriptions not in local → add to local
 * - Local subscriptions not in cloud → push to cloud
 * - Cloud queue/player state → restore if local is empty (cloud wins on fresh install)
 * - Cloud episode states → merge with local (cloud wins for played status)
 */
export async function performInitialSync(): Promise<void> {
    const available = await isCloudSyncAvailable();
    if (!available) {
        console.log('[CloudSync] User not authenticated, skipping initial sync');
        return;
    }

    console.log('[CloudSync] Starting initial sync...');

    try {
        // Sync subscriptions first (needed for episode lookups)
        await syncSubscriptions();

        // Restore queue from cloud
        await syncQueue();

        // Restore player state from cloud
        await syncPlayerState();

        // Restore episode states (played/position) from cloud
        await syncEpisodeStates();

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
    const { api } = await import('./api');

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
                // Fetch the full podcast data from Podcast Index API
                const response = await api.getPodcastByFeedUrl(cloudSub.feed_url);
                if (response?.feed) {
                    const feed = response.feed;
                    // Map API response to Podcast interface - must include all required fields
                    const podcast: Podcast = {
                        id: feed.id,
                        title: feed.title,
                        url: feed.url,
                        originalUrl: feed.originalUrl || feed.url,
                        link: feed.link || '',
                        description: feed.description || '',
                        author: feed.author || '',
                        ownerName: feed.ownerName || feed.author || '',
                        image: feed.image || feed.artwork || '',
                        artwork: feed.artwork || feed.image || '',
                        lastUpdateTime: feed.lastUpdateTime || Date.now(),
                        contentType: feed.contentType || 'application/rss+xml',
                        itunesId: feed.itunesId || null,
                        generator: feed.generator || '',
                        language: feed.language || 'en',
                        episodeCount: feed.episodeCount || 0,
                        autoAddToQueue: true,
                        subscribedAt: Date.now(),
                    };

                    await db.savePodcast(podcast);
                    usePodcastStore.setState((state) => ({
                        subscriptions: {
                            ...state.subscriptions,
                            [podcast.id]: podcast
                        }
                    }));
                    console.log(`[CloudSync] Successfully added: ${podcast.title}`);
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

/**
 * Fetches an episode from the Podcast Index API and saves it to local DB.
 * Used when restoring queue/player state from cloud on a new device.
 */
async function fetchAndSaveEpisode(feedUrl: string, episodeGuid: string): Promise<Episode | null> {
    const { api } = await import('./api');
    const { db } = await import('./db');
    const { usePodcastStore } = await import('../store/usePodcastStore');

    try {
        // Try to fetch episode by GUID first (most accurate)
        const response = await api.getEpisodeByGuid(episodeGuid, feedUrl);

        if (response?.episode) {
            const item = response.episode;
            const episode: Episode = {
                id: item.id,
                title: item.title,
                link: item.link,
                description: item.description,
                guid: item.guid,
                datePublished: item.datePublished,
                datePublishedPretty: item.datePublishedPretty,
                dateCrawled: item.dateCrawled,
                enclosureUrl: item.enclosureUrl,
                enclosureType: item.enclosureType,
                enclosureLength: item.enclosureLength,
                duration: item.duration,
                explicit: item.explicit,
                episode: item.episode,
                season: item.season,
                image: item.image,
                feedImage: item.feedImage,
                feedId: item.feedId,
                feedTitle: item.feedTitle,
                feedLanguage: item.feedLanguage,
                feedUrl: feedUrl,
                isPlayed: false,
                playbackPosition: 0,
                isDownloaded: false,
                inQueue: false
            };

            // Save to local DB
            await db.saveEpisode(episode);
            usePodcastStore.setState((state) => ({
                episodes: { ...state.episodes, [episode.id]: episode }
            }));

            console.log(`[CloudSync] Fetched and saved episode: ${episode.title}`);
            return episode;
        }
    } catch (err) {
        console.warn(`[CloudSync] Could not fetch episode by GUID ${episodeGuid}:`, err);
    }

    // Fallback: Try to find in recent episodes by feed URL
    try {
        const episodesResponse = await api.getEpisodesByFeedUrl(feedUrl, 50);
        if (episodesResponse?.items) {
            const item = episodesResponse.items.find(
                (ep: { guid?: string; id?: number }) => ep.guid === episodeGuid || String(ep.id) === episodeGuid
            );

            if (item) {
                const episode: Episode = {
                    id: item.id,
                    title: item.title,
                    link: item.link,
                    description: item.description,
                    guid: item.guid,
                    datePublished: item.datePublished,
                    datePublishedPretty: item.datePublishedPretty,
                    dateCrawled: item.dateCrawled,
                    enclosureUrl: item.enclosureUrl,
                    enclosureType: item.enclosureType,
                    enclosureLength: item.enclosureLength,
                    duration: item.duration,
                    explicit: item.explicit,
                    episode: item.episode,
                    season: item.season,
                    image: item.image,
                    feedImage: item.feedImage,
                    feedId: item.feedId,
                    feedTitle: item.feedTitle,
                    feedLanguage: item.feedLanguage,
                    feedUrl: feedUrl,
                    isPlayed: false,
                    playbackPosition: 0,
                    isDownloaded: false,
                    inQueue: false
                };

                await db.saveEpisode(episode);
                usePodcastStore.setState((state) => ({
                    episodes: { ...state.episodes, [episode.id]: episode }
                }));

                console.log(`[CloudSync] Fetched and saved episode from feed: ${episode.title}`);
                return episode;
            }
        }
    } catch (err) {
        console.warn(`[CloudSync] Could not fetch episodes from feed ${feedUrl}:`, err);
    }

    return null;
}

/**
 * Syncs queue from cloud to local.
 * Only restores if local queue is empty (to avoid overwriting user's current session).
 */
async function syncQueue(): Promise<void> {
    const { usePlayerStore } = await import('../store/usePlayerStore');
    const { db } = await import('./db');

    const localQueue = usePlayerStore.getState().queue;

    // Only restore if local queue is empty
    if (localQueue.length > 0) {
        console.log('[CloudSync] Local queue has items, skipping cloud queue restore');
        return;
    }

    const cloudQueue = await fetchQueue();
    if (!cloudQueue || cloudQueue.items.length === 0) {
        console.log('[CloudSync] No cloud queue to restore');
        return;
    }

    console.log(`[CloudSync] Restoring queue with ${cloudQueue.items.length} items from cloud`);

    // Get all local episodes to match queue items
    const allEpisodes = await db.getEpisodes();
    const episodeList = Object.values(allEpisodes);

    // Convert cloud queue items to Episode objects
    const restoredQueue: Episode[] = [];
    for (const item of cloudQueue.items) {
        // First, try to find episode locally
        let episode = episodeList.find(ep =>
            ep.feedUrl === item.feedUrl && (ep.guid === item.episodeGuid || String(ep.id) === item.episodeGuid)
        );

        // If not found locally, try to fetch from API
        if (!episode && item.feedUrl) {
            console.log(`[CloudSync] Episode not found locally, fetching from API: ${item.episodeGuid}`);
            episode = await fetchAndSaveEpisode(item.feedUrl, item.episodeGuid) || undefined;
        }

        if (episode) {
            restoredQueue.push(episode);
            console.log(`[CloudSync] Restored queue item: ${episode.title}`);
        } else {
            console.warn(`[CloudSync] Could not find or fetch episode: ${item.feedUrl} / ${item.episodeGuid}`);
        }
    }

    if (restoredQueue.length > 0) {
        usePlayerStore.setState({ queue: restoredQueue });
        console.log(`[CloudSync] Queue restored with ${restoredQueue.length} episodes`);
    }
}

/**
 * Syncs player state from cloud to local.
 * Only restores if no episode is currently loaded (to avoid interrupting playback).
 */
async function syncPlayerState(): Promise<void> {
    const { usePlayerStore } = await import('../store/usePlayerStore');
    const { db } = await import('./db');

    const localCurrentEpisode = usePlayerStore.getState().currentEpisode;

    // Only restore if nothing is currently playing/loaded
    if (localCurrentEpisode) {
        console.log('[CloudSync] Local player has episode, skipping cloud player state restore');
        return;
    }

    const cloudPlayerState = await fetchPlayerState();
    if (!cloudPlayerState) {
        console.log('[CloudSync] No cloud player state to restore');
        return;
    }

    console.log(`[CloudSync] Restoring player state from cloud: ${cloudPlayerState.playback_state}`);

    // Get all local episodes to find the one being played
    const allEpisodes = await db.getEpisodes();
    const episodeList = Object.values(allEpisodes);

    // First, try to find episode locally
    let episode = episodeList.find(ep =>
        ep.feedUrl === cloudPlayerState.feed_url &&
        (ep.guid === cloudPlayerState.episode_guid || String(ep.id) === cloudPlayerState.episode_guid)
    );

    // If not found locally, try to fetch from API
    if (!episode && cloudPlayerState.feed_url) {
        console.log(`[CloudSync] Player episode not found locally, fetching from API: ${cloudPlayerState.episode_guid}`);
        episode = await fetchAndSaveEpisode(cloudPlayerState.feed_url, cloudPlayerState.episode_guid) || undefined;
    }

    if (episode) {
        // Update episode with cloud position
        const restoredEpisode = {
            ...episode,
            playbackPosition: cloudPlayerState.position_seconds
        };

        usePlayerStore.setState({
            currentEpisode: restoredEpisode,
            currentTime: cloudPlayerState.position_seconds,
            // Don't auto-play - just load it. User can resume when ready.
            isPlaying: false,
        });

        console.log(`[CloudSync] Player state restored: ${episode.title} at ${cloudPlayerState.position_seconds}s`);
    } else {
        console.warn('[CloudSync] Could not find or fetch episode for player state:', cloudPlayerState.feed_url);
    }
}

/**
 * Syncs episode states (played/position) from cloud to local.
 * Cloud wins for played status and position (to support cross-device sync).
 */
async function syncEpisodeStates(): Promise<void> {
    const { usePodcastStore } = await import('../store/usePodcastStore');
    const { db } = await import('./db');

    const cloudStates = await fetchEpisodeStates();
    if (cloudStates.length === 0) {
        console.log('[CloudSync] No cloud episode states to restore');
        return;
    }

    console.log(`[CloudSync] Syncing ${cloudStates.length} episode states from cloud`);

    // Get all local episodes
    const allEpisodes = await db.getEpisodes();
    const episodeList = Object.values(allEpisodes);
    let updatedCount = 0;

    for (const cloudState of cloudStates) {
        // Find matching local episode
        const episode = episodeList.find(ep =>
            ep.feedUrl === cloudState.feed_url &&
            (ep.guid === cloudState.episode_guid || String(ep.id) === cloudState.episode_guid)
        );

        if (episode) {
            // Check if cloud state is "newer" or has more progress
            const cloudIsPlayed = cloudState.is_played;
            const cloudPosition = cloudState.position_seconds;
            const localPosition = episode.playbackPosition || 0;

            // Cloud wins if: episode is marked played, or cloud has more progress
            if (cloudIsPlayed || cloudPosition > localPosition) {
                const updatedEpisode = {
                    ...episode,
                    isPlayed: cloudIsPlayed,
                    playbackPosition: cloudPosition,
                };

                await db.saveEpisode(updatedEpisode);
                usePodcastStore.setState((state) => ({
                    episodes: { ...state.episodes, [episode.id]: updatedEpisode }
                }));

                updatedCount++;
            }
        }
    }

    console.log(`[CloudSync] Updated ${updatedCount} episodes from cloud states`);
}


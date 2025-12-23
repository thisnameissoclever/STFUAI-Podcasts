/**
 * Cloud Sync Types
 * 
 * TypeScript interfaces matching the Supabase database schema for
 * syncing user library data. Based on backend_integration_guide.md
 */

// =========================================================================
// Subscriptions - which podcasts the user follows
// =========================================================================

/**
 * Cloud subscription record - what's stored in Supabase.
 * Maps to `public.subscriptions` table.
 */
export interface CloudSubscription {
    id: number;
    user_id: string;
    feed_url: string;
    title: string;
    image_url: string;
    created_at: string;  // ISO 8601
    test_data: boolean;
}

/**
 * Payload for creating a new subscription.
 */
export interface SubscriptionPayload {
    feed_url: string;
    title: string;
    image_url: string;
    test_data?: boolean;  // For automated tests only
}

// =========================================================================
// Episode State - played status and resume position
// =========================================================================

/**
 * Cloud episode state record - what's stored in Supabase.
 * Maps to `public.user_episode_state` table.
 */
export interface CloudEpisodeState {
    id: number;
    user_id: string;
    feed_url: string;
    episode_guid: string;
    is_played: boolean;
    position_seconds: number;
    last_played_at: string;  // ISO 8601
    device_id: string;
    updated_at: string;      // ISO 8601
}

/**
 * Payload for upserting episode state.
 * The composite key is (user_id, feed_url, episode_guid).
 */
export interface EpisodeStatePayload {
    feed_url: string;
    episode_guid: string;
    is_played: boolean;
    position_seconds: number;
    last_played_at: string;
    device_id: string;
}

// =========================================================================
// Queue - ordered list of episodes to play
// =========================================================================

/**
 * A single queue item - identifies an episode by its feed and guid.
 */
export interface QueueItem {
    feedUrl: string;
    episodeGuid: string;
}

/**
 * Cloud queue record - what's stored in Supabase.
 * Maps to `public.user_queue` table.
 */
export interface CloudUserQueue {
    user_id: string;
    items: QueueItem[];
    device_id: string;
    updated_at: string;
}

/**
 * Payload for upserting queue.
 */
export interface QueuePayload {
    items: QueueItem[];
    device_id: string;
}

// =========================================================================
// Player State - currently active episode for cross-device awareness
// =========================================================================

export type PlaybackState = 'playing' | 'paused' | 'stopped';

/**
 * Cloud player state record - what's stored in Supabase.
 * Maps to `public.user_player_state` table.
 */
export interface CloudPlayerState {
    user_id: string;
    feed_url: string;
    episode_guid: string;
    playback_state: PlaybackState;
    position_seconds: number;
    device_id: string;
    updated_at: string;
}

/**
 * Payload for upserting player state.
 */
export interface PlayerStatePayload {
    feed_url: string;
    episode_guid: string;
    playback_state: PlaybackState;
    position_seconds: number;
    device_id: string;
}

// =========================================================================
// Sync Result Types - for initial sync operations
// =========================================================================

/**
 * Result of syncing subscriptions.
 */
export interface SubscriptionSyncResult {
    added: string[];       // feed_urls that were added locally
    removed: string[];     // feed_urls that were removed locally
    unchanged: number;     // count of unchanged subscriptions
}

/**
 * Result of syncing episode states.
 */
export interface EpisodeStateSyncResult {
    updated: number;       // count of states updated (either direction)
    unchanged: number;     // count of unchanged states
}

/**
 * Result of syncing the queue.
 */
export interface QueueSyncResult {
    source: 'local' | 'cloud' | 'unchanged';
    itemCount: number;
}

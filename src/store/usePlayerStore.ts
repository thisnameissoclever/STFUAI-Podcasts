import { create } from 'zustand';
import type { Episode } from '../types';

import { db } from '../services/db';

interface PlayerState {
    currentEpisode: Episode | null;
    isPlaying: boolean;
    playbackRate: number;
    defaultPlaybackRate: number; // Default speed from settings
    queue: Episode[];
    currentTime: number;
    duration: number;
    isPlayerOpen: boolean;
    volume: number;

    lastSeekTime: number; // Timestamp of when the last seek occurred

    // Actions
    play: (episode: Episode) => Promise<void>;
    pause: () => void;
    resume: () => void;
    setPlaybackRate: (rate: number) => void;
    addToQueue: (episode: Episode) => void;
    removeFromQueue: (episodeId: number) => void;
    playNextInQueue: () => Promise<void>;
    reorderQueue: (fromIndex: number, toIndex: number) => void;
    seek: (time: number) => void;
    skipForward: () => Promise<void>;
    skipBackward: () => Promise<void>;
    markAsPlayed: (episodeId: number, autoAdvance?: boolean) => Promise<void>;
    togglePlayer: () => void;
    setVolume: (volume: number) => Promise<void>;
    loadState: () => Promise<void>;
    saveState: () => Promise<void>;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
    currentEpisode: null,
    isPlaying: false,
    playbackRate: 1.0,
    defaultPlaybackRate: 1.0,
    queue: [],
    currentTime: 0,
    duration: 0,
    isPlayerOpen: false,
    volume: 1.0,
    lastSeekTime: 0,

    play: async (episode: Episode) => {
        const { currentEpisode, queue } = get();

        // If already playing this episode, just resume
        if (currentEpisode?.id === episode.id) {
            get().resume();
            return;
        }

        // Remove the new episode from the queue if it exists (to prevent duplicates/re-playing)
        const newQueue = queue.filter(e => e.id !== episode.id);

        // Handle interruption: If current episode exists and is NOT played, move to top of queue
        let updatedQueue = newQueue;
        if (currentEpisode && !currentEpisode.isPlayed) {
            console.log(`[PlayerStore] Interrupting episode ${currentEpisode.id}. Moving to top of queue.`);

            // Save current position
            const currentTime = get().currentTime;
            const updatedCurrent = { ...currentEpisode, playbackPosition: currentTime };

            // Persist to DB and PodcastStore
            await db.saveEpisode(updatedCurrent);

            const { usePodcastStore } = await import('./usePodcastStore');
            usePodcastStore.setState((state) => ({
                episodes: { ...state.episodes, [currentEpisode.id]: updatedCurrent }
            }));

            updatedQueue = [updatedCurrent, ...newQueue];
        }

        // Update queue immediately
        set({ queue: updatedQueue });

        // FIX: Reset played status if re-playing a completed episode
        // This ensures transcripts can be re-generated and the episode is treated as "active"
        if (episode.isPlayed || (episode.transcriptionStatus === 'completed' && !episode.transcript)) {
            console.log(`[PlayerStore] Resetting played status for episode ${episode.id}`);

            const updatedEpisode = {
                ...episode,
                isPlayed: false,
                // If transcript is missing but status says completed, reset status to allow re-transcription
                transcriptionStatus: (!episode.transcript && episode.transcriptionStatus === 'completed')
                    ? undefined
                    : episode.transcriptionStatus
            };

            // Persist to DB
            await db.saveEpisode(updatedEpisode);

            // Update PodcastStore
            const { usePodcastStore } = await import('./usePodcastStore');
            usePodcastStore.setState((state) => ({
                episodes: { ...state.episodes, [episode.id]: updatedEpisode }
            }));

            // Use the updated episode for playback logic
            // eslint-disable-next-line no-param-reassign
            episode = updatedEpisode;
        }

        // Enforce Download Before Play
        // We must have the file locally to play it (for ad detection, etc.)
        const { usePodcastStore } = await import('./usePodcastStore');

        // Initial check
        let podcastStore = usePodcastStore.getState();
        const isDownloaded = podcastStore.isDownloaded(episode.id);

        let episodeToPlay = episode;

        if (!isDownloaded) {
            console.log(`[PlayerStore] Episode ${episode.id} not downloaded. Initiating download check...`);

            // Trigger download
            // If it's already downloading, this returns immediately.
            // If it starts a new download, this awaits until completion.
            await podcastStore.downloadEpisode(episode);

            // Re-fetch state because 'podcastStore' variable is now stale
            // and we need to check if it's still downloading (in case it was already downloading)
            podcastStore = usePodcastStore.getState();

            if (podcastStore.isDownloading(episode.id)) {
                console.log(`[PlayerStore] Episode ${episode.id} is currently downloading. Waiting for completion...`);

                // Poll until download finishes
                while (usePodcastStore.getState().isDownloading(episode.id)) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                console.log(`[PlayerStore] Download wait finished.`);
            }

            // Re-fetch one last time to get the final result
            podcastStore = usePodcastStore.getState();
            const updatedEpisode = podcastStore.episodes[episode.id];

            if (updatedEpisode && updatedEpisode.isDownloaded) {
                console.log(`[PlayerStore] Download successful. Playing local file.`);
                episodeToPlay = updatedEpisode;
            } else {
                console.error(`[PlayerStore] Download failed or finished but episode not marked downloaded. Fallback to stream (undesirable).`);
            }
        } else {
            // Already downloaded, ensure we have the latest version with localFilePath
            const updatedEpisode = podcastStore.episodes[episode.id];
            if (updatedEpisode) {
                episodeToPlay = updatedEpisode;
            }
        }

        // Reset playback rate to default from settings for new episode
        const defaultRate = get().defaultPlaybackRate;

        // Use saved playback position if available
        const startTime = episodeToPlay.playbackPosition || 0;
        console.log(`[PlayerStore] Starting playback at ${startTime}s`);

        set({ currentEpisode: episodeToPlay, isPlaying: true, playbackRate: defaultRate, currentTime: startTime });
    },

    pause: () => set({ isPlaying: false }),

    resume: () => set({ isPlaying: true }),

    setPlaybackRate: (rate: number) => set({ playbackRate: rate }),

    addToQueue: async (episode: Episode) => {
        const { queue, isPlaying, currentEpisode } = get();

        // If queue is empty and nothing is playing, play immediately
        if (queue.length === 0 && !isPlaying && !currentEpisode) {
            get().play(episode);
            return;
        }

        set((state) => {
            if (state.queue.find(e => e.id === episode.id)) return state;
            return { queue: [...state.queue, episode] };
        });

        // FIX: Reset played status if adding a completed episode to queue
        if (episode.isPlayed || (episode.transcriptionStatus === 'completed' && !episode.transcript)) {
            console.log(`[PlayerStore] Resetting played status for queued episode ${episode.id}`);

            const updatedEpisode = {
                ...episode,
                isPlayed: false,
                transcriptionStatus: (!episode.transcript && episode.transcriptionStatus === 'completed')
                    ? undefined
                    : episode.transcriptionStatus
            };

            await db.saveEpisode(updatedEpisode);

            const { usePodcastStore } = await import('./usePodcastStore');
            usePodcastStore.setState((state) => ({
                episodes: { ...state.episodes, [episode.id]: updatedEpisode }
            }));

            // Update the episode in the queue we just added
            set((state) => ({
                queue: state.queue.map(e => e.id === episode.id ? updatedEpisode : e)
            }));

            // Use updated episode for download check
            // eslint-disable-next-line no-param-reassign
            episode = updatedEpisode;
        }

        // Always download when adding to queue (auto-transcription happens in downloadEpisode)
        const { usePodcastStore } = await import('./usePodcastStore');
        const state = usePodcastStore.getState();
        if (!state.isDownloaded(episode.id) && !state.isDownloading(episode.id)) {
            state.downloadEpisode(episode);
        }
    },

    removeFromQueue: async (episodeId: number) => {
        const { currentEpisode } = get();

        set((state) => ({
            queue: state.queue.filter(e => e.id !== episodeId)
        }));

        // Strict Rule: If removed from queue and NOT playing, delete the file
        if (currentEpisode?.id !== episodeId) {
            const { usePodcastStore } = await import('./usePodcastStore');
            console.log(`[PlayerStore] Removing episode ${episodeId} from queue. Deleting file.`);
            await usePodcastStore.getState().deleteEpisodeFile(episodeId);
        }
    },

    playNextInQueue: async () => {
        const { queue } = get();
        if (queue.length > 0) {
            const next = queue[0];
            // Play next episode
            await get().play(next);
            // Remove from queue (it's now playing)
            get().removeFromQueue(next.id);
        } else {
            // No next episode, close player
            set({ isPlaying: false, isPlayerOpen: false, currentEpisode: null });
        }
    },

    playNext: () => {
        // Deprecated, alias to playNextInQueue
        get().playNextInQueue();
    },

    reorderQueue: (fromIndex: number, toIndex: number) => {
        set((state) => {
            const newQueue = [...state.queue];
            const [movedItem] = newQueue.splice(fromIndex, 1);
            newQueue.splice(toIndex, 0, movedItem);
            return { queue: newQueue };
        });
    },

    seek: (time: number) => set({ currentTime: time, lastSeekTime: Date.now() }),

    skipForward: async () => {
        const prefs = await db.getPreferences();
        const seconds = prefs.skipForwardSeconds || 30;
        const currentTime = get().currentTime;
        const duration = get().duration;
        get().seek(Math.min(duration, currentTime + seconds));
    },

    skipBackward: async () => {
        const prefs = await db.getPreferences();
        const seconds = prefs.skipBackwardSeconds || 20;
        const currentTime = get().currentTime;
        get().seek(Math.max(0, currentTime - seconds));
    },

    markAsPlayed: async (episodeId: number, autoAdvance = false) => {
        const { usePodcastStore } = await import('./usePodcastStore');
        const store = usePodcastStore.getState();

        // Update local state
        const episode = store.episodes[episodeId];
        if (episode) {
            const updatedEpisode = { ...episode, isPlayed: true, playbackPosition: 0 };
            await db.saveEpisode(updatedEpisode);

            // Update store
            usePodcastStore.setState((state) => ({
                episodes: { ...state.episodes, [episodeId]: updatedEpisode }
            }));
        }

        // Cleanup file if not in queue
        const { queue } = get();
        const isInQueue = queue.some(e => e.id === episodeId);

        if (!isInQueue) {
            console.log(`[PlayerStore] Episode ${episodeId} marked as played. Deleting file.`);
            await store.deleteEpisodeFile(episodeId);
        } else {
            console.log(`[PlayerStore] Episode ${episodeId} marked as played but kept (in queue).`);
        }

        // If it's the current episode
        const { currentEpisode } = get();
        if (currentEpisode?.id === episodeId) {
            // Clear current episode so it's not treated as "interrupted" if we play next
            set({ currentEpisode: null });

            if (autoAdvance) {
                await get().playNextInQueue();
            } else {
                set({ isPlaying: false });
            }
        }
    },

    togglePlayer: () => set((state) => ({ isPlayerOpen: !state.isPlayerOpen })),

    setVolume: async (volume: number) => {
        set({ volume });
        const prefs = await db.getPreferences();
        await db.savePreferences({ ...prefs, volume });
    },

    // Persistence
    loadState: async () => {
        // Load default playback rate from preferences
        const prefs = await db.getPreferences();
        const defaultRate = prefs.playbackSpeed || 1.0;

        const state = await db.getPlayerState();
        if (state) {
            set({
                currentEpisode: state.currentEpisode,
                queue: state.queue || [],
                playbackRate: state.playbackRate || defaultRate,
                defaultPlaybackRate: defaultRate,
                currentTime: state.currentTime || 0,
                volume: prefs.volume || 1.0
            });
        } else {
            // If no saved state, just set the defaults
            set({
                defaultPlaybackRate: defaultRate,
                volume: prefs.volume || 1.0
            });
        }
    },

    saveState: async () => {
        const { currentEpisode, queue, playbackRate, currentTime } = get();

        // Create a lightweight version of currentEpisode to avoid saving large transcripts/ads to player state
        let lightEpisode = null;
        if (currentEpisode) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { transcript, adSegments, ...rest } = currentEpisode;
            lightEpisode = rest;
        }

        await db.savePlayerState({
            currentEpisode: lightEpisode as Episode, // Cast back to Episode (it's a subset but compatible for storage)
            queue,
            playbackRate,
            currentTime
        });
    }
}));

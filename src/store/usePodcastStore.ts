import { create } from 'zustand';
import type { Podcast, Episode } from '../types';
import { db } from '../services/db';
import {
    pushSubscription,
    deleteSubscription,
    isCloudSyncAvailable,
} from '../services/cloudSync';

interface PodcastState {
    subscriptions: Record<number, Podcast>;
    episodes: Record<number, Episode>;
    downloadingEpisodes: Set<number>;
    loading: boolean;

    initialized: boolean;

    loadSubscriptions: () => Promise<void>;
    loadEpisodes: () => Promise<void>;
    subscribe: (podcast: Podcast) => Promise<void>;
    unsubscribe: (id: number) => Promise<void>;
    isSubscribed: (id: number) => boolean;
    downloadEpisode: (episode: Episode) => Promise<void>;
    transcribeEpisode: (episodeId: number, force?: boolean) => Promise<void>;
    detectAds: (episodeId: number) => Promise<void>;
    isDownloading: (episodeId: number) => boolean;
    isDownloaded: (episodeId: number) => boolean;
    getTranscriptionStatus: (episodeId: number) => 'pending' | 'processing' | 'completed' | 'failed' | undefined;
    deleteEpisodeFile: (episodeId: number) => Promise<void>;
    ensureQueueDownloaded: (queue: Episode[]) => Promise<void>;
    toggleAutoAddToQueue: (podcastId: number) => Promise<void>;
    cancelDownload: (episodeId: number) => Promise<void>;
    clearAllData: () => Promise<void>;
}

export const usePodcastStore = create<PodcastState>((set, get) => ({
    subscriptions: {},
    episodes: {},
    downloadingEpisodes: new Set(),
    loading: false,
    initialized: false,

    loadSubscriptions: async () => {
        set({ loading: true });
        try {
            const subs = await db.getPodcasts();
            set({ subscriptions: subs });
        } catch (error) {
            console.error('Failed to load subscriptions:', error);
        } finally {
            set({ loading: false });
        }
    },

    loadEpisodes: async () => {
        set({ loading: true });
        try {
            const eps = await db.getEpisodes();
            set({ episodes: eps, initialized: true });
        } catch (error) {
            console.error('Failed to load episodes:', error);
            set({ initialized: true }); // Even on error, mark as initialized so we don't block
        } finally {
            set({ loading: false });
        }
    },

    subscribe: async (podcast: Podcast) => {
        try {
            // Initialize auto-queue settings
            const podcastWithSettings = {
                ...podcast,
                autoAddToQueue: true,
                subscribedAt: Date.now()
            };

            await db.savePodcast(podcastWithSettings);
            set((state) => ({
                subscriptions: { ...state.subscriptions, [podcast.id]: podcastWithSettings }
            }));

            // Sync with cloud (non-blocking, fire-and-forget)
            isCloudSyncAvailable().then(available => {
                if (available) {
                    pushSubscription({
                        feed_url: podcast.url,
                        title: podcast.title,
                        image_url: podcast.image || '',
                    }).catch(err => console.error('[PodcastStore] Cloud sync failed:', err));
                }
            });
        } catch (error) {
            console.error('Failed to subscribe:', error);
        }
    },

    unsubscribe: async (id: number) => {
        try {
            // Get podcast info before deleting (need feed URL for cloud sync)
            const podcast = get().subscriptions[id];

            await db.removePodcast(id);
            set((state) => {
                const next = { ...state.subscriptions };
                delete next[id];
                return { subscriptions: next };
            });

            // Sync with cloud (non-blocking)
            if (podcast?.url) {
                isCloudSyncAvailable().then(available => {
                    if (available) {
                        deleteSubscription(podcast.url)
                            .catch(err => console.error('[PodcastStore] Cloud sync delete failed:', err));
                    }
                });
            }
        } catch (error) {
            console.error('Failed to unsubscribe:', error);
        }
    },

    isSubscribed: (id: number) => {
        return !!get().subscriptions[id];
    },

    toggleAutoAddToQueue: async (podcastId: number) => {
        const podcast = get().subscriptions[podcastId];
        if (!podcast) return;

        const updatedPodcast = { ...podcast, autoAddToQueue: !podcast.autoAddToQueue };

        try {
            await db.savePodcast(updatedPodcast);
            set((state) => ({
                subscriptions: { ...state.subscriptions, [podcastId]: updatedPodcast }
            }));
        } catch (error) {
            console.error('Failed to toggle auto-add to queue:', error);
        }
    },

    downloadEpisode: async (episode: Episode) => {
        // Check if already downloaded or downloading
        if (get().isDownloaded(episode.id)) {
            console.log('Episode already downloaded:', episode.title);
            return;
        }
        if (get().isDownloading(episode.id)) {
            console.log('Episode already downloading:', episode.title);
            return;
        }

        console.log('Starting download for episode:', episode.id, episode.title);

        set((state) => ({
            downloadingEpisodes: new Set(state.downloadingEpisodes).add(episode.id)
        }));

        try {
            const { storageService } = await import('../services/storage');
            const filename = `${episode.id}.mp3`;
            const localPath = await storageService.downloadFile(episode.enclosureUrl, filename);

            // CRITICAL FIX: Merge with existing episode state to preserve transcript/ads
            // The passed 'episode' object might be stale (e.g. from queue)
            const existingEpisode = get().episodes[episode.id];
            const episodeToUse = existingEpisode ? { ...episode, ...existingEpisode } : episode;

            const updatedEpisode = {
                ...episodeToUse,
                isDownloaded: true,
                localFilePath: localPath
            };

            set((state) => {
                const newDownloading = new Set(state.downloadingEpisodes);
                newDownloading.delete(episode.id);
                return {
                    episodes: { ...state.episodes, [episode.id]: updatedEpisode },
                    downloadingEpisodes: newDownloading
                };
            });

            await db.saveEpisode(updatedEpisode);
            console.log('Episode saved with local path');

            // Auto-transcribe after download - ONLY if not already transcribed
            // Double check the updatedEpisode object which now definitely has the latest state
            if (!updatedEpisode.transcript) {
                get().transcribeEpisode(episode.id);
            } else {
                console.log('Episode already has transcript, skipping auto-transcription');
            }

        } catch (error: any) {
            // Handle cancellation gracefully
            if (error.message === 'Download cancelled') {
                console.log('Download cancelled for episode:', episode.title);
            } else {
                console.error('Failed to download episode:', error);
            }

            set((state) => {
                const newDownloading = new Set(state.downloadingEpisodes);
                newDownloading.delete(episode.id);
                return { downloadingEpisodes: newDownloading };
            });
        }
    },

    cancelDownload: async (episodeId: number) => {
        if (!get().isDownloading(episodeId)) return;

        try {
            const { storageService } = await import('../services/storage');
            const filename = `${episodeId}.mp3`;
            await storageService.cancelDownload(filename);

            // State update is handled in downloadEpisode's catch block or here if needed immediately
            set((state) => {
                const newDownloading = new Set(state.downloadingEpisodes);
                newDownloading.delete(episodeId);
                return { downloadingEpisodes: newDownloading };
            });
        } catch (error) {
            console.error('Failed to cancel download:', error);
        }
    },

    isDownloading: (episodeId: number) => {
        return get().downloadingEpisodes.has(episodeId);
    },

    isDownloaded: (episodeId: number) => {
        return get().episodes[episodeId]?.isDownloaded || false;
    },

    transcribeEpisode: async (episodeId: number, force: boolean = false) => {
        const episode = get().episodes[episodeId];
        if (!episode || !episode.isDownloaded || !episode.localFilePath) {
            console.error('Cannot transcribe: episode not downloaded');
            return;
        }

        // Check if already transcribed or processing (unless forced)
        if (!force) {
            // STRICT CHECK: If transcript exists, DO NOT re-transcribe
            if (episode.transcript) {
                console.log('Episode already has a transcript. Skipping re-transcription:', episode.title);
                return;
            }

            if (episode.transcriptionStatus === 'completed') {
                console.log('Episode marked as completed. Skipping re-transcription:', episode.title);
                return;
            }

            if (episode.transcriptionStatus === 'processing') {
                console.log('Transcription already in progress:', episode.title);
                return;
            }
        }

        set((state) => ({
            episodes: {
                ...state.episodes,
                [episodeId]: {
                    ...state.episodes[episodeId],
                    transcriptionStatus: 'processing'
                }
            }
        }));

        try {
            const { processEpisodeInCloud } = await import('../services/cloudApi');
            const filename = `${episodeId}.mp3`;

            console.log('Starting cloud transcription for episode:', episodeId, force ? '(FORCED)' : '');

            // Read the file for upload - use filename only, not full path
            // (readFile IPC handler prepends the podcast directory)
            const fileBuffer = await window.electronAPI!.readFile(filename);

            // Process in cloud - this returns both transcript AND detected segments
            const results = await processEpisodeInCloud(
                fileBuffer,
                filename,
                {
                    feedId: episode.feedId,
                    guid: episode.guid,
                    title: episode.title,
                    durationSeconds: episode.duration
                },
                (status) => {
                    console.log(`[Cloud] Status: ${status.status} (${status.progress || 0}%)`);
                }
            );

            // Build transcript from cloud results
            const transcript = {
                episodeId,
                text: results.transcript.text,
                segments: results.transcript.segments,
                language: results.transcript.language,
                duration: results.transcript.duration,
                createdAt: Date.now()
            };

            console.log('Cloud transcription completed:', transcript.duration, 'seconds');

            // Update state with transcript AND segments from cloud
            const updatedEpisode = {
                ...get().episodes[episodeId],
                transcript,
                transcriptionStatus: 'completed' as const,
                duration: transcript.duration || get().episodes[episodeId].duration,
                adSegments: results.detectedSegments,
                adDetectionType: results.detectionMethod
            };

            set((state) => ({
                episodes: {
                    ...state.episodes,
                    [episodeId]: updatedEpisode
                }
            }));

            await db.saveTranscript(episodeId, transcript);
            await db.saveEpisode(updatedEpisode);

            console.log(`Cloud processing complete: ${results.detectedSegments.length} skippable segments detected`);

        } catch (error) {
            console.error('Failed to transcribe episode:', error);
            set((state) => ({
                episodes: {
                    ...state.episodes,
                    [episodeId]: {
                        ...state.episodes[episodeId],
                        transcriptionStatus: 'failed'
                    }
                }
            }));
        }
    },

    detectAds: async (episodeId: number) => {
        // Cloud backend now handles advanced detection during transcription
        // This function is kept for legacy compatibility but does nothing now
        console.log('[detectAds] Advanced detection is now handled by cloud backend during transcription');

        // If episode already has segments from cloud, just log them
        const episode = get().episodes[episodeId];
        if (episode?.adSegments) {
            console.log(`[detectAds] Episode already has ${episode.adSegments.length} segments from cloud (${episode.adDetectionType})`);
        }
    },

    getTranscriptionStatus: (episodeId: number) => {
        return get().episodes[episodeId]?.transcriptionStatus;
    },

    deleteEpisodeFile: async (episodeId: number) => {
        const episode = get().episodes[episodeId];
        if (!episode) return;

        try {
            const { storageService } = await import('../services/storage');
            const filename = `${episodeId}.mp3`;

            // Only delete file if it was downloaded
            if (episode.isDownloaded) {
                await storageService.deleteFile(filename);

                // Also try to delete the compressed file as backup
                const compressedFilename = `${episodeId}-compressed.mp3`;
                await storageService.deleteFile(compressedFilename).catch(() => {
                    // Ignore error if compressed file doesn't exist
                });
            }

            const updatedEpisode = {
                ...episode,
                isDownloaded: false,
                localFilePath: undefined,
                transcript: undefined,
                adSegments: undefined,
                transcriptionStatus: undefined
            };

            set((state) => ({
                episodes: { ...state.episodes, [episodeId]: updatedEpisode }
            }));

            await db.saveEpisode(updatedEpisode);
            console.log('Episode file and data deleted:', episodeId);

        } catch (error) {
            console.error('Failed to delete episode file:', error);
        }
    },

    ensureQueueDownloaded: async (queue: Episode[]) => {
        const { downloadEpisode, isDownloaded, isDownloading, episodes } = get();
        const { verifyEpisodeFileExists, recoverMissingEpisode } = await import('../services/episodeRecovery');

        for (const queuedEpisode of queue) {
            // CRITICAL: Use fresh episode data from the store, not the potentially stale queue object.
            // The queue contains snapshot copies of episodes that may have outdated isDownloaded flags,
            // causing false "missing file" detections and unnecessary re-downloads/re-transcriptions.
            const freshEpisode = episodes[queuedEpisode.id] || queuedEpisode;

            if (isDownloading(freshEpisode.id)) {
                // Already downloading, skip
                continue;
            }

            if (isDownloaded(freshEpisode.id)) {
                // Marked as downloaded - verify file actually exists using fresh episode data
                const fileExists = await verifyEpisodeFileExists(freshEpisode);
                if (!fileExists) {
                    console.log(`[PodcastStore] Queue episode "${freshEpisode.title}" has missing file. Recovering...`);
                    await recoverMissingEpisode(freshEpisode.id, freshEpisode.playbackPosition);
                }
            } else {
                // Not downloaded yet - initiate download
                console.log('Auto-downloading queued episode:', freshEpisode.title);
                downloadEpisode(freshEpisode);
            }
        }
    },

    clearAllData: async () => {
        try {
            const { storageService } = await import('../services/storage');

            // 1. Delete all files
            const episodes = Object.values(get().episodes);
            for (const ep of episodes) {
                if (ep.isDownloaded) {
                    const filename = `${ep.id}.mp3`;
                    await storageService.deleteFile(filename).catch(e => console.error(`Failed to delete ${filename}`, e));
                }
            }

            // 2. Clear DB
            await db.clearAll();

            // 3. Reset Store
            set({
                subscriptions: {},
                episodes: {},
                downloadingEpisodes: new Set(),
                loading: false
            });

            console.log('All data cleared successfully');
        } catch (error) {
            console.error('Failed to clear all data:', error);
        }
    }
}));

import { create } from 'zustand';
import type { Podcast, Episode } from '../types';
import { db } from '../services/db';

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
        } catch (error) {
            console.error('Failed to subscribe:', error);
        }
    },

    unsubscribe: async (id: number) => {
        try {
            await db.removePodcast(id);
            set((state) => {
                const next = { ...state.subscriptions };
                delete next[id];
                return { subscriptions: next };
            });
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
            const { transcribeEpisode: transcribe } = await import('../services/transcription');
            const filename = `${episodeId}.mp3`;

            console.log('Starting transcription for episode:', episodeId, force ? '(FORCED)' : '');
            const transcript = await transcribe(filename, episodeId);
            console.log('Transcription completed:', transcript);

            // Debug: Compare transcript duration vs RSS feed duration
            console.log(`[Duration Debug] Transcript duration: ${transcript.duration}, RSS feed duration: ${get().episodes[episodeId]?.duration}`);

            set((state) => ({
                episodes: {
                    ...state.episodes,
                    [episodeId]: {
                        ...state.episodes[episodeId],
                        transcript,
                        transcriptionStatus: 'completed',
                        // Update episode duration with actual file duration from transcript
                        duration: transcript.duration || state.episodes[episodeId].duration
                    }
                }
            }));

            await db.saveTranscript(episodeId, transcript);

            // Auto-detect basic skippable segments (ads) using speaker labels
            // NOTE: Only works with AssemblyAI transcripts (speaker diarization)
            try {
                const { detectBasicSegments } = await import('../services/skippableSegments');
                const prefs = await db.getPreferences();
                const provider = prefs.transcriptionProvider || 'assemblyai';

                // Only attempt basic detection if using AssemblyAI (has speaker labels)
                if (provider === 'assemblyai') {
                    // Ensure we have a valid duration for validation.
                    // Priority: 1. Transcript duration (API - most accurate from file), 2. Episode duration (feed), 3. Last segment end time
                    let duration = transcript.duration;

                    if (!duration) {
                        duration = get().episodes[episodeId]?.duration;
                    }

                    if (!duration && transcript.segments && transcript.segments.length > 0) {
                        const lastSegment = transcript.segments[transcript.segments.length - 1];
                        duration = lastSegment.end;
                    }

                    // If still no duration, we can't effectively cap segments, but we should avoid 0 to prevent rejecting all segments.
                    // We'll use a safe fallback that effectively disables the "cap at duration" check if we absolutely cannot determine duration.
                    if (!duration) {
                        console.warn('Could not determine episode duration for ad detection validation. Validation may be less strict.');
                        duration = Number.MAX_SAFE_INTEGER;
                    }
                    const basicSegments = detectBasicSegments(transcript, duration);

                    // Always save the result, even if empty, so UI knows basic detection ran
                    const updatedEpisodeWithAds = {
                        ...get().episodes[episodeId],
                        adSegments: basicSegments,
                        adDetectionType: 'basic' as const
                    };

                    set((state) => ({
                        episodes: {
                            ...state.episodes,
                            [episodeId]: updatedEpisodeWithAds
                        }
                    }));

                    await db.saveEpisode(updatedEpisodeWithAds);

                    if (basicSegments.length > 0) {
                        console.log('Detected basic skippable segments:', basicSegments);
                    } else {
                        console.log('Basic detection ran but found no skippable segments. Use "Analyze" for advanced AI detection.');
                    }
                } else {
                    console.log('[Transcription] Basic segment detection skipped (OpenAI Whisper does not provide speaker labels)');
                }
            } catch (adError) {
                console.warn('Failed to auto-detect basic segments:', adError);
                // Don't fail the whole transcription if ad detection fails
            }

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
        const episode = get().episodes[episodeId];
        if (!episode || !episode.transcript) {
            console.error('Cannot detect ads: no transcript available');
            return;
        }

        try {
            const { detectAdvancedSegments } = await import('../services/skippableSegments');
            console.log('Starting advanced skippable segment detection for episode:', episodeId);

            const adSegments = await detectAdvancedSegments(episode);
            console.log('Ad detection completed:', adSegments);

            const updatedEpisode = {
                ...episode,
                adSegments,
                adDetectionType: 'advanced' as const
            };

            set((state) => ({
                episodes: {
                    ...state.episodes,
                    [episodeId]: updatedEpisode
                }
            }));

            await db.saveEpisode(updatedEpisode);

        } catch (error) {
            console.error('Failed to detect ads:', error);
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

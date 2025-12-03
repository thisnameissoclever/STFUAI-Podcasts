import React, { useEffect, useRef, useMemo } from 'react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { usePodcastStore } from '../../store/usePodcastStore';
import { db } from '../../services/db';

import skipSoundUrl from '../../assets/skip.mp3';

export const AudioController: React.FC = () => {
    const audioRef = useRef<HTMLAudioElement>(null);
    // Memoize the audio object so it's not recreated on every render
    const skipAudio = useMemo(() => new Audio(skipSoundUrl), []);
    const skipAudioRef = useRef<HTMLAudioElement>(skipAudio);
    const isSkippingRef = useRef(false);
    const lastSavedTimeRef = useRef(0);
    const retryCountRef = useRef(0);
    const lastStoreUpdateRef = useRef(0);

    // Use selectors to prevent re-renders on unrelated state changes
    // (Spoiler: This didn't actually work, but... whatever, I'm leaving it 
    // because it's probably a better solution anyway.)
    const currentEpisode = usePlayerStore(state => state.currentEpisode);
    const isPlaying = usePlayerStore(state => state.isPlaying);
    const playbackRate = usePlayerStore(state => state.playbackRate);
    const volume = usePlayerStore(state => state.volume);
    const lastSeekTime = usePlayerStore(state => state.lastSeekTime);
    const queue = usePlayerStore(state => state.queue);

    const { loading, initialized } = usePodcastStore();

    // Auto-download queue episodes
    useEffect(() => {
        if (initialized && !loading && queue.length > 0) {
            usePodcastStore.getState().ensureQueueDownloaded(queue);
        }
    }, [queue, loading, initialized]);

    // Handle source changes
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio || !currentEpisode) return;

        const loadSource = async () => {
            let src = currentEpisode.enclosureUrl;
            let isLocal = false;

            if (currentEpisode.isDownloaded && currentEpisode.localFilePath) {
                src = `local-media://${currentEpisode.id}.mp3`;
                isLocal = true;
            }

            console.log(`[AudioController] Loading source: ${isLocal ? 'LOCAL' : 'STREAM'} -> ${src}`);

            // Check if source is actually different
            const needsReload = !audio.src || !audio.src.includes(src);

            if (needsReload) {
                console.log(`[AudioController] Source changed, loading new source`);

                // Reset retry count on new source
                retryCountRef.current = 0;
                usePlayerStore.getState().setPlaybackError(false);

                const savedTime = usePlayerStore.getState().currentTime;
                audio.src = src;

                // Wait for metadata to load before attempting playback or seeking
                await new Promise<void>((resolve) => {
                    const handleMetadata = () => {
                        console.log(`[AudioController] Metadata loaded. Duration: ${audio.duration}`);

                        // Restore playback position if we have one
                        if (savedTime > 0 && savedTime < audio.duration) {
                            audio.currentTime = savedTime;
                        }

                        //Re-apply playback rate since it automatically tries to reset 
                        // to 1.0 on src change
                        audio.playbackRate = usePlayerStore.getState().playbackRate;

                        audio.removeEventListener('loadedmetadata', handleMetadata);
                        resolve();
                    };

                    const handleError = async (e: Event) => {
                        console.error(`[AudioController] Error loading source:`, e);
                        audio.removeEventListener('loadedmetadata', handleMetadata);
                        audio.removeEventListener('error', handleError);

                        // Retry logic for local files 40x errors
                        if (isLocal && retryCountRef.current < 1) {
                            console.log(`[AudioController] Attempting recovery for missing file...`);
                            retryCountRef.current++;

                            // Trigger re-download
                            const { usePodcastStore } = await import('../../store/usePodcastStore');
                            await usePodcastStore.getState().downloadEpisode(currentEpisode);

                            // Force reload by briefly clearing src (or just re-running effect by dependency change, but here we are inside effect)
                            // We can just call loadSource recursively or let the store update trigger re-render?
                            // Store update (isDownloaded/localFilePath) might trigger re-render if currentEpisode changes.
                            // But downloadEpisode updates the episode object in store, so currentEpisode in store changes, triggering this effect again.
                            // So we just exit here.
                            resolve();
                            return;
                        }

                        // If retry failed or not local
                        usePlayerStore.getState().setPlaybackError(true);
                        resolve();
                    };

                    audio.addEventListener('loadedmetadata', handleMetadata);
                    audio.addEventListener('error', handleError, { once: true });
                });

                if (isPlaying && !usePlayerStore.getState().playbackError) {
                    try {
                        await audio.play();
                    } catch (e) {
                        console.error("Playback failed", e);
                    }
                }
            }
        };

        loadSource();
    }, [currentEpisode]);

    // Handle play/pause
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        if (isPlaying) {
            // Don't resume main audio if we are currently skipping
            if (!isSkippingRef.current) {
                audio.play().catch(e => console.error("Play failed", e));
            }
        } else {
            audio.pause();
        }
    }, [isPlaying]);

    // Sync volume with audio element
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = volume;
        }
        // Also set volume for skip sound (maybe slightly louder or same?)
        if (skipAudioRef.current) {
            skipAudioRef.current.volume = volume;
        }
    }, [volume]);

    // Handle playback rate
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.playbackRate = playbackRate;
        }
    }, [playbackRate]);

    // Handle seeking
    useEffect(() => {
        // We need to access currentTime from the store here, but we don't want to subscribe to it 
        // in the main component body to avoid re-renders. Which are a performance nightmare, but apparently not the main issue I'm trying to fix by messing with this (I learned after missing with it and don't feel like reverting). 
        // However, lastSeekTime updates whenever seek() is called, so this effect runs then.
        const currentTime = usePlayerStore.getState().currentTime;

        if (audioRef.current && Math.abs(audioRef.current.currentTime - currentTime) > 0.5) {
            // If user seeks manually, reset skipping state
            isSkippingRef.current = false;
            audioRef.current.currentTime = currentTime;
        }
    }, [lastSeekTime]);

    // OPTIMIZATION: Manual event listeners to avoid React synthetic event overhead
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleTimeUpdate = () => {
            const now = Date.now();

            // Throttle ENTIRE handler to 200ms (5Hz) to prevent expensive operations
            // Ad detection at 5Hz is more than sufficient for smooth skipping
            if (now - lastStoreUpdateRef.current < 200) return;

            const currentTime = audio.currentTime;
            lastStoreUpdateRef.current = now;

            // Update store
            usePlayerStore.setState({
                currentTime,
                duration: audio.duration || 0
            });

            // Auto-skip ads
            const podcastStore = usePodcastStore.getState();
            const currentEpId = usePlayerStore.getState().currentEpisode?.id;
            if (!currentEpId) return;

            const freshEpisode = podcastStore.episodes[currentEpId];

            if (freshEpisode?.adSegments && freshEpisode.adSegments.length > 0) {
                const currentAd = freshEpisode.adSegments.find(
                    seg => currentTime >= seg.startTimeSeconds && currentTime < seg.endTimeSeconds
                );

                if (currentAd) {
                    // If we are not already skipping, start the skip sequence
                    if (!isSkippingRef.current) {
                        console.log(`[AudioController] Skipping ad segment: ${currentAd.description} (${currentAd.startTime} -> ${currentAd.endTime})`);

                        isSkippingRef.current = true;

                        // Pause main audio
                        audio.pause();

                        // Play skip sound
                        skipAudioRef.current.currentTime = 0;
                        skipAudioRef.current.play().catch(e => console.error("Skip sound failed", e));

                        // When skip sound ends, seek and resume
                        skipAudioRef.current.onended = () => {
                            if (audio) {
                                const duration = audio.duration;
                                // Check if the ad ends at or after the episode end (within a small margin)
                                if (currentAd.endTimeSeconds >= duration - 1) {
                                    console.log('[AudioController] Ad ends at episode end, finishing episode');
                                    audio.currentTime = duration;
                                    isSkippingRef.current = false;
                                    // handleEnded will be triggered by the audio element
                                } else {
                                    audio.currentTime = currentAd.endTimeSeconds;
                                    isSkippingRef.current = false;
                                    if (usePlayerStore.getState().isPlaying) {
                                        audio.play().catch(e => console.error("Resume failed", e));
                                    }
                                }
                            }
                        };
                    }
                } else {
                    // Not in an ad segment, ensure skipping state is reset (e.g. if user seeked out)
                    isSkippingRef.current = false;
                }
            }

            // Save state every 5 seconds (throttled)
            const timeNow = Date.now();
            if (timeNow - lastSavedTimeRef.current > 5000) {
                lastSavedTimeRef.current = timeNow;
                usePlayerStore.getState().saveState().catch(err => {
                    console.error('[AudioController] Failed to save state:', err);
                });
            }
        };

        const handleEnded = async () => {
            const currentEpisode = usePlayerStore.getState().currentEpisode;
            if (currentEpisode) {
                // Unload audio source to release file lock and prevent 404 errors
                // when the file is deleted by markAsPlayed
                if (audio) {
                    audio.pause();
                    audio.removeAttribute('src'); // Remove attribute entirely
                    audio.load(); // Force reload to clear buffer
                }

                // Always mark as played
                const { markAsPlayed, playNextInQueue } = usePlayerStore.getState();
                await markAsPlayed(currentEpisode.id);

                // Check auto-play preference before playing next
                const prefs = await db.getPreferences();
                if (prefs.autoPlayNext) {
                    playNextInQueue();
                }
            }
        };

        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('ended', handleEnded);
        };
    }, []); // Empty dependency array means this effect runs once on mount (and cleanup on unmount)
    // But wait, audioRef.current might be null initially? 
    // Actually, refs are stable, but the DOM element might not be attached yet in the very first render pass if it's conditional.
    // But here <audio> is always rendered.
    // However, to be safe, we should probably depend on something that signals the audio element is ready, or just rely on React setting the ref before effects run.
    // React guarantees refs are set before effects run.
    // Don't mind me; just having a conversation with myself by way of Google in my own code comments. 

    return (
        <audio
            ref={audioRef}
        // No props here, all handled via manual event listeners
        />
    );
};

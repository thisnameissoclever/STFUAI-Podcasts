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
    const isRecoveringRef = useRef(false); // Prevent concurrent recovery attempts
    const isEndingRef = useRef(false); // Prevent ad processing while episode is ending

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

                        // Attempt recovery for local files with missing files (one retry)
                        // Also check isRecoveringRef to prevent concurrent recovery from multiple triggers
                        if (isLocal && retryCountRef.current < 1 && !isRecoveringRef.current) {
                            console.log(`[AudioController] Attempting recovery for missing file...`);
                            retryCountRef.current++;
                            isRecoveringRef.current = true;

                            try {
                                // Use the modular recovery service
                                const { recoverMissingEpisode } = await import('../../services/episodeRecovery');
                                const currentTime = usePlayerStore.getState().currentTime;
                                const result = await recoverMissingEpisode(currentEpisode.id, currentTime);

                                if (result.success && result.episode) {
                                    console.log(`[AudioController] Recovery successful. Reloading source...`);

                                    // Small delay to ensure file is fully flushed to disk
                                    await new Promise(r => setTimeout(r, 100));

                                    // Clear the current source to reset any cached error state
                                    audio.removeAttribute('src');
                                    audio.load(); // Force clear the buffer

                                    // Add event listeners BEFORE setting the new source
                                    const onRecoveredMetadata = () => {
                                        console.log(`[AudioController] Recovered source loaded. Duration: ${audio.duration}`);

                                        // Restore playback position
                                        const positionToRestore = result.episode?.playbackPosition || currentTime;
                                        if (positionToRestore > 0 && positionToRestore < audio.duration) {
                                            audio.currentTime = positionToRestore;
                                            console.log(`[AudioController] Restored playback position to ${positionToRestore}s`);
                                        }

                                        audio.playbackRate = usePlayerStore.getState().playbackRate;
                                        isRecoveringRef.current = false;
                                        retryCountRef.current = 0; // Reset retry count for future errors

                                        // Resume playback if we were playing
                                        if (usePlayerStore.getState().isPlaying) {
                                            audio.play().catch(err => console.error('[AudioController] Resume after recovery failed:', err));
                                        }
                                    };

                                    const onRecoveredError = (evt: Event) => {
                                        console.error(`[AudioController] Recovery succeeded but source still failed to load:`, evt);
                                        audio.removeEventListener('loadedmetadata', onRecoveredMetadata);
                                        isRecoveringRef.current = false;
                                        usePlayerStore.getState().setPlaybackError(true);
                                    };

                                    audio.addEventListener('loadedmetadata', onRecoveredMetadata, { once: true });
                                    audio.addEventListener('error', onRecoveredError, { once: true });

                                    // Now set the new source and trigger load
                                    const newSrc = `local-media://${result.episode.id}.mp3`;
                                    audio.src = newSrc;
                                    audio.load(); // Explicitly trigger load

                                    // Update the current episode in the player store to trigger UI updates
                                    usePlayerStore.setState({ currentEpisode: result.episode });
                                } else {
                                    console.error(`[AudioController] Recovery failed: ${result.error}`);
                                    isRecoveringRef.current = false;
                                    usePlayerStore.getState().setPlaybackError(true);
                                }
                            } catch (err) {
                                console.error(`[AudioController] Recovery threw error:`, err);
                                isRecoveringRef.current = false;
                                usePlayerStore.getState().setPlaybackError(true);
                            }

                            resolve();
                            return;
                        }

                        // If retry failed, already recovering, or not local
                        if (!isRecoveringRef.current) {
                            usePlayerStore.getState().setPlaybackError(true);
                        }
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

            //If we're already ending the episode, don't process ads
            // This prevents the infinite loop where timeupdate fires before handleEnded completes
            if (isEndingRef.current) {
                return;
            }

            const freshEpisode = podcastStore.episodes[currentEpId];
            const duration = audio.duration;

            //If we're at or past the end of the episode, don't process ads
            // This prevents infinite loops when an ad segment extends past the actual audio duration
            if (duration > 0 && currentTime >= duration - 0.5) {
                return;
            }

            if (freshEpisode?.adSegments && freshEpisode.adSegments.length > 0) {
                //Clamp ad segment checks to actual duration to prevent issues with ads
                // that extend past the audio file's actual length. 
                //This took way too long to figure out how to fix. 
                const currentAd = freshEpisode.adSegments.find(
                    seg => currentTime >= seg.startTimeSeconds &&
                        currentTime < Math.min(seg.endTimeSeconds, duration - 0.5)
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
                                const audioDuration = audio.duration;
                                // Check if the ad ends at or after the episode end (within a small margin)
                                // Also handle case where ad.endTimeSeconds is past the actual audio duration
                                const effectiveEndTime = Math.min(currentAd.endTimeSeconds, audioDuration);

                                if (effectiveEndTime >= audioDuration - 0.5) {
                                    console.log('[AudioController] Ad ends at episode end, finishing episode');
                                    // Set ending flag BEFORE resetting skip flag to prevent race condition
                                    isEndingRef.current = true;
                                    isSkippingRef.current = false;
                                    // Directly dispatch the ended event instead of seeking to duration
                                    // This is more reliable than seeking and hoping the ended event fires
                                    audio.dispatchEvent(new Event('ended'));
                                } else {
                                    audio.currentTime = effectiveEndTime;
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

                // Reset the ending flag now that episode is fully processed
                isEndingRef.current = false;

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
    }, []); //Empty dependency array means this effect runs once on mount (and cleanup on unmount)
    //Refs are stable, but the DOM element might not be attached yet in the very first render pass if it's conditional.
    //But here `audio` is always rendered.
    //However, to be safe, we should probably depend on something that signals the audio element is ready, or just rely on React setting the ref before effects run.
    //Oh. React makes sure refs are set before effects run.
    //Don't mind me; just having a conversation with myself by way of Google in my own code comments. 

    return (
        <audio
            ref={audioRef}
        //No props here, all handled via manual event listeners
        />
    );
};

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

    const {
        currentEpisode,
        isPlaying,
        playbackRate,
        playNextInQueue,
        markAsPlayed,
        queue
    } = usePlayerStore();

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
                // Use custom protocol for local files
                // We use the ID-based filename convention
                src = `local-media://${currentEpisode.id}.mp3`;
                isLocal = true;
            }

            console.log(`[AudioController] Loading source: ${isLocal ? 'LOCAL' : 'STREAM'} -> ${src}`);

            // Check if source is actually different (audio.src returns full URL)
            const needsReload = !audio.src || !audio.src.includes(src);

            if (needsReload) {
                console.log(`[AudioController] Source changed, loading new source`);

                // Get the saved playback position from store
                const savedTime = usePlayerStore.getState().currentTime;

                audio.src = src;

                // Wait for metadata to load before attempting playback or seeking
                await new Promise<void>((resolve) => {
                    const handleMetadata = () => {
                        console.log(`[AudioController] Metadata loaded. Duration: ${audio.duration}`);

                        // Restore playback position if we have one
                        if (savedTime > 0 && savedTime < audio.duration) {
                            audio.currentTime = savedTime;
                            console.log(`[AudioController] Restored playback position: ${savedTime}`);
                        }

                        audio.removeEventListener('loadedmetadata', handleMetadata);
                        resolve();
                    };

                    audio.addEventListener('loadedmetadata', handleMetadata);

                    // Also resolve on error to avoid hanging
                    audio.addEventListener('error', () => {
                        audio.removeEventListener('loadedmetadata', handleMetadata);
                        resolve();
                    }, { once: true });
                });

                // Now play if needed
                if (isPlaying) {
                    try {
                        await audio.play();
                    } catch (e) {
                        console.error("Playback failed", e);
                    }
                }
            } else {
                console.log(`[AudioController] Source unchanged, skipping reload`);
            }
        };

        loadSource();
    }, [currentEpisode]); // Removed isPlaying from dependencies

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

    // Get volume from store
    const { volume } = usePlayerStore();

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
    const { lastSeekTime, currentTime } = usePlayerStore();
    useEffect(() => {
        if (audioRef.current && Math.abs(audioRef.current.currentTime - currentTime) > 0.5) {
            // If user seeks manually, reset skipping state
            isSkippingRef.current = false;
            audioRef.current.currentTime = currentTime;
        }
    }, [lastSeekTime]);

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            const currentTime = audioRef.current.currentTime;
            usePlayerStore.setState({
                currentTime,
                duration: audioRef.current.duration || 0
            });

            // Auto-skip ads
            // CRITICAL: Get fresh episode data from PodcastStore to ensure we have latest ad segments
            // We need to access the store directly without async import inside the callback
            const podcastStore = usePodcastStore.getState();
            const freshEpisode = podcastStore.episodes[currentEpisode?.id || 0] || currentEpisode;

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
                        audioRef.current.pause();

                        // Play skip sound
                        skipAudioRef.current.currentTime = 0;
                        skipAudioRef.current.play().catch(e => console.error("Skip sound failed", e));

                        // When skip sound ends, seek and resume
                        skipAudioRef.current.onended = () => {
                            if (audioRef.current) {
                                const duration = audioRef.current.duration;
                                // Check if the ad ends at or after the episode end (within a small margin)
                                if (currentAd.endTimeSeconds >= duration - 1) {
                                    console.log('[AudioController] Ad ends at episode end, finishing episode');
                                    audioRef.current.currentTime = duration;
                                    isSkippingRef.current = false;
                                    handleEnded();
                                } else {
                                    audioRef.current.currentTime = currentAd.endTimeSeconds;
                                    isSkippingRef.current = false;
                                    if (isPlaying) {
                                        audioRef.current.play().catch(e => console.error("Resume failed", e));
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
            const now = Date.now();
            if (now - lastSavedTimeRef.current > 5000) {
                lastSavedTimeRef.current = now;
                usePlayerStore.getState().saveState().catch(err => {
                    console.error('[AudioController] Failed to save state:', err);
                });
            }
        }
    };

    const handleEnded = async () => {
        if (currentEpisode) {
            // Unload audio source to release file lock and prevent 404 errors
            // when the file is deleted by markAsPlayed
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.removeAttribute('src'); // Remove attribute entirely
                audioRef.current.load(); // Force reload to clear buffer
            }

            // Always mark as played
            await markAsPlayed(currentEpisode.id);

            // Check auto-play preference before playing next
            const prefs = await db.getPreferences();
            if (prefs.autoPlayNext) {
                playNextInQueue();
            }
        }
    };

    return (
        <audio
            ref={audioRef}
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleEnded}
        />
    );
};

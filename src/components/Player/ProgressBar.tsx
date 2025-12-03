import React, { useMemo } from 'react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { usePodcastStore } from '../../store/usePodcastStore';

export const ProgressBar: React.FC = () => {
    const currentTime = usePlayerStore(state => state.currentTime);
    const duration = usePlayerStore(state => state.duration);
    const seek = usePlayerStore(state => state.seek);
    const playerEpisode = usePlayerStore(state => state.currentEpisode);

    const adSegments = usePodcastStore(state =>
        playerEpisode ? state.episodes[playerEpisode.id]?.adSegments : null
    );

    const formatTime = (seconds: number): string => {
        if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '0:00';
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        if (hours > 0) {
            return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const formattedCurrentTime = useMemo(() => formatTime(currentTime), [currentTime]);
    const formattedDuration = useMemo(() => formatTime(duration), [duration]);
    const progressPercent = useMemo(() =>
        duration > 0 ? (currentTime / duration) * 100 : 0,
        [currentTime, duration]
    );

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        seek(Number(e.target.value));
    };

    if (!playerEpisode) return null;

    return (
        <div style={{ width: '100%', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                <span>{formattedCurrentTime}</span>
                <span style={{ color: '#666' }}>/</span>
                <span>{formattedDuration}</span>
            </div>

            <div style={{ position: 'relative', width: '100%', height: '8px', backgroundColor: '#333', borderRadius: '4px', cursor: 'pointer' }}>
                {adSegments?.length && duration > 0 ? (
                    <svg
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            borderRadius: '4px',
                            pointerEvents: 'none',
                            zIndex: 1
                        }}
                    >
                        {adSegments.map((seg, i) => (
                            <rect
                                key={i}
                                x={`${(seg.startTimeSeconds / duration) * 100}%`}
                                width={`${((seg.endTimeSeconds - seg.startTimeSeconds) / duration) * 100}%`}
                                height="100%"
                                fill="rgba(34, 197, 94, 0.6)"
                                rx="4"
                            >
                                <title>{seg.description}</title>
                            </rect>
                        ))}
                    </svg>
                ) : null}

                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        bottom: 0,
                        width: `${progressPercent}%`,
                        backgroundColor: 'var(--accent-color)',
                        borderRadius: '4px',
                        zIndex: 2,
                        pointerEvents: 'none'
                    }}
                />

                <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    value={currentTime}
                    onChange={handleSeek}
                    onInput={handleSeek}
                    style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        opacity: 0,
                        cursor: 'pointer',
                        zIndex: 3
                    }}
                />
            </div>
        </div>
    );
};

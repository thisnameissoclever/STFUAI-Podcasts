import React from 'react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { usePodcastStore } from '../../store/usePodcastStore';

export const ProgressBar: React.FC = () => {
    const { currentTime, duration, seek, currentEpisode: playerEpisode } = usePlayerStore();
    const { episodes } = usePodcastStore();

    const currentEpisode = playerEpisode ? (episodes[playerEpisode.id] || playerEpisode) : null;

    if (!currentEpisode) return null;

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        seek(Number(e.target.value));
    };

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

    return (
        <div style={{ width: '100%', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                <span>{formatTime(currentTime)}</span>
                <span style={{ color: '#666' }}>/</span>
                <span>{formatTime(duration)}</span>
            </div>

            <div style={{ position: 'relative', width: '100%', height: '8px', backgroundColor: '#333', borderRadius: '4px', cursor: 'pointer' }}>
                {/* Ad Segments Highlights */}
                {duration > 0 && currentEpisode.adSegments?.map((seg, i) => (
                    <div
                        key={i}
                        style={{
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            left: `${(seg.startTimeSeconds / duration) * 100}%`,
                            width: `${((seg.endTimeSeconds - seg.startTimeSeconds) / duration) * 100}%`,
                            backgroundColor: 'rgba(34, 197, 94, 0.6)',
                            borderRadius: '4px',
                            zIndex: 1
                        }}
                        title={`Ad: ${seg.description}`}
                    />
                ))}

                {/* Progress Fill */}
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        bottom: 0,
                        width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%',
                        backgroundColor: 'var(--accent-color)',
                        borderRadius: '4px',
                        zIndex: 2,
                        pointerEvents: 'none'
                    }}
                />

                {/* Input Range */}
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

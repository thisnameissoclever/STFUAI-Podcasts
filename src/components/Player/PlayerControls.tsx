import React from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, CheckCircle } from 'lucide-react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { db } from '../../services/db';
import './Player.css';

interface PlayerControlsProps {
    episodeId: number;
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({ episodeId }) => {
    const {
        isPlaying,
        pause,
        resume,
        skipForward,
        skipBackward,
        playbackRate,
        setPlaybackRate,
        markAsPlayed,
        volume,
        setVolume
    } = usePlayerStore();

    const togglePlay = () => {
        if (isPlaying) pause();
        else resume();
    };

    const handleVolumeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = Number(e.target.value) / 100;
        await setVolume(newVolume);
    };

    return (
        <>
            {/* Playback Controls - CENTERED */}
            <div className="playback-controls">
                <button onClick={skipBackward} className="control-btn-large">
                    <SkipBack size={40} />
                </button>
                <button onClick={togglePlay} className="play-btn-large">
                    {isPlaying ? <Pause size={48} fill="currentColor" /> : <Play size={48} fill="currentColor" />}
                </button>
                <button onClick={skipForward} className="control-btn-large">
                    <SkipForward size={40} />
                </button>
            </div>

            {/* Secondary Controls */}
            <div className="secondary-controls">
                <div className="speed-controls">
                    <span className="speed-label">Speed</span>
                    <select
                        value={playbackRate}
                        onChange={(e) => setPlaybackRate(Number(e.target.value))}
                        className="speed-select"
                    >
                        {[0.75, 0.9, 1, 1.1, 1.2, 1.25, 1.3, 1.5, 1.75, 2].map(rate => (
                            <option key={rate} value={rate}>{rate}x</option>
                        ))}
                    </select>
                </div>

                <div className="volume-container">
                    <Volume2 size={18} style={{ color: 'var(--text-secondary)' }} />
                    <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round(volume * 100)}
                        onChange={handleVolumeChange}
                        className="volume-slider"
                        style={{
                            background: `linear-gradient(to right, var(--accent-color) 0%, var(--accent-color) ${volume * 100}%, #444 ${volume * 100}%, #444 100%)`
                        }}
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', minWidth: '40px', textAlign: 'right' }}>{Math.round(volume * 100)}%</span>
                </div>

                <button
                    onClick={() => markAsPlayed(episodeId, true)}
                    className="mark-played-btn"
                >
                    <CheckCircle size={18} />
                    <span>Mark Played</span>
                </button>
            </div>
        </>
    );
};

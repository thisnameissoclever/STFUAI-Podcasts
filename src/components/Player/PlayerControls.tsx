import React from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, CheckCircle } from 'lucide-react';
import { usePlayerStore } from '../../store/usePlayerStore';
import './Player.css';

export const PlayerControls: React.FC = () => {
    // Select only what we need to avoid re-renders on currentTime updates
    // WARNING: Do NOT add currentTime here.
    const isPlaying = usePlayerStore(state => state.isPlaying);
    const playbackRate = usePlayerStore(state => state.playbackRate);
    const volume = usePlayerStore(state => state.volume);
    const currentEpisodeId = usePlayerStore(state => state.currentEpisode?.id);

    // Actions are stable
    const pause = usePlayerStore(state => state.pause);
    const resume = usePlayerStore(state => state.resume);
    const skipForward = usePlayerStore(state => state.skipForward);
    const skipBackward = usePlayerStore(state => state.skipBackward);
    const setPlaybackRate = usePlayerStore(state => state.setPlaybackRate);
    const setVolume = usePlayerStore(state => state.setVolume);
    const markAsPlayed = usePlayerStore(state => state.markAsPlayed);

    const togglePlay = () => {
        if (isPlaying) pause();
        else resume();
    };

    const handleVolumeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = Number(e.target.value) / 100;
        await setVolume(newVolume);
    };

    return (
        <div className="full-player-controls-wrapper">
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
                        className="speed-select"
                        value={playbackRate}
                        onChange={(e) => setPlaybackRate(Number(e.target.value))}
                    >
                        {[0.75, 0.9, 1, 1.1, 1.2, 1.25, 1.3, 1.5, 1.75, 2].map(rate => (
                            <option key={rate} value={rate}>{rate}x</option>
                        ))}
                    </select>
                </div>

                <div className="volume-control">
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
                    <span className="volume-value">{Math.round(volume * 100)}%</span>
                </div>

                <button
                    onClick={() => currentEpisodeId && markAsPlayed(currentEpisodeId, true)}
                    className="mark-played-btn"
                >
                    <CheckCircle size={18} />
                    <span>Mark Played</span>
                </button>
            </div>
        </div>
    );
};

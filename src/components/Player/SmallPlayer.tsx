import React from 'react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { Play, Pause, SkipForward, SkipBack } from 'lucide-react';

export const SmallPlayer: React.FC = () => {
    const { currentEpisode, isPlaying, pause, resume, skipForward, skipBackward, togglePlayer, volume, playbackError } = usePlayerStore();

    if (!currentEpisode) return null;

    const togglePlay = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isPlaying) pause();
        else resume();
    };

    const handleSkipBack = (e: React.MouseEvent) => {
        e.stopPropagation();
        skipBackward();
    };

    const handleSkipForward = (e: React.MouseEvent) => {
        e.stopPropagation();
        skipForward();
    };

    return (
        <div
            onClick={togglePlayer}
            className="small-player"
        >
            <div className="player-info">
                <div className="player-artwork">
                    {(currentEpisode.image || currentEpisode.feedImage) && (
                        <img src={currentEpisode.image || currentEpisode.feedImage} alt={currentEpisode.title} />
                    )}
                </div>
                <div className="player-text">
                    <div className="player-title">{currentEpisode.title}</div>
                    <div className="player-feed">{currentEpisode.feedTitle}</div>
                </div>
            </div>

            <div className="player-controls">
                {playbackError ? (
                    <button
                        className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs font-bold flex items-center gap-1"
                        onClick={(e) => {
                            e.stopPropagation();
                            usePlayerStore.getState().playNextInQueue();
                        }}
                    >
                        <SkipForward size={14} /> SKIP ERROR
                    </button>
                ) : (
                    <>
                        <button className="control-btn" onClick={handleSkipBack}>
                            <SkipBack size={20} />
                        </button>
                        <button
                            onClick={togglePlay}
                            className="play-btn"
                        >
                            {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                        </button>
                        <button onClick={handleSkipForward} className="control-btn">
                            <SkipForward size={20} />
                        </button>
                    </>
                )}
            </div>

            <div className="player-extra">
                <span className="text-xs text-gray-400">{Math.round(volume * 100)}%</span>
            </div>
        </div>
    );
};

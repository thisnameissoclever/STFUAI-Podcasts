import React, { useState } from 'react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { usePodcastStore } from '../../store/usePodcastStore';
import { ChevronDown, ListMusic, X } from 'lucide-react';
import { QueueList } from '../QueueList';
import { ProgressBar } from './ProgressBar';
import { PlayerControls } from './PlayerControls';
import { TranscriptView } from './TranscriptView';
import { AdSegments } from './AdSegments';
import { EpisodeInfo } from './EpisodeInfo';
import './Player.css';

interface FullPlayerProps {
    onClose: () => void;
}

export const FullPlayer: React.FC<FullPlayerProps> = ({ onClose }) => {
    const { currentEpisode: playerEpisode } = usePlayerStore();
    const { episodes } = usePodcastStore();
    const [showQueue, setShowQueue] = useState(false);

    const currentEpisode = playerEpisode ? (episodes[playerEpisode.id] || playerEpisode) : null;

    if (!currentEpisode) return null;

    return (
        <div className="full-player">
            {/* Header */}
            <div className="full-player-header">
                <button onClick={onClose} className="icon-btn">
                    <ChevronDown size={32} />
                </button>
                <div className="header-title">Now Playing</div>
                <button onClick={() => setShowQueue(!showQueue)} className="icon-btn">
                    <ListMusic size={28} />
                </button>
            </div>

            {/* Content - Using Custom Layout */}
            <div className="player-content-scroll">
                <div className="player-container">

                    <EpisodeInfo episode={currentEpisode} />

                    {/* Controls Wrapper */}
                    <div className="full-player-controls-wrapper">

                        {/* Progress Bar */}
                        <ProgressBar />

                        <PlayerControls episodeId={currentEpisode.id} />

                        {/* Transcript & Ads */}
                        {(currentEpisode.transcript || currentEpisode.isDownloaded) && (
                            <div className="transcript-grid">
                                <AdSegments episode={currentEpisode} />
                                <TranscriptView episode={currentEpisode} />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Queue Overlay */}
            {showQueue && (
                <div className="queue-overlay">
                    <div className="queue-container">
                        <div className="queue-header">
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Up Next</h3>
                            <button onClick={() => setShowQueue(false)} className="icon-btn">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="queue-content">
                            <QueueList />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

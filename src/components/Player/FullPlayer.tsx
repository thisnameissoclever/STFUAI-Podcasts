import React, { useState } from 'react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { usePodcastStore } from '../../store/usePodcastStore';
import { ChevronDown, ListMusic, X } from 'lucide-react';
import { QueueList } from '../QueueList';
import { ProgressBar } from './ProgressBar';
import { PlayerControls } from './PlayerControls';
import { EpisodeInfo } from './EpisodeInfo';
import { AdSegments } from './AdSegments';
import { TranscriptView } from './TranscriptView';
import './Player.css';

interface FullPlayerProps {
    onClose: () => void;
}

export const FullPlayer: React.FC<FullPlayerProps> = ({ onClose }) => {
    // Only subscribe to what we need for the layout/modal state
    // WARNING: We DO NOT subscribe to currentTime here to avoid re-renders on every second.
    // Only components that strictly need it (like ProgressBar) should subscribe to it.
    const playerEpisodeId = usePlayerStore(state => state.currentEpisode?.id);
    const episodes = usePodcastStore(state => state.episodes);

    const [showQueue, setShowQueue] = useState(false);

    // Derive current episode from ID
    const currentEpisode = playerEpisodeId ? episodes[playerEpisodeId] : null;

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

            {/* Content */}
            <div className="full-player-content">
                <div className="full-player-inner">

                    {/* Artwork & Info Section */}
                    <EpisodeInfo episode={currentEpisode} />

                    {/* Controls Wrapper */}
                    <div className="full-player-controls-wrapper">

                        {/* Progress Bar - Subscribes to currentTime internally */}
                        <ProgressBar />

                        {/* Playback Controls */}
                        <PlayerControls />

                        {/* Transcript & Ads */}
                        {(currentEpisode.transcript || currentEpisode.isDownloaded) && (
                            <div className="content-grid">
                                {/* Skippable Segments */}
                                <div style={{ gridColumn: '1' }}>
                                    <AdSegments episode={currentEpisode} />
                                </div>

                                <div style={{ gridColumn: '1' }}>
                                    {/* Transcript */}
                                    <TranscriptView episode={currentEpisode} />
                                </div>
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
                            <h3 className="queue-title">Up Next</h3>
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

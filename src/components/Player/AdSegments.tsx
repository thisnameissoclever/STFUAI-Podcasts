import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { usePodcastStore } from '../../store/usePodcastStore';
import type { Episode } from '../../types';
import './Player.css';

interface AdSegmentsProps {
    episode: Episode;
}

export const AdSegments: React.FC<AdSegmentsProps> = React.memo(({ episode }) => {
    // Use selectors to prevent re-renders on unrelated store updates
    const detectAds = usePodcastStore(state => state.detectAds);
    const [isDetectingAds, setIsDetectingAds] = useState(false);

    const handleDetectAds = async () => {
        setIsDetectingAds(true);
        try {
            await detectAds(episode.id);
        } catch (error) {
            console.error("Ad detection failed:", error);
        }
        setIsDetectingAds(false);
    };

    return (
        <div style={{ gridColumn: '1' }}>
            <div className="header-with-action">
                <h3 className="section-title">Skippable Segments</h3>
                <button
                    onClick={handleDetectAds}
                    disabled={isDetectingAds || !episode.transcript}
                    title="Analyze the transcript with AI to identify ads and other skippable segments"
                    className="action-btn"
                >
                    <Sparkles size={14} />
                    {isDetectingAds ? 'Analyzing...' : (episode.adDetectionType === 'advanced' ? 'Re-analyze' : 'Analyze')}
                </button>
            </div>

            <div className="segments-list">
                {episode.adSegments && episode.adSegments.length > 0 ? (
                    episode.adSegments.map((seg, i) => (
                        <div key={i} className="segment-card">
                            <div className="segment-header">
                                <span className="segment-type">{seg.type}</span>
                                <span className="segment-confidence">{seg.confidence}% Match</span>
                            </div>
                            <div className="segment-time">
                                <span className="time-badge">{seg.startTime}</span>
                                <span style={{ color: '#666', fontSize: '0.75rem' }}>➜</span>
                                <span className="time-badge">{seg.endTime}</span>
                            </div>
                            <p className="segment-desc">{seg.description}</p>
                        </div>
                    ))
                ) : (
                    <div className="empty-state">
                        <p className="empty-text">
                            {episode.transcript
                                ? (episode.adSegments ? 'No segments detected in this episode.' : 'Run detection to find skippable segments.')
                                : 'Transcription required for segment detection.'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
});

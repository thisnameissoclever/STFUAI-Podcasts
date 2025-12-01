import React, { useState } from 'react';
import type { Episode } from '../../types';
import './Player.css';

interface EpisodeInfoProps {
    episode: Episode;
}

export const EpisodeInfo: React.FC<EpisodeInfoProps> = ({ episode }) => {
    const [descExpanded, setDescExpanded] = useState(false);

    return (
        <>
            {/* Artwork & Info Section */}
            <div className="full-player-info">
                <div className="artwork-large">
                    {episode.image || episode.feedImage ? (
                        <img src={episode.image || episode.feedImage} alt={episode.title} />
                    ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>No Artwork</div>
                    )}
                </div>
                <h2 className="episode-title-large">{episode.title}</h2>
                <p className="feed-title-large">{episode.feedTitle}</p>
            </div>

            {/* Description */}
            {episode.description && (
                <div className="description-container">
                    <h3 className="section-header">Description</h3>
                    <div
                        className="description-text"
                        style={{ maxHeight: descExpanded ? 'none' : '150px' }}
                        dangerouslySetInnerHTML={{ __html: episode.description }}
                    />
                    {episode.description.length > 300 && (
                        <button
                            onClick={() => setDescExpanded(!descExpanded)}
                            className="show-more-btn"
                        >
                            {descExpanded ? 'Show less' : 'Show more'}
                        </button>
                    )}
                </div>
            )}
        </>
    );
};

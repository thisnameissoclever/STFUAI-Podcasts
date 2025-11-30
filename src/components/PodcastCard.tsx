import React from 'react';
import type { Podcast } from '../types';

interface PodcastCardProps {
    podcast: Podcast;
    onClick: () => void;
}

export const PodcastCard: React.FC<PodcastCardProps> = ({ podcast, onClick }) => {
    return (
        <div
            className="podcast-card group"
            onClick={onClick}
        >
            <div className="card-image-container">
                {podcast.image ? (
                    <img
                        src={podcast.image}
                        alt={podcast.title}
                        className="card-image"
                        loading="lazy"
                    />
                ) : (
                    <div className="card-image-placeholder">
                        No Image
                    </div>
                )}
            </div>
            <h3 className="card-title" title={podcast.title}>{podcast.title}</h3>
            <p className="card-author" title={podcast.author}>{podcast.author}</p>
        </div>
    );
};

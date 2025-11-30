import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { Podcast } from '../types';
import { PodcastCard } from '../components/PodcastCard';
import { useNavigate } from 'react-router-dom';
import { Loader } from 'lucide-react';

export const Discover: React.FC = () => {
    const [trending, setTrending] = useState<Podcast[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchTrending = async () => {
            try {
                const data = await api.trending();
                if (data && data.feeds) {
                    setTrending(data.feeds);
                }
            } catch (error) {
                console.error('Failed to fetch trending podcasts:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchTrending();
    }, []);

    if (loading) {
        return (
            <div className="page-container">
                <h2 className="page-title">Discover</h2>
                <div className="flex justify-center py-12">
                    <Loader className="animate-spin text-accent-color" size={32} />
                </div>
            </div>
        );
    }

    return (
        <div className="page-container">
            <h2 className="page-title">Discover</h2>
            <div className="podcast-grid">
                {trending.map((podcast) => (
                    <PodcastCard
                        key={podcast.id}
                        podcast={podcast}
                        onClick={() => navigate(`/podcast/${podcast.id}`)}
                    />
                ))}
            </div>
        </div>
    );
};

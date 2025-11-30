import React, { useEffect } from 'react';
import { usePodcastStore } from '../store/usePodcastStore';
import { PodcastCard } from '../components/PodcastCard';
import { useNavigate } from 'react-router-dom';
import { Loader } from 'lucide-react';

export const Library: React.FC = () => {
    const { subscriptions, loadSubscriptions, loading } = usePodcastStore();
    const navigate = useNavigate();
    const subsList = Object.values(subscriptions);

    useEffect(() => {
        loadSubscriptions();
    }, [loadSubscriptions]);

    if (loading && subsList.length === 0) {
        return (
            <div className="flex justify-center py-20">
                <Loader className="animate-spin text-accent-color" size={32} />
            </div>
        );
    }

    return (
        <div>
            <h2 className="text-2xl font-bold text-white mb-6">Your Subscriptions</h2>

            {subsList.length === 0 ? (
                <div className="text-center py-20">
                    <p className="text-gray-400 mb-4">You haven't subscribed to any podcasts yet.</p>
                    <button
                        onClick={() => navigate('/search')}
                        className="bg-accent-color text-black font-medium px-6 py-2 rounded-full hover:bg-accent-hover transition-colors"
                    >
                        Find Podcasts
                    </button>
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: '24px'
                }}>
                    {subsList.map((podcast) => (
                        <PodcastCard
                            key={podcast.id}
                            podcast={podcast}
                            onClick={() => navigate(`/podcast/${podcast.id}`)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

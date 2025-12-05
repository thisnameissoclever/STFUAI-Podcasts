import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../services/api';
import type { Podcast, Episode } from '../types';
import { usePodcastStore } from '../store/usePodcastStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { Play, Plus, Check, FileText, CheckCircle, PlusCircle, MinusCircle, Loader2 } from 'lucide-react';
import clsx from 'clsx';

export const PodcastDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [podcast, setPodcast] = useState<Podcast | null>(null);
    const [episodes, setEpisodes] = useState<Episode[]>([]);
    const [loading, setLoading] = useState(true);

    const { isSubscribed, subscribe, unsubscribe, loadEpisodes, isDownloaded, isDownloading, transcribeEpisode, getTranscriptionStatus, subscriptions, toggleAutoAddToQueue, cancelDownload, deleteEpisodeFile } = usePodcastStore();
    const { play, addToQueue } = usePlayerStore();
    const subscribed = id ? isSubscribed(Number(id)) : false;

    useEffect(() => {
        // Load downloaded episodes from DB on mount
        loadEpisodes();
    }, [loadEpisodes]);

    useEffect(() => {
        const loadData = async () => {
            if (!id) return;
            setLoading(true);
            try {
                const feedId = Number(id);
                const [podData, epsData] = await Promise.all([
                    api.getPodcastByFeedId(feedId),
                    api.getEpisodesByFeedId(feedId, 50) // Get last 50 episodes
                ]);

                if (podData && podData.feed) {
                    setPodcast(podData.feed);
                }
                if (epsData && epsData.items) {
                    // Enrich episodes with feed data if missing
                    const enrichedEpisodes = epsData.items.map((ep: Episode) => ({
                        ...ep,
                        feedTitle: ep.feedTitle || (podData?.feed?.title ?? ''),
                        feedImage: ep.feedImage || (podData?.feed?.image ?? '')
                    }));
                    setEpisodes(enrichedEpisodes);
                }
            } catch (error) {
                console.error('Failed to load podcast:', error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [id]);

    const handleSubscribe = async () => {
        if (!podcast) return;
        if (subscribed) {
            await unsubscribe(podcast.id);
        } else {
            await subscribe(podcast);
        }
    };

    if (loading) {
        return <div className="loading-state">Loading...</div>;
    }

    if (!podcast) {
        return <div className="error-state">Podcast not found</div>;
    }

    return (
        <div className="podcast-detail-container" style={{ paddingTop: '2.5rem' }}>
            {/* Header */}
            <div className="podcast-header">
                <div className="podcast-cover-large">
                    <img src={podcast.image} alt={podcast.title} />
                </div>
                <div className="podcast-header-info">
                    <h1 className="podcast-title-hero">{podcast.title}</h1>
                    <p className="podcast-author-hero">{podcast.author}</p>
                    <div className="podcast-actions" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <button
                            onClick={handleSubscribe}
                            className={clsx(
                                "subscribe-btn",
                                subscribed ? "subscribed" : "not-subscribed"
                            )}
                        >
                            {subscribed ? <><Check size={20} /> Subscribed</> : <><Plus size={20} /> Subscribe</>}
                        </button>

                        {subscribed && (
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', userSelect: 'none', backgroundColor: 'rgba(255,255,255,0.1)', padding: '0.5rem 1rem', borderRadius: '9999px' }}>
                                <input
                                    type="checkbox"
                                    checked={subscriptions[Number(id)]?.autoAddToQueue ?? true}
                                    onChange={() => toggleAutoAddToQueue(Number(id))}
                                    style={{ accentColor: 'var(--accent-color)', width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
                                />
                                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>Auto-add to Queue</span>
                            </label>
                        )}
                    </div>
                </div>
            </div>

            {/* Description */}
            <div className="podcast-description" dangerouslySetInnerHTML={{ __html: podcast.description }} />

            {/* Episodes */}
            <div className="episodes-section">
                <h2 className="section-title">Episodes</h2>
                <div className="episodes-list">
                    {episodes.map((ep) => (
                        <div key={ep.id} className={clsx("episode-item group", ep.isPlayed && "opacity-60")}>
                            <div className="episode-content">
                                <div className="episode-main">
                                    <div className="episode-date" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span>{new Date(ep.datePublished * 1000).toLocaleDateString()}</span>
                                        {ep.isPlayed && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#22c55e', fontSize: '0.75rem', fontWeight: 600 }}>
                                                <CheckCircle size={14} /> Played
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="episode-title">
                                        {ep.title}
                                    </h3>
                                    <div className="episode-description" dangerouslySetInnerHTML={{ __html: ep.description }} />

                                    <div className="episode-actions">
                                        <button
                                            onClick={() => play(ep)}
                                            disabled={isDownloading(ep.id)}
                                            className={clsx("episode-action-btn play", usePlayerStore.getState().currentEpisode?.id === ep.id && "playing")}
                                            style={usePlayerStore.getState().currentEpisode?.id === ep.id ? { color: '#22c55e', borderColor: '#22c55e' } : {}}
                                        >
                                            {isDownloading(ep.id) ? (
                                                <>
                                                    <Loader2 size={16} className="animate-spin" /> Downloading...
                                                </>
                                            ) : (
                                                <>
                                                    <Play size={16} fill={usePlayerStore.getState().currentEpisode?.id === ep.id ? "#22c55e" : "currentColor"} /> Play
                                                </>
                                            )}
                                        </button>
                                        <button
                                            onClick={async () => {
                                                const isInQueue = usePlayerStore.getState().queue.some(q => q.id === ep.id);
                                                if (isInQueue) {
                                                    // Remove from queue, cancel download, delete file
                                                    usePlayerStore.getState().removeFromQueue(ep.id);
                                                    await cancelDownload(ep.id);
                                                    await deleteEpisodeFile(ep.id);
                                                } else {
                                                    addToQueue(ep);
                                                }
                                            }}
                                            className={clsx("episode-action-btn queue", usePlayerStore.getState().queue.some(q => q.id === ep.id) ? "in-queue" : "")}
                                            title={usePlayerStore.getState().queue.some(q => q.id === ep.id) ? "Remove from Queue" : "Add to Queue"}
                                        >
                                            {usePlayerStore.getState().queue.some(q => q.id === ep.id) ? (
                                                <MinusCircle size={16} />
                                            ) : (
                                                <PlusCircle size={16} />
                                            )}
                                            {usePlayerStore.getState().queue.some(q => q.id === ep.id) ? "Remove" : "Queue"}
                                        </button>

                                        {isDownloaded(ep.id) && (
                                            <button
                                                onClick={() => transcribeEpisode(ep.id)}
                                                className="episode-action-btn transcribe"
                                                disabled={getTranscriptionStatus(ep.id) === 'processing' || getTranscriptionStatus(ep.id) === 'completed'}
                                            >
                                                {getTranscriptionStatus(ep.id) === 'processing' ? (
                                                    <>
                                                        <div className="animate-spin">⏳</div> Transcribing...
                                                    </>
                                                ) : getTranscriptionStatus(ep.id) === 'completed' ? (
                                                    <>
                                                        <Check size={16} /> Transcribed
                                                    </>
                                                ) : getTranscriptionStatus(ep.id) === 'failed' ? (
                                                    <>
                                                        <FileText size={16} /> Retry
                                                    </>
                                                ) : (
                                                    <>
                                                        <FileText size={16} /> Transcribe
                                                    </>
                                                )}
                                            </button>
                                        )}
                                        <span className="episode-duration">
                                            {Math.floor(ep.duration / 60)} min
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

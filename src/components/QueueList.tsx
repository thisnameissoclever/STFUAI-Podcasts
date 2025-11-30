import React from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { usePodcastStore } from '../store/usePodcastStore';
import { Play, X, GripVertical, Check, ScanSearch } from 'lucide-react';

export const QueueList: React.FC = () => {
    const { queue, play, removeFromQueue, reorderQueue, markAsPlayed } = usePlayerStore();
    const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);

    if (queue.length === 0) {
        return <div className="text-gray-500 text-center py-8">Queue is empty</div>;
    }

    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        // Set transparent image or custom drag image if needed
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === index) return;

        // Optional: add visual indicator of drop target
    };

    const handleDrop = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedIndex !== null && draggedIndex !== index) {
            reorderQueue(draggedIndex, index);
        }
        setDraggedIndex(null);
    };

    return (
        <div className="queue-list">
            {queue.map((ep, index) => (
                <div
                    key={ep.id}
                    className={`queue-item group ${draggedIndex === index ? 'opacity-50' : ''}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={(e) => handleDrop(e, index)}
                >
                    <div className="queue-drag-handle cursor-grab active:cursor-grabbing">
                        <GripVertical size={16} />
                    </div>
                    <div className="queue-artwork">
                        {(ep.image || ep.feedImage) && <img src={ep.image || ep.feedImage} alt={ep.title} />}
                    </div>
                    <div className="queue-info">
                        <div className="queue-item-title">{ep.title}</div>
                        <div className="queue-item-feed">{ep.feedTitle}</div>
                    </div>
                    <div className="queue-actions">
                        <button
                            onClick={() => play(ep)}
                            className="queue-action-btn play"
                            title="Play Now"
                        >
                            <Play size={16} fill="currentColor" />
                        </button>
                        <button
                            onClick={() => markAsPlayed(ep.id)}
                            className="queue-action-btn check"
                            title="Mark as Played"
                        >
                            <Check size={16} />
                        </button>
                        <button
                            onClick={() => {
                                const episode = usePodcastStore.getState().episodes[ep.id];
                                if (episode?.transcript) {
                                    usePodcastStore.getState().detectAds(ep.id);
                                }
                            }}
                            className="queue-action-btn detect"
                            title={usePodcastStore.getState().episodes[ep.id]?.adSegments ? "Re-detect Segments" : "Detect Segments"}
                            disabled={!usePodcastStore.getState().episodes[ep.id]?.transcript}
                            style={{
                                opacity: usePodcastStore.getState().episodes[ep.id]?.transcript ? 1 : 0.5,
                                color: usePodcastStore.getState().episodes[ep.id]?.adSegments ? 'var(--accent-color)' : 'inherit'
                            }}
                        >
                            <ScanSearch size={16} />
                        </button>
                        <button
                            onClick={() => removeFromQueue(ep.id)}
                            className="queue-action-btn remove"
                            title="Remove from Queue"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

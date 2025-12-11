import React, { useState } from 'react';
import { usePodcastStore } from '../../store/usePodcastStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import type { Episode } from '../../types';
import './Player.css';

interface TranscriptViewProps {
    episode: Episode;
}

export const TranscriptView: React.FC<TranscriptViewProps> = React.memo(({ episode }) => {
    // Use selectors to prevent re-renders on unrelated store updates
    const seek = usePlayerStore(state => state.seek);
    const transcribeEpisode = usePodcastStore(state => state.transcribeEpisode);
    const [showRawJson, setShowRawJson] = useState(false);

    const formatTime = (seconds: number): string => {
        if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '0:00';
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        if (hours > 0) {
            return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div style={{ gridColumn: '1', marginTop: '2rem' }}>
            <div className="header-with-action">
                <h3 className="section-title">Transcript</h3>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {episode.transcript?.rawVerboseJson && (
                        <button
                            onClick={() => setShowRawJson(true)}
                            className="action-btn"
                            style={{ fontSize: '0.75rem', padding: '4px 8px', opacity: 0.8 }}
                        >
                            Advanced
                        </button>
                    )}
                    {episode.transcript && (
                        <button
                            onClick={async () => {
                                await transcribeEpisode(episode.id, true);
                            }}
                            className="action-btn"
                        >
                            Re-transcribe
                        </button>
                    )}
                </div>
            </div>
            <div className="transcript-container">
                {episode.transcriptionStatus === 'processing' ? (
                    <div className="loading-state">
                        <div className="animate-spin" style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
                        <p>Transcribing episode...</p>
                        <p style={{ fontSize: '0.875rem', opacity: 0.7 }}>This may take a moment.</p>
                    </div>
                ) : episode.transcript ? (
                    episode.transcript.segments.map((segment) => (
                        <div key={segment.id} className="transcript-segment">
                            <span
                                onClick={() => seek(segment.start)}
                                className="transcript-time"
                            >
                                {formatTime(segment.start)}
                            </span>
                            <p className="transcript-text">
                                {segment.speaker && (
                                    <span className="speaker-label">
                                        {segment.speaker}
                                    </span>
                                )}
                                {segment.words && segment.words.length > 0 ? (
                                    segment.words.map((word, wIndex) => (
                                        <span
                                            key={wIndex}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                seek(word.startTime);
                                            }}
                                            className="transcript-word"
                                            title={`Jump to ${formatTime(word.startTime)}`}
                                        >
                                            {word.word}
                                        </span>
                                    ))
                                ) : (
                                    segment.text
                                )}
                            </p>
                        </div>
                    ))
                ) : (
                    <div className="loading-state">
                        <p style={{ marginBottom: '1rem' }}>No transcript available yet.</p>
                        {episode.transcriptionStatus === 'failed' && (
                            <p style={{ color: '#ef4444', marginBottom: '1rem' }}>Transcription failed.</p>
                        )}
                        <button
                            onClick={() => transcribeEpisode(episode.id)}
                            className="mark-played-btn"
                        >
                            {episode.transcriptionStatus === 'failed' ? 'Retry Transcription' : 'Start Transcription'}
                        </button>
                    </div>
                )}
            </div>

            {/* Raw JSON Modal */}
            {showRawJson && episode.transcript?.rawVerboseJson && (
                <div 
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                        padding: '20px'
                    }}
                    onClick={() => setShowRawJson(false)}
                >
                    <div 
                        style={{
                            backgroundColor: '#1a1a1a',
                            borderRadius: '8px',
                            maxWidth: '900px',
                            width: '100%',
                            maxHeight: '80vh',
                            display: 'flex',
                            flexDirection: 'column',
                            border: '1px solid #333'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{
                            padding: '16px',
                            borderBottom: '1px solid #333',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <h3 style={{ margin: 0 }}>Raw Transcript Data (verbose_json)</h3>
                            <button
                                onClick={() => setShowRawJson(false)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#fff',
                                    fontSize: '24px',
                                    cursor: 'pointer',
                                    padding: '0 8px'
                                }}
                            >
                                ✕
                            </button>
                        </div>
                        <div style={{ padding: '16px', overflowY: 'auto' }}>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(episode.transcript!.rawVerboseJson!);
                                    alert('Copied to clipboard!');
                                }}
                                style={{
                                    marginBottom: '12px',
                                    padding: '8px 16px',
                                    backgroundColor: '#444',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                            >
                                Copy to Clipboard
                            </button>
                            <pre style={{
                                overflow: 'auto',
                                backgroundColor: '#0a0a0a',
                                padding: '12px',
                                borderRadius: '4px',
                                fontSize: '12px',
                                lineHeight: '1.5',
                                margin: 0
                            }}>
                                {JSON.stringify(JSON.parse(episode.transcript.rawVerboseJson), null, 2)}
                            </pre>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});

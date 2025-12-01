import React from 'react';
import { usePodcastStore } from '../../store/usePodcastStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import type { Episode } from '../../types';
import './Player.css';

interface TranscriptViewProps {
    episode: Episode;
}

export const TranscriptView: React.FC<TranscriptViewProps> = ({ episode }) => {
    const transcribeEpisode = usePodcastStore(state => state.transcribeEpisode);
    const seek = usePlayerStore(state => state.seek);

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
        <div style={{ marginTop: '2rem' }}>
            <div className="section-header-row">
                <h3 className="section-title">Transcript</h3>
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
            <div className="transcript-container">
                {episode.transcriptionStatus === 'processing' ? (
                    <div className="transcript-loading">
                        <div className="animate-spin" style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
                        <p>Transcribing episode...</p>
                        <p style={{ fontSize: '0.875rem', opacity: 0.7 }}>This may take a moment.</p>
                    </div>
                ) : episode.transcript ? (
                    episode.transcript.segments.map((segment) => (
                        <div key={segment.id} className="transcript-row">
                            <span
                                onClick={() => seek(segment.start)}
                                className="transcript-time"
                            >
                                {formatTime(segment.start)}
                            </span>
                            <p className="transcript-content">
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
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                        <p style={{ marginBottom: '1rem' }}>No transcript available yet.</p>
                        {episode.transcriptionStatus === 'failed' && (
                            <p className="transcript-error">Transcription failed.</p>
                        )}
                        <button
                            onClick={() => transcribeEpisode(episode.id)}
                            className="retry-btn"
                        >
                            {episode.transcriptionStatus === 'failed' ? 'Retry Transcription' : 'Start Transcription'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

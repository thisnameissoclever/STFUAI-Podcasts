import React, { useState } from 'react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { usePodcastStore } from '../../store/usePodcastStore';
import { Play, Pause, SkipForward, SkipBack, ChevronDown, ListMusic, CheckCircle, X, Volume2, Sparkles } from 'lucide-react';
import { QueueList } from '../QueueList';
import { ProgressBar } from './ProgressBar';

interface FullPlayerProps {
    onClose: () => void;
}

export const FullPlayer: React.FC<FullPlayerProps> = ({ onClose }) => {
    const { currentEpisode: playerEpisode, isPlaying, pause, resume, skipForward, skipBackward, playbackRate, setPlaybackRate, markAsPlayed, seek, volume, setVolume } = usePlayerStore();
    const { episodes, detectAds } = usePodcastStore();
    const [descExpanded, setDescExpanded] = useState(false);
    const [showQueue, setShowQueue] = useState(false);
    const [isDetectingAds, setIsDetectingAds] = useState(false);

    const currentEpisode = playerEpisode ? (episodes[playerEpisode.id] || playerEpisode) : null;

    if (!currentEpisode) return null;

    const togglePlay = () => {
        if (isPlaying) pause();
        else resume();
    };

    const handleDetectAds = async () => {
        if (!currentEpisode) return;
        setIsDetectingAds(true);
        try {
            await detectAds(currentEpisode.id);
        } catch (error) {
            console.error("Ad detection failed:", error);
        }
        setIsDetectingAds(false);
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        seek(Number(e.target.value));
    };

    const handleVolumeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = Number(e.target.value) / 100;
        await setVolume(newVolume);
    };

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

            {/* Content - Using Custom Layout */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '2rem', width: '100%' }}>
                <div style={{ maxWidth: '1400px', margin: '0 auto', width: '100%' }}>

                    {/* Artwork & Info Section */}
                    <div className="full-player-info">
                        <div className="artwork-large">
                            {currentEpisode.image || currentEpisode.feedImage ? (
                                <img src={currentEpisode.image || currentEpisode.feedImage} alt={currentEpisode.title} />
                            ) : (
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>No Artwork</div>
                            )}
                        </div>
                        <h2 className="episode-title-large">{currentEpisode.title}</h2>
                        <p className="feed-title-large">{currentEpisode.feedTitle}</p>
                    </div>

                    {/* Controls Wrapper */}
                    <div className="full-player-controls-wrapper" style={{ maxWidth: 'none', width: '100%' }}>

                        {/* Progress Bar */}
                        <ProgressBar />

                        {/* Playback Controls - CENTERED */}
                        <div className="playback-controls" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2rem', marginBottom: '2rem' }}>
                            <button onClick={skipBackward} className="control-btn-large">
                                <SkipBack size={40} />
                            </button>
                            <button onClick={togglePlay} className="play-btn-large">
                                {isPlaying ? <Pause size={48} fill="currentColor" /> : <Play size={48} fill="currentColor" />}
                            </button>
                            <button onClick={skipForward} className="control-btn-large">
                                <SkipForward size={40} />
                            </button>
                        </div>

                        {/* Secondary Controls */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '2rem', backgroundColor: 'rgba(255,255,255,0.05)', padding: '1.25rem', borderRadius: '0.75rem' }}>
                            <div className="speed-controls">
                                <span className="speed-label">Speed</span>
                                <select
                                    value={playbackRate}
                                    onChange={(e) => setPlaybackRate(Number(e.target.value))}
                                    style={{ backgroundColor: '#222', color: '#fff', border: '1px solid #444', borderRadius: '0.375rem', padding: '0.375rem 0.75rem', fontSize: '0.875rem', outline: 'none', cursor: 'pointer' }}
                                >
                                    {[0.75, 0.9, 1, 1.1, 1.2, 1.25, 1.3, 1.5, 1.75, 2].map(rate => (
                                        <option key={rate} value={rate}>{rate}x</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, maxWidth: '200px' }}>
                                <Volume2 size={18} style={{ color: 'var(--text-secondary)' }} />
                                <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    value={Math.round(volume * 100)}
                                    onChange={handleVolumeChange}
                                    style={{
                                        flex: 1,
                                        height: '4px',
                                        borderRadius: '2px',
                                        appearance: 'none',
                                        cursor: 'pointer',
                                        background: `linear-gradient(to right, var(--accent-color) 0%, var(--accent-color) ${volume * 100}%, #444 ${volume * 100}%, #444 100%)`
                                    }}
                                />
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', minWidth: '40px', textAlign: 'right' }}>{Math.round(volume * 100)}%</span>
                            </div>

                            <button
                                onClick={() => markAsPlayed(currentEpisode.id, true)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.625rem 1rem',
                                    backgroundColor: 'var(--accent-color)',
                                    color: '#000',
                                    border: 'none',
                                    borderRadius: '0.5rem',
                                    fontWeight: 600,
                                    fontSize: '0.875rem',
                                    cursor: 'pointer',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                }}
                            >
                                <CheckCircle size={18} />
                                <span>Mark Played</span>
                            </button>
                        </div>

                        {/* Description */}
                        {currentEpisode.description && (
                            <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '0.75rem', marginBottom: '2rem' }}>
                                <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>Description</h3>
                                <div
                                    style={{
                                        color: 'var(--text-secondary)',
                                        lineHeight: 1.6,
                                        fontSize: '0.9375rem',
                                        maxHeight: descExpanded ? 'none' : '150px',
                                        overflow: 'hidden'
                                    }}
                                    dangerouslySetInnerHTML={{ __html: currentEpisode.description }}
                                />
                                {currentEpisode.description.length > 300 && (
                                    <button
                                        onClick={() => setDescExpanded(!descExpanded)}
                                        style={{
                                            marginTop: '0.75rem',
                                            color: 'var(--accent-color)',
                                            fontSize: '0.875rem',
                                            fontWeight: 500,
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            textDecoration: 'underline'
                                        }}
                                    >
                                        {descExpanded ? 'Show less' : 'Show more'}
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Transcript & Ads */}
                        {/* Transcript & Ads */}
                        {(currentEpisode.transcript || currentEpisode.isDownloaded) && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', width: '100%' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
                                    {/* Skippable Segments */}
                                    <div style={{ gridColumn: '1' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Skippable Segments</h3>
                                            <button
                                                onClick={handleDetectAds}
                                                disabled={isDetectingAds || !currentEpisode.transcript}
                                                title="Analyze the transcript with AI to identify ads and other skippable segments"
                                                style={{
                                                    fontSize: '0.75rem',
                                                    fontWeight: 600,
                                                    padding: '0.5rem 1rem',
                                                    backgroundColor: 'rgba(30, 215, 96, 0.1)',
                                                    color: 'var(--accent-color)',
                                                    border: 'none',
                                                    borderRadius: '9999px',
                                                    cursor: (isDetectingAds || !currentEpisode.transcript) ? 'not-allowed' : 'pointer',
                                                    opacity: (isDetectingAds || !currentEpisode.transcript) ? 0.5 : 1,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.5rem'
                                                }}
                                            >
                                                <Sparkles size={14} />
                                                {isDetectingAds ? 'Analyzing...' : (currentEpisode.adDetectionType === 'advanced' ? 'Re-analyze' : 'Analyze')}
                                            </button>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                            {currentEpisode.adSegments && currentEpisode.adSegments.length > 0 ? (
                                                currentEpisode.adSegments.map((seg, i) => (
                                                    <div key={i} style={{ backgroundColor: 'rgba(0,0,0,0.4)', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                                            <span style={{ fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0.25rem 0.5rem', backgroundColor: 'rgba(34, 197, 94, 0.2)', color: 'rgb(74, 222, 128)', borderRadius: '0.25rem' }}>{seg.type}</span>
                                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgb(34, 197, 94)', opacity: 0.7 }}>{seg.confidence}% Match</span>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', backgroundColor: 'rgba(0,0,0,0.3)', padding: '0.5rem', borderRadius: '0.5rem' }}>
                                                            <span style={{ color: 'var(--accent-color)', fontFamily: 'monospace', fontSize: '0.875rem', fontWeight: 700 }}>{seg.startTime}</span>
                                                            <span style={{ color: '#666', fontSize: '0.75rem' }}>➜</span>
                                                            <span style={{ color: 'var(--accent-color)', fontFamily: 'monospace', fontSize: '0.875rem', fontWeight: 700 }}>{seg.endTime}</span>
                                                        </div>
                                                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.5, margin: 0 }}>{seg.description}</p>
                                                    </div>
                                                ))
                                            ) : (
                                                <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '0.75rem', padding: '2rem', textAlign: 'center' }}>
                                                    <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic', margin: 0 }}>
                                                        {currentEpisode.transcript
                                                            ? (currentEpisode.adSegments ? 'No segments detected in this episode.' : 'Run detection to find skippable segments.')
                                                            : 'Transcription required for segment detection.'}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div style={{ gridColumn: '1', marginTop: '2rem' }}>
                                        {/* Transcript */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Transcript</h3>
                                            {currentEpisode.transcript && (
                                                <button
                                                    onClick={async () => {
                                                        if (!currentEpisode) return;
                                                        await usePodcastStore.getState().transcribeEpisode(currentEpisode.id, true);
                                                    }}
                                                    style={{
                                                        fontSize: '0.75rem',
                                                        fontWeight: 600,
                                                        padding: '0.5rem 1rem',
                                                        backgroundColor: 'rgba(30, 215, 96, 0.1)',
                                                        color: 'var(--accent-color)',
                                                        border: 'none',
                                                        borderRadius: '9999px',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    Re-transcribe
                                                </button>
                                            )}
                                        </div>
                                        <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '0.75rem', maxHeight: '500px', overflowY: 'auto', minHeight: '100px' }}>
                                            {currentEpisode.transcriptionStatus === 'processing' ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '2rem', color: 'var(--text-secondary)' }}>
                                                    <div className="animate-spin" style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
                                                    <p>Transcribing episode...</p>
                                                    <p style={{ fontSize: '0.875rem', opacity: 0.7 }}>This may take a moment.</p>
                                                </div>
                                            ) : currentEpisode.transcript ? (
                                                currentEpisode.transcript.segments.map((segment) => (
                                                    <div key={segment.id} style={{ display: 'flex', marginBottom: '0.5rem', padding: '0.5rem', borderRadius: '0.375rem' }} className="hover:bg-white/5">
                                                        <span
                                                            onClick={() => seek(segment.start)}
                                                            style={{ color: 'var(--accent-color)', fontFamily: 'monospace', fontSize: '0.875rem', fontWeight: 700, minWidth: '60px', paddingTop: '0.25rem', marginRight: '1rem', opacity: 0.7, cursor: 'pointer' }}
                                                        >
                                                            {formatTime(segment.start)}
                                                        </span>
                                                        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '0.9375rem', flex: 1, margin: 0 }}>
                                                            {segment.speaker && (
                                                                <span style={{ fontWeight: 700, color: 'var(--text-primary)', marginRight: '0.5rem', display: 'block', marginBottom: '0.25rem', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.8 }}>
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
                                                                        style={{ cursor: 'pointer', display: 'inline-block', marginRight: '4px' }}
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
                                                    {currentEpisode.transcriptionStatus === 'failed' && (
                                                        <p style={{ color: '#ef4444', marginBottom: '1rem' }}>Transcription failed.</p>
                                                    )}
                                                    <button
                                                        onClick={() => usePodcastStore.getState().transcribeEpisode(currentEpisode.id)}
                                                        style={{
                                                            padding: '0.5rem 1rem',
                                                            backgroundColor: 'var(--accent-color)',
                                                            color: '#000',
                                                            border: 'none',
                                                            borderRadius: '0.5rem',
                                                            fontWeight: 600,
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        {currentEpisode.transcriptionStatus === 'failed' ? 'Retry Transcription' : 'Start Transcription'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Queue Overlay */}
            {showQueue && (
                <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 50, padding: '2rem' }}>
                    <div style={{ maxWidth: '48rem', margin: '0 auto', height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Up Next</h3>
                            <button onClick={() => setShowQueue(false)} style={{ padding: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '9999px', color: 'var(--text-secondary)' }}>
                                <X size={24} />
                            </button>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            <QueueList />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

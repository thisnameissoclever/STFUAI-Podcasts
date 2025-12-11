import React from 'react';
import { ExternalLink, Play, SkipForward } from 'lucide-react';

export const Help: React.FC = () => {
    const scrollToSection = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    };

    return (
        <div className="page-container">
            <h1 className="page-title">Help & Documentation</h1>

            <div className="help-content" style={{ maxWidth: '800px' }}>
                {/* Table of Contents */}
                <div className="toc-container" style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    padding: '1.5rem',
                    borderRadius: '0.5rem',
                    marginBottom: '2rem'
                }}>
                    <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Table of Contents</h3>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <li>
                            <button onClick={() => scrollToSection('getting-started')} className="text-accent hover:underline" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--accent-color)' }}>
                                Getting Started
                            </button>
                        </li>
                        <li>
                            <button onClick={() => scrollToSection('configuration')} className="text-accent hover:underline" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--accent-color)' }}>
                                Configuration (API Keys)
                            </button>
                        </li>
                        <li>
                            <button onClick={() => scrollToSection('using-player')} className="text-accent hover:underline" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--accent-color)' }}>
                                Using the Player
                            </button>
                        </li>
                        <li style={{ marginLeft: '1rem' }}>
                            <button onClick={() => scrollToSection('using-player')} className="text-accent hover:underline" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                • Playback Controls
                            </button>
                        </li>
                        <li style={{ marginLeft: '1rem' }}>
                            <button onClick={() => scrollToSection('using-player')} className="text-accent hover:underline" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                • Ad Skipping
                            </button>
                        </li>
                        <li style={{ marginLeft: '1rem' }}>
                            <button onClick={() => scrollToSection('using-player')} className="text-accent hover:underline" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                • Interactive Transcript
                            </button>
                        </li>
                        <li>
                            <button onClick={() => scrollToSection('support')} className="text-accent hover:underline" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--accent-color)' }}>
                                Support
                            </button>
                        </li>
                    </ul>
                </div>

                {/* Getting Started */}
                <section id="getting-started" style={{ marginBottom: '3rem' }}>
                    <h2>Getting Started</h2>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                        <strong>STFUAI Podcasts</strong> is an AI-powered podcast player designed to respect your time.
                        STFUAIP uses AI to detect and automatically skip advertisements, intros, outros, and self-promotion segments in your favorite podcasts.
                    </p>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                        To get the most out of the app, you'll need to configure a few settings. Don't worry, it should only take a few minutes.
                    </p>
                </section>

                {/* Configuration */}
                <section id="configuration" style={{ marginBottom: '3rem' }}>
                    <h2>Configuration</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                        STFUAI Podcasts uses AI-powered transcription and analysis to detect and skip ads. You'll need API keys from transcription and AI providers to enable these features.
                    </p>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                        Choose your transcription provider in Settings. Both options require API keys, but offer different features and pricing.
                    </p>

                    <div style={{ marginBottom: '2rem' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            Transcription Providers
                        </h3>
                        
                        <div style={{ marginLeft: '2rem', marginBottom: '1.5rem' }}>
                            <h4 style={{ color: 'var(--accent-color)', marginBottom: '0.5rem' }}>AssemblyAI (Recommended for comprehensive detection)</h4>
                            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                                <strong>Cost:</strong> ~$0.65 per hour of audio<br/>
                                <strong>Features:</strong> Speaker diarization (labels like "Host", "Advertiser"), enables both basic and advanced detection<br/>
                                <strong>Best for:</strong> Most accurate ad detection with automatic basic detection (free after transcription)
                            </p>
                            <ol style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                                <li>
                                    Go to <a href="https://www.assemblyai.com/dashboard/signup" target="_blank" rel="noreferrer" className="text-accent hover:underline" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                        AssemblyAI Dashboard <ExternalLink size={14} />
                                    </a> and sign up.
                                </li>
                                <li>Generate an API key and copy it from the dashboard.</li>
                                <li>Open <strong>Settings</strong> in this app and select <strong>AssemblyAI</strong> as your provider.</li>
                                <li>Paste the key into the <strong>AssemblyAI API Key</strong> field.</li>
                            </ol>
                        </div>

                        <div style={{ marginLeft: '2rem', marginBottom: '1.5rem' }}>
                            <h4 style={{ color: 'var(--accent-color)', marginBottom: '0.5rem' }}>OpenAI Whisper (Cheaper alternative)</h4>
                            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                                <strong>Cost:</strong> ~$0.36 per hour of audio<br/>
                                <strong>Features:</strong> Word-level timestamps, advanced AI detection only (no speaker labels)<br/>
                                <strong>Best for:</strong> Budget-conscious users who don't need speaker diarization
                            </p>
                            <ol style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                                <li>
                                    Go to <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="text-accent hover:underline" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                        OpenAI Platform <ExternalLink size={14} />
                                    </a> and sign up/log in.
                                </li>
                                <li>Create a new secret key.</li>
                                <li>Open <strong>Settings</strong> in this app and select <strong>OpenAI Whisper</strong> as your provider.</li>
                                <li>Paste the key into the <strong>OpenAI API Key</strong> field.</li>
                            </ol>
                        </div>
                    </div>

                    <div style={{ marginBottom: '2rem' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            Ad Detection Methods
                        </h3>
                        
                        <div style={{ marginLeft: '2rem', marginBottom: '1rem' }}>
                            <h4 style={{ color: 'var(--accent-color)', marginBottom: '0.5rem' }}>Basic Detection (AssemblyAI only)</h4>
                            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                                Fast and automatic detection using speaker labels to identify "Advertiser" segments. 
                                Free (no additional API calls beyond transcription). Limited to explicitly labeled advertisements.
                            </p>
                        </div>

                        <div style={{ marginLeft: '2rem', marginBottom: '1rem' }}>
                            <h4 style={{ color: 'var(--accent-color)', marginBottom: '0.5rem' }}>Advanced Detection (Both providers)</h4>
                            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                                Uses GPT-4o-mini to analyze transcript content and detect advertisements, self-promotion, intros/outros, and closing credits.
                                Requires OpenAI API key. Cost: ~$0.02-0.05 per episode.
                            </p>
                            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                                Click the <strong>"Analyze"</strong> button on any episode to run advanced detection.
                            </p>
                        </div>
                    </div>

                    <div style={{ backgroundColor: 'rgba(30, 215, 96, 0.1)', padding: '1rem', borderRadius: '0.5rem', borderLeft: '4px solid var(--accent-color)' }}>
                        <p style={{ margin: 0, fontSize: '0.9rem' }}>
                            <strong>Note:</strong> Your API keys are stored locally on your device and are never sent to our servers.
                        </p>
                    </div>
                </section>

                {/* Using the Player */}
                <section id="using-player" style={{ marginBottom: '3rem' }}>
                    <h2>Using the Player</h2>

                    <div style={{ marginBottom: '2rem' }}>
                        <h3><Play size={20} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.5rem' }} /> Playback</h3>
                        <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                            Click any episode to start playing. The player bar at the bottom controls playback, volume, and speed.
                            Click the player bar to expand the <strong>Full Player</strong> view.
                        </p>
                        <div style={{
                            width: '100%',
                            marginTop: '1rem',
                            borderRadius: '0.5rem',
                            overflow: 'hidden',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
                            border: '1px solid rgba(255, 255, 255, 0.1)'
                        }}>
                            <img 
                                src="/full-screen-player.png" 
                                alt="Full screen player with transcript and playback controls"
                                style={{ width: '100%', height: 'auto', display: 'block' }}
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: '2rem' }}>
                        <h3><SkipForward size={20} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.5rem' }} /> Ad Skipping</h3>
                        <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                            When you play an episode or add it to your queue, STFUAI Podcasts will automatically transcribe it and analyze that transcript for ads.
                            Detected ad segments will be highlighted in <strong>red</strong> on the progress bar.
                            When playback reaches a red segment, it will automatically skip to the end of the segment!
                        </p>
                        <div style={{
                            width: '100%',
                            marginTop: '1rem',
                            borderRadius: '0.5rem',
                            overflow: 'hidden',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
                            border: '1px solid rgba(255, 255, 255, 0.1)'
                        }}>
                            <img 
                                src="/skippable-segments.png" 
                                alt="Progress bar showing detected ad segments highlighted in red"
                                style={{ width: '100%', height: 'auto', display: 'block' }}
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: '2rem' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            Interactive Transcript
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                            View the full episode transcript in the Full Player view. Click on any word in the transcript to 
                            jump directly to that point in the audio. The transcript automatically scrolls and highlights 
                            the current word as you listen.
                        </p>
                        <div style={{
                            width: '100%',
                            marginTop: '1rem',
                            borderRadius: '0.5rem',
                            overflow: 'hidden',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
                            border: '1px solid rgba(255, 255, 255, 0.1)'
                        }}>
                            <img 
                                src="/transcript-ui.png" 
                                alt="Interactive transcript with word-level navigation"
                                style={{ width: '100%', height: 'auto', display: 'block' }}
                            />
                        </div>
                    </div>
                </section>

                {/* Support */}
                <section id="support">
                    <h2>Support</h2>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                        Need help? Have a feature request? We'd love to hear from you.
                    </p>
                    <ul style={{ listStyle: 'none', padding: 0, marginTop: '1rem' }}>
                        <li style={{ marginBottom: '0.5rem' }}>
                            <strong>Email:</strong> <a href="mailto:help@stfuai.com" className="text-accent hover:underline">help@stfuai.com</a>
                        </li>
                        <li>
                            <strong>Website:</strong> <a href="https://stfuai.com" target="_blank" rel="noreferrer" className="text-accent hover:underline">https://stfuai.com</a>
                        </li>
                    </ul>
                </section>
            </div>
        </div>
    );
};

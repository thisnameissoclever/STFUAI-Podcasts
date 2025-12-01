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
                            <button onClick={() => scrollToSection('getting-started')} className="text-accent hover:underline" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                                Getting Started
                            </button>
                        </li>
                        <li>
                            <button onClick={() => scrollToSection('configuration')} className="text-accent hover:underline" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                                Configuration (API Keys)
                            </button>
                        </li>
                        <li>
                            <button onClick={() => scrollToSection('using-player')} className="text-accent hover:underline" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                                Using the Player
                            </button>
                        </li>
                        <li>
                            <button onClick={() => scrollToSection('support')} className="text-accent hover:underline" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
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
                        STFUAI Podcasts relies on third-party APIs to transcribe audio and detect ad segments. You will need to provide your own API keys for these services.
                    </p>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                        The AssemblyAI API key is mandatory (but free!). The OpenAI API key is optional, but recommended for more advanced skippable-segment detection.
                    </p>

                    <div style={{ marginBottom: '2rem' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            AssemblyAI (Transcription & basic ad detection)
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', marginLeft: '2rem' }}>
                            Used to convert podcast audio into diarized text for analysis and basic ad detection. If you only have this and not the OpenAI API key, you will still be able to skip most ads - typically for free!
                        </p>
                        <ol style={{ marginLeft: '2rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                            <li>
                                Go to <a href="https://www.assemblyai.com/dashboard/signup" target="_blank" rel="noreferrer" className="text-accent hover:underline" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    AssemblyAI Dashboard <ExternalLink size={14} />
                                </a> and sign up.
                            </li>
                            <li>Generate an API key and copy it from the dashboard.</li>
                            <li>Open <strong>Settings</strong> in this app.</li>
                            <li>Paste the key into the <strong>AssemblyAI API Key</strong> field.</li>
                        </ol>
                        <p style={{ color: 'var(--text-secondary)', marginLeft: '2rem' }}>
                            That's it! <strong>STFUAI Podcasts</strong> should now be ready to go! You can subscribe to and start skipping ads in your favorite podcasts, or you can continue to set up the OpenAI API key for even more advanced and accurate ad detection.
                        </p>
                    </div>

                    <div style={{ marginBottom: '2rem' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            OpenAI (Ad Detection)
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', marginLeft: '2rem' }}>
                            Used to analyze the transcript and identify skippable segments.
                        </p>
                        <ol style={{ marginLeft: '2rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                            <li>
                                Go to <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="text-accent hover:underline" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    OpenAI Platform <ExternalLink size={14} />
                                </a> and sign up/log in.
                            </li>
                            <li>Create a new secret key.</li>
                            <li>Open <strong>Settings</strong> in STFUAI Podcasts.</li>
                            <li>Paste the key into the <strong>OpenAI API Key</strong> field.</li>
                        </ol>
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
                        {/* Placeholder for Player UI Screenshot */}
                        <div style={{
                            width: '100%',
                            height: '200px',
                            backgroundColor: '#333',
                            borderRadius: '0.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginTop: '1rem',
                            border: '1px dashed #555'
                        }}>
                            <span style={{ color: '#777' }}>[Screenshot: Player UI, coming soon. Unless I forget to add it. Let's be real, I'm kind of a dork.]</span>
                        </div>
                    </div>

                    <div style={{ marginBottom: '2rem' }}>
                        <h3><SkipForward size={20} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.5rem' }} /> Ad Skipping</h3>
                        <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                            When you play an episode or add it to your queue, STFUAI Podcasts will automatically transcribe it and analyze that transcript for ads.
                            Detected ad segments will be highlighted in <strong>red</strong> on the progress bar.
                            When playback reaches a red segment, it will automatically skip to the end of the segment!
                        </p>
                        {/* Placeholder for Ad Skipping Screenshot */}
                        <div style={{
                            width: '100%',
                            height: '100px',
                            backgroundColor: '#333',
                            borderRadius: '0.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginTop: '1rem',
                            border: '1px dashed #555'
                        }}>
                            <span style={{ color: '#777' }}>[Screenshot: Progress Bar with Ad Segments, coming soon. Unless I forget to add it. Let's be real, I'm kind of a dork.]</span>
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

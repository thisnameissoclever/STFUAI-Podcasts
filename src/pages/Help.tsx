import React from 'react';
import { ExternalLink, Sparkles, Zap } from 'lucide-react';

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
                            <button onClick={() => scrollToSection('ad-detection')} className="text-accent hover:underline" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                                Ad Detection (Basic vs. Advanced)
                            </button>
                        </li>
                        <li>
                            <button onClick={() => scrollToSection('configuration')} className="text-accent hover:underline" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                                Configuration
                            </button>
                        </li>
                        <li>
                            <button onClick={() => scrollToSection('troubleshooting')} className="text-accent hover:underline" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                                Troubleshooting
                            </button>
                        </li>
                    </ul>
                </div>

                {/* Getting Started */}
                <section id="getting-started" style={{ marginBottom: '3rem' }}>
                    <h2>Getting Started</h2>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                        <strong>STFUAI Podcasts</strong> is an intelligent podcast player that respects your time.
                        It automatically transcribes your episodes and detects advertisements, intros, outros, and self-promotion segments, allowing you to skip them seamlessly.
                    </p>
                    <div style={{ backgroundColor: 'rgba(30, 215, 96, 0.1)', padding: '1rem', borderRadius: '0.5rem', borderLeft: '4px solid var(--accent-color)', marginTop: '1rem' }}>
                        <p style={{ margin: 0, fontSize: '0.9rem' }}>
                            <strong>Good news:</strong> You no longer need to bring your own API keys to get started! The app comes with shared keys pre-configured, so you can start listening and skipping ads immediately.
                        </p>
                    </div>
                </section>

                {/* Ad Detection */}
                <section id="ad-detection" style={{ marginBottom: '3rem' }}>
                    <h2>Ad Detection: Basic vs. Advanced</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                        STFUAI Podcasts uses two layers of intelligence to find skippable content.
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <div style={{ backgroundColor: '#222', padding: '1.5rem', borderRadius: '0.5rem' }}>
                            <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Zap size={18} color="#FFD700" /> Basic Detection
                            </h3>
                            <p style={{ fontSize: '0.9rem', color: '#aaa' }}>
                                <strong>Automatic & Instanteous</strong>
                            </p>
                            <p style={{ fontSize: '0.95rem', lineHeight: '1.5' }}>
                                As soon as an episode is transcribed, the app looks for speakers explicitly labeled as "Advertiser" or "Sponsor".
                            </p>
                            <ul style={{ paddingLeft: '1.2rem', fontSize: '0.9rem', color: '#ccc' }}>
                                <li>Happens automatically in the background.</li>
                                <li>Very fast.</li>
                                <li><strong>Free</strong> to use.</li>
                                <li>Great for podcasts with clear ad breaks.</li>
                            </ul>
                        </div>

                        <div style={{ backgroundColor: '#222', padding: '1.5rem', borderRadius: '0.5rem' }}>
                            <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Sparkles size={18} color="var(--accent-color)" /> Advanced Detection
                            </h3>
                            <p style={{ fontSize: '0.9rem', color: '#aaa' }}>
                                <strong>On-Demand AI Analysis</strong>
                            </p>
                            <p style={{ fontSize: '0.95rem', lineHeight: '1.5' }}>
                                Uses powerful LLMs (like Gemini 2.0 or GPT-5) to read the transcript and find context-based ads, long intros, and chit-chat.
                            </p>
                            <ul style={{ paddingLeft: '1.2rem', fontSize: '0.9rem', color: '#ccc' }}>
                                <li><strong>Automatic by default:</strong> Runs immediately after transcription (can be disabled in Settings).</li>
                                <li>Can be triggered manually by clicking the <strong>Analyze</strong> button.</li>
                                <li>Smart enough to find "baked-in" reads.</li>
                                <li>Uses OpenRouter for model choice.</li>
                                <li>Higher accuracy.</li>
                            </ul>
                        </div>
                    </div>
                </section>

                {/* Configuration */}
                <section id="configuration" style={{ marginBottom: '3rem' }}>
                    <h2>Configuration</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                        Good news - you don't need to configure anything! All transcription and ad detection is handled automatically by our cloud backend.
                    </p>

                    <div style={{ backgroundColor: 'rgba(30, 215, 96, 0.1)', padding: '1rem', borderRadius: '0.5rem', borderLeft: '4px solid var(--accent-color)', marginTop: '1rem' }}>
                        <p style={{ margin: 0, fontSize: '0.9rem' }}>
                            <strong>Cloud processing:</strong> When you add an episode to your queue, we automatically transcribe it and detect skippable segments in the cloud. No API keys required.
                        </p>
                    </div>

                    <div style={{ marginTop: '2rem' }}>
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Audio Compression (Optional)</h3>
                        <p style={{ color: 'var(--text-secondary)' }}>
                            Found in Developer Settings. You can choose to compress audio files before uploading them for transcription to save bandwidth, or select <strong>"Original (No Compression)"</strong> for the highest possible transcription accuracy.
                        </p>
                    </div>
                </section>

                {/* Troubleshooting */}
                <section id="troubleshooting">
                    <h2>Troubleshooting & Support</h2>

                    <div className="faq-item" style={{ marginBottom: '1.5rem' }}>
                        <h4 style={{ marginBottom: '0.5rem' }}>Why isn't the "Analyze" button working?</h4>
                        <p style={{ color: 'var(--text-secondary)' }}>
                            Ensure you are signed in and the episode has finished downloading and transcribing first. If issues persist, try signing out and back in.
                        </p>
                    </div>

                    <div className="faq-item" style={{ marginBottom: '1.5rem' }}>
                        <h4 style={{ marginBottom: '0.5rem' }}>Where can I get help?</h4>
                        <p style={{ color: 'var(--text-secondary)' }}>
                            Join our community on Discord for the latest updates, feature requests, and support.
                        </p>
                        <p style={{ marginTop: '0.5rem' }}>
                            <a href="https://discord.gg/PGJgQV2vzr" target="_blank" rel="noreferrer" className="text-accent hover:underline" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <ExternalLink size={14} /> Join the STFUAI Discord
                            </a>
                        </p>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: '#555', marginTop: '3rem', borderTop: '1px solid #333', paddingTop: '1rem' }}>
                        STFUAI Podcasts &copy; {new Date().getFullYear()}
                    </div>
                </section>
            </div>
        </div>
    );
};

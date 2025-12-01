import React from 'react';
import { ExternalLink, Play, SkipForward } from 'lucide-react';

export interface HelpSection {
    id: string;
    title: string;
    content: React.ReactNode;
}

export const HELP_SECTIONS: HelpSection[] = [
    {
        id: 'getting-started',
        title: 'Getting Started',
        content: (
            <>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                    Welcome to <strong>STFUAI Podcasts</strong>, the AI-powered podcast player designed to respect your time.
                    Our app uses advanced artificial intelligence to detect and automatically skip advertisements, intros, outros, and self-promotion segments in your favorite podcasts.
                </p>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                    To get the most out of the app, you'll need to configure a few settings. Don't worry, it only takes a minute!
                </p>
            </>
        )
    },
    {
        id: 'configuration',
        title: 'Configuration',
        content: (
            <>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                    STFUAI Podcasts relies on third-party services to transcribe audio and detect ad segments. You will need to provide your own API keys for these services.
                </p>

                <div style={{ marginBottom: '2rem' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        AssemblyAI (Transcription)
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', marginLeft: '2rem' }}>
                        Used to convert podcast audio into text for analysis.
                    </p>
                    <ol style={{ marginLeft: '2rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                        <li>
                            Go to <a href="https://www.assemblyai.com/dashboard/signup" target="_blank" rel="noreferrer" className="text-accent hover:underline" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                AssemblyAI Dashboard <ExternalLink size={14} />
                            </a> and sign up.
                        </li>
                        <li>Copy your API Key from the dashboard.</li>
                        <li>Open <strong>Settings</strong> in STFUAI Podcasts.</li>
                        <li>Paste the key into the <strong>AssemblyAI API Key</strong> field.</li>
                    </ol>
                </div>

                <div style={{ marginBottom: '2rem' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ backgroundColor: '#10a37f', color: 'white', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold' }}>O</span>
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
            </>
        )
    },
    {
        id: 'using-player',
        title: '3. Using the Player',
        content: (
            <>
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
                        <span style={{ color: '#777' }}>[Screenshot: Player UI]</span>
                    </div>
                </div>

                <div style={{ marginBottom: '2rem' }}>
                    <h3><SkipForward size={20} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.5rem' }} /> Ad Skipping</h3>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                        When you play an episode, the app will automatically check for a transcript. If one exists, it will analyze it for ads.
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
                        <span style={{ color: '#777' }}>[Screenshot: Progress Bar with Ad Segments]</span>
                    </div>
                </div>
            </>
        )
    },
    {
        id: 'support',
        title: '4. Support',
        content: (
            <>
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
            </>
        )
    }
];

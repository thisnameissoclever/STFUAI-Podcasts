import { useState, useEffect } from 'react';
import { db } from '../services/db';
import { usePlayerStore } from '../store/usePlayerStore';
import { setDebugEnabled } from '../utils/logger';
import type { UserPreferences, CompressionQuality } from '../types';

export default function Settings() {
    const [preferences, setPreferences] = useState<UserPreferences | null>(null);
    const [storageInfo, setStorageInfo] = useState<any>(null);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        loadPreferences();
        loadStorageInfo();
    }, []);

    // Apply theme when preferences change
    useEffect(() => {
        if (preferences?.theme) {
            document.documentElement.setAttribute('data-theme', preferences.theme);
            if (preferences.theme === 'light') {
                document.body.style.backgroundColor = '#ffffff';
                document.body.style.color = '#000000';
            } else {
                document.body.style.backgroundColor = '#1a1a1a';
                document.body.style.color = '#ffffff';
            }
        }
    }, [preferences?.theme]);

    // Update debug logger when preference changes
    useEffect(() => {
        if (preferences?.debugLogsEnabled !== undefined) {
            setDebugEnabled(preferences.debugLogsEnabled);
        }
    }, [preferences?.debugLogsEnabled]);

    const loadPreferences = async () => {
        const prefs = await db.getPreferences();
        setPreferences(prefs);
    };

    const loadStorageInfo = async () => {
        if (window.electronAPI?.getStorageInfo) {
            const info = await window.electronAPI.getStorageInfo();
            setStorageInfo(info);
        }
    };



    const handleClearData = async () => {
        if (confirm('⚠️ This will delete ALL subscriptions, downloads, queue, playback progress, and settings.\n\nThis action cannot be undone. The app will restart after clearing.\n\nContinue?')) {
            await db.clearAll();
            if (window.electronAPI?.restartApp) {
                await window.electronAPI.restartApp();
            } else {
                alert('All user data has been cleared. Please restart the app manually.');
                window.location.reload();
            }
        }
    };

    const updatePreference = async <K extends keyof UserPreferences>(
        key: K,
        value: UserPreferences[K]
    ) => {
        if (!preferences) return;

        const newPrefs = { ...preferences, [key]: value };
        setPreferences(newPrefs);

        // Auto-save
        await db.savePreferences(newPrefs);

        // Sync specific settings
        if (key === 'playbackSpeed') {
            usePlayerStore.getState().setPlaybackRate(value as number);
        }

        // Show saved indicator
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    if (!preferences) {
        return (
            <div className="settings-page">
                <div className="settings-header">
                    <h1>Settings</h1>
                </div>
                <div className="flex justify-center py-20">
                    <span>Loading...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="settings-page">
            <div className="settings-header">
                <h1>Settings</h1>
                {saved && <span className="save-indicator" style={{ color: '#4ade80', fontWeight: 'bold' }}>✓ Saved!</span>}
            </div>

            <div className="settings-sections">
                {/* General Settings */}
                <section className="settings-section">
                    <h2>General</h2>
                    <div className="setting-item">
                        <label htmlFor="refresh-interval">Background Refresh Interval</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                                id="refresh-interval"
                                type="number"
                                min="2"
                                max="1440"
                                value={preferences.refreshIntervalMinutes || 5}
                                onChange={(e) => updatePreference('refreshIntervalMinutes', parseInt(e.target.value))}
                                style={{ width: '80px' }}
                            />
                            <span>minutes</span>
                        </div>
                        <p className="setting-description">
                            How often to check for new episodes in the background.
                        </p>
                    </div>
                </section>

                {/* Playback Settings */}
                <section className="settings-section">
                    <h2>Playback Preferences</h2>

                    <div className="setting-item">
                        <label htmlFor="playback-speed">Default Playback Speed</label>
                        <select
                            id="playback-speed"
                            value={preferences.playbackSpeed || 1.0}
                            onChange={(e) => updatePreference('playbackSpeed', parseFloat(e.target.value))}
                        >
                            <option value="0.5">0.5x</option>
                            <option value="0.75">0.75x</option>
                            <option value="1.0">1.0x</option>
                            <option value="1.25">1.25x</option>
                            <option value="1.5">1.5x</option>
                            <option value="1.75">1.75x</option>
                            <option value="2.0">2.0x</option>
                            <option value="2.5">2.5x</option>
                        </select>
                    </div>

                    <div className="setting-item">
                        <label htmlFor="volume">Default Volume</label>
                        <input
                            id="volume"
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={preferences.volume}
                            onChange={(e) => updatePreference('volume', parseFloat(e.target.value))}
                        />
                        <span className="volume-display">{Math.round(preferences.volume * 100)}%</span>
                    </div>

                    <div className="setting-item">
                        <label htmlFor="auto-play-next" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                                id="auto-play-next"
                                type="checkbox"
                                checked={preferences.autoPlayNext}
                                onChange={(e) => updatePreference('autoPlayNext', e.target.checked)}
                            />
                            Auto-play Next Episode
                        </label>
                        <p className="setting-description">
                            Automatically play the next episode in queue when current episode finishes
                        </p>
                    </div>

                    <div className="setting-item">
                        <label htmlFor="skip-forward">Skip Forward Interval</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                                id="skip-forward"
                                type="number"
                                min="5"
                                max="120"
                                value={preferences.skipForwardSeconds}
                                onChange={(e) => updatePreference('skipForwardSeconds', parseInt(e.target.value))}
                                style={{ width: '50px' }}
                            />
                            <span>seconds</span>
                        </div>
                    </div>

                    <div className="setting-item">
                        <label htmlFor="skip-backward">Skip Backward Interval</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                                id="skip-backward"
                                type="number"
                                min="5"
                                max="120"
                                value={preferences.skipBackwardSeconds}
                                onChange={(e) => updatePreference('skipBackwardSeconds', parseInt(e.target.value))}
                                style={{ width: '50px' }}
                            />
                            <span>seconds</span>
                        </div>
                    </div>
                </section>

                <section className="settings-section">
                    <h2>Transcription</h2>

                    <div className="setting-item">
                        <label htmlFor="transcription-provider">Provider</label>
                        <select
                            id="transcription-provider"
                            value="assemblyai"
                            disabled={true}
                            style={{ opacity: 0.7, cursor: 'not-allowed' }}
                        >
                            <option value="assemblyai">AssemblyAI (Recommended)</option>
                        </select>
                        <p className="setting-description">
                            AssemblyAI is currently the only supported transcription provider. More coming soon. Maybe. I dunno. We'll see.
                        </p>
                    </div>

                    {preferences.transcriptionProvider === 'assemblyai' && (
                        <div className="setting-item">
                            <label>AssemblyAI API Key</label>
                            <input
                                type="password"
                                value={preferences.assemblyAiApiKey || ''}
                                onChange={(e) => updatePreference('assemblyAiApiKey', e.target.value)}
                                placeholder="Leave empty to use default env key (for now)"
                                className="setting-input"
                                style={{ width: '100%', padding: '8px', marginTop: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#222', color: '#fff' }}
                            />
                            <p className="setting-hint" style={{ fontSize: '0.8rem', color: '#888', marginTop: '4px' }}>
                                If not provided, the app will try to use the built-in API key (for now). This will stop working at some point.
                            </p>
                        </div>
                    )}

                    <div className="setting-item">
                        <label>OpenAI API Key (for Advanced Ad Detection)</label>
                        <input
                            type="password"
                            value={preferences.openAiApiKey || ''}
                            onChange={(e) => updatePreference('openAiApiKey', e.target.value)}
                            placeholder="Leave empty to use default env key (for now)"
                            className="setting-input"
                            style={{ width: '100%', padding: '8px', marginTop: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#222', color: '#fff' }}
                        />
                        <p className="setting-hint" style={{ fontSize: '0.8rem', color: '#888', marginTop: '4px' }}>
                            Required for advanced AI-powered skippable segment detection. If not provided, the app will try to use the built-in API key (for now). This will stop working at some point.
                        </p>
                    </div>
                </section>

                {/* Storage & Data Settings */}
                <section className="settings-section">
                    <h2>Storage & Data</h2>

                    <div className="setting-item">
                        <label>Storage Location</label>
                        <div style={{
                            backgroundColor: '#2a2a2a',
                            padding: '8px',
                            borderRadius: '4px',
                            fontFamily: 'monospace',
                            fontSize: '12px',
                            wordBreak: 'break-all'
                        }}>
                            {storageInfo?.storagePath || 'Loading...'}
                        </div>
                    </div>

                    <div className="setting-item">
                        <label>Storage Usage</label>
                        <div>
                            <p><strong>{storageInfo?.fileCount || 0}</strong> episode(s) downloaded</p>
                            <p><strong>{storageInfo?.totalSizeMB || '0.00'} MB</strong> total storage used</p>
                        </div>
                        <button
                            onClick={loadStorageInfo}
                            style={{
                                marginTop: '8px',
                                padding: '4px 12px',
                                backgroundColor: '#444',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            Refresh
                        </button>
                    </div>
                </section>

                {/* Developer Settings */}
                <section className="settings-section developer-section">
                    <h2>Developer Settings</h2>
                    <p className="section-description">Advanced settings for power users</p>

                    <div className="setting-item">
                        <label htmlFor="compression-quality">Audio Compression Quality</label>
                        <select
                            id="compression-quality"
                            value={preferences.compressionQuality}
                            onChange={(e) => updatePreference('compressionQuality', parseInt(e.target.value) as CompressionQuality)}
                        >
                            <option value="32">32 kbps (Smallest, lower quality)</option>
                            <option value="64">64 kbps (Recommended)</option>
                            <option value="96">96 kbps (Better quality)</option>
                            <option value="128">128 kbps (Best quality, larger files)</option>
                        </select>
                        <p className="setting-description">
                            Lower bitrates reduce file size and transcription costs but may affect audio quality.
                            All audio files are automatically compressed before transcription.
                        </p>
                    </div>

                    <div className="setting-item">
                        <label htmlFor="debug-logs" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                                id="debug-logs"
                                type="checkbox"
                                checked={preferences.debugLogsEnabled}
                                onChange={(e) => updatePreference('debugLogsEnabled', e.target.checked)}
                            />
                            Enable Debug Logging
                        </label>
                        <p className="setting-description">
                            Show detailed console logs for debugging. Useful for troubleshooting issues.
                            Changes apply immediately.
                        </p>
                    </div>

                    <div className="setting-item">
                        <label>API Endpoints</label>
                        <div style={{
                            backgroundColor: '#2a2a2a',
                            padding: '12px',
                            borderRadius: '6px',
                            fontFamily: 'monospace',
                            fontSize: '12px'
                        }}>
                            <div style={{ marginBottom: '8px' }}>
                                <strong>Podcast Index:</strong><br />
                                https://api.podcastindex.org/api/1.0
                            </div>

                            <div>
                                <strong>Google Speech:</strong><br />
                                https://speech.googleapis.com/v1/speech:recognize
                            </div>
                        </div>
                        <p className="setting-description">
                            External API endpoints used by this application (read-only)
                        </p>
                    </div>

                    <div className="setting-item">
                        <label>Clear User Data</label>
                        <button
                            onClick={handleClearData}
                            className="btn-danger"
                            style={{
                                backgroundColor: '#dc2626',
                                color: 'white',
                                padding: '8px 16px',
                                borderRadius: '6px',
                                border: 'none',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                            }}
                        >
                            Clear All Data
                        </button>
                        <p className="setting-description">
                            ⚠️ Removes all subscriptions, downloads, queue, settings, and playback progress.
                            The app will automatically restart after clearing. Use only for testing or troubleshooting.
                        </p>
                    </div>
                </section>
            </div>
        </div>
    );
}


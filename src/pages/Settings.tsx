import { useState, useEffect } from 'react';
import { db } from '../services/db';
import { usePlayerStore } from '../store/usePlayerStore';
import { setDebugEnabled } from '../utils/logger';
// COMMENTED OUT: LLM models now handled by cloud backend
// import { LLM_MODELS, DEFAULT_LLM_MODEL } from '../services/skippableSegments';
import { SettingsToast } from '../components/SettingsToast';
import { getSession, signOut } from '../services/supabaseClient';
// COMMENTED OUT: LLM types no longer needed - cloud backend handles this
// import type { UserPreferences, CompressionQuality, LLMModelId, ReasoningEffort } from '../types';
import type { UserPreferences, CompressionQuality } from '../types';

export default function Settings() {
    const [preferences, setPreferences] = useState<UserPreferences | null>(null);
    const [storageInfo, setStorageInfo] = useState<any>(null);
    const [saved, setSaved] = useState(false);
    const [appVersion, setAppVersion] = useState<string>('');
    const [updateStatus, setUpdateStatus] = useState<any>(null);
    const [user, setUser] = useState<{ email?: string } | null>(null);


    useEffect(() => {
        loadPreferences();
        loadStorageInfo();

        if (window.electronAPI?.getVersion) {
            window.electronAPI.getVersion().then(setAppVersion);
        }

        // Load user session
        getSession().then(session => {
            console.log('[Settings] Loaded session:', session?.user?.email || 'none');
            setUser(session?.user || null);
        });

        // Set up update status listener
        if (window.electronAPI?.onUpdateStatus) {
            const cleanup = window.electronAPI.onUpdateStatus((status) => {
                console.log('Update status:', status);
                setUpdateStatus(status);
            });
            return cleanup;
        }
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
        if (confirm('⚠️ This will delete ALL subscriptions, downloads, queue, playback progress, settings, AND sign you out.\n\nThis action cannot be undone. The app will restart after clearing.\n\nContinue?')) {
            // Sign out of Supabase auth first
            await signOut();

            await db.clearAll();
            if (window.electronAPI?.clearAllData) {
                await window.electronAPI.clearAllData();
            }
            if (window.electronAPI?.restartApp) {
                await window.electronAPI.restartApp();
            } else {
                alert('All user data has been cleared. Please restart the app manually.');
                window.location.reload();
            }
        }
    };

    const checkForUpdates = async () => {
        if (window.electronAPI?.checkForUpdates) {
            setUpdateStatus({ status: 'checking' });
            await window.electronAPI.checkForUpdates({ allowPrerelease: preferences?.includePrereleases ?? true });
        }
    };

    const downloadUpdate = async () => {
        if (window.electronAPI?.downloadUpdate) {
            setUpdateStatus({ status: 'downloading', progress: { percent: 0 } });
            await window.electronAPI.downloadUpdate();
        }
    };

    const quitAndInstall = async () => {
        if (window.electronAPI?.quitAndInstall) {
            await window.electronAPI.quitAndInstall();
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
            usePlayerStore.getState().setDefaultPlaybackRate(value as number);
        }
        if (key === 'volume') {
            usePlayerStore.getState().setVolume(value as number);
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
            </div>
            <SettingsToast visible={saved} />

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

                {/* Account Section */}
                <section className="settings-section">
                    <h2>Account</h2>
                    {user ? (
                        <div className="setting-item">
                            <p>Signed in as: <strong>{user.email}</strong></p>
                            <button
                                onClick={async () => {
                                    await signOut();
                                    window.location.reload();
                                }}
                                style={{
                                    marginTop: '8px',
                                    padding: '8px 16px',
                                    backgroundColor: '#444',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                            >
                                Sign Out
                            </button>
                        </div>
                    ) : (
                        <p>Not signed in</p>
                    )}
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
                            {[0.5, 0.75, 0.9, 1, 1.1, 1.2, 1.25, 1.3, 1.5, 1.75, 2, 2.5].map(rate => (
                                <option key={rate} value={rate}>{rate}x</option>
                            ))}
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

                {/* COMMENTED OUT: Transcription section - now handled by cloud backend
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

                </section>
                END COMMENTED OUT */}

                {/* COMMENTED OUT: Analysis section - now handled by cloud backend
                <section className="settings-section">
                    <h2>Analysis</h2>

                    <div className="setting-item">
                        <label htmlFor="auto-detect-skippables" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                                id="auto-detect-skippables"
                                type="checkbox"
                                checked={preferences.autoDetectSkippables ?? true}
                                onChange={(e) => updatePreference('autoDetectSkippables', e.target.checked)}
                            />
                            Automatic advanced skippable segment detection
                        </label>
                        <p className="setting-description">
                            Automatically run advanced AI analysis (via OpenRouter) immediately after transcription.
                            If disabled, you will still get basic detection (via speaker labels) and can manually trigger advanced analysis from the player.
                        </p>
                    </div>

                    <div className="setting-item">
                        <label htmlFor="llm-model">Ad Detection Model</label>
                        <select
                            id="llm-model"
                            value={preferences.selectedLLMModel || DEFAULT_LLM_MODEL}
                            onChange={(e) => updatePreference('selectedLLMModel', e.target.value as LLMModelId)}
                        >
                            {LLM_MODELS.map(model => (
                                <option key={model.id} value={model.id}>
                                    {model.displayName}
                                </option>
                            ))}
                        </select>
                        <p className="setting-description">
                            AI model for advanced ad detection. Prices shown are per million input tokens.
                        </p>
                    </div>

                    {LLM_MODELS.find(m => m.id === (preferences.selectedLLMModel || DEFAULT_LLM_MODEL))?.supportsTemperature && (
                        <div className="setting-item">
                            <label htmlFor="llm-temperature">Temperature</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <input
                                    id="llm-temperature"
                                    type="range"
                                    min="0"
                                    max="2"
                                    step="0.1"
                                    value={preferences.llmTemperature ?? 0.2}
                                    onChange={(e) => updatePreference('llmTemperature', parseFloat(e.target.value))}
                                    style={{ flex: 1 }}
                                />
                                <span style={{ minWidth: '40px', textAlign: 'right' }}>{(preferences.llmTemperature ?? 0.2).toFixed(1)}</span>
                            </div>
                            <p className="setting-description">
                                Lower = more consistent. Higher = more creative.
                            </p>
                        </div>
                    )}

                    <div className="setting-item">
                        <label htmlFor="llm-reasoning">Reasoning Effort</label>
                        <select
                            id="llm-reasoning"
                            value={preferences.llmReasoningEffort || 'none'}
                            onChange={(e) => updatePreference('llmReasoningEffort', e.target.value as ReasoningEffort)}
                        >
                            <option value="none">None (Default)</option>
                            <option value="minimal">Minimal</option>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                        </select>
                        <p className="setting-description">
                            Higher effort may improve accuracy but increases cost and latency. <br />
                            Even setting reasoning effort from "None" to "Minimal" can <em>~triple</em> processing cost.
                        </p>
                    </div>
                </section>
                END COMMENTED OUT */}

                {/* App Updates */}
                <section className="settings-section">
                    <h2>App Updates</h2>
                    <div className="setting-item">
                        <label>Current Version</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontFamily: 'monospace', backgroundColor: '#2a2a2a', padding: '4px 8px', borderRadius: '4px' }}>
                                v{appVersion || '...'}
                            </span>
                            <button
                                onClick={checkForUpdates}
                                disabled={updateStatus?.status === 'checking' || updateStatus?.status === 'downloading'}
                                style={{
                                    padding: '6px 12px',
                                    backgroundColor: '#444',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    opacity: (updateStatus?.status === 'checking' || updateStatus?.status === 'downloading') ? 0.5 : 1
                                }}
                            >
                                {updateStatus?.status === 'checking' ? 'Checking...' : 'Check for Updates'}
                            </button>
                        </div>
                    </div>

                    <div className="setting-item">
                        <label htmlFor="include-prereleases" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                                id="include-prereleases"
                                type="checkbox"
                                checked={preferences.includePrereleases ?? true}
                                onChange={(e) => updatePreference('includePrereleases', e.target.checked)}
                            />
                            Include beta/pre-releases
                        </label>
                        <p className="setting-description">
                            Check for beta versions and pre-releases in addition to stable updates.
                        </p>
                    </div>

                    {updateStatus && (
                        <div className="update-status-message" style={{ marginTop: '12px', padding: '12px', backgroundColor: '#2a2a2a', borderRadius: '6px' }}>
                            {updateStatus.status === 'checking' && <p>Checking for updates...</p>}

                            {updateStatus.status === 'available' && (
                                <div>
                                    <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                                        New version available: {updateStatus.info?.version}
                                    </p>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            onClick={downloadUpdate}
                                            style={{
                                                padding: '6px 12px',
                                                backgroundColor: '#4ade80',
                                                color: '#000',
                                                border: 'none',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                fontWeight: 'bold'
                                            }}
                                        >
                                            Download Update
                                        </button>
                                        <button
                                            onClick={() => setUpdateStatus(null)}
                                            style={{
                                                padding: '6px 12px',
                                                backgroundColor: '#444',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: '4px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Later
                                        </button>
                                    </div>
                                </div>
                            )}

                            {updateStatus.status === 'not-available' && <p>You are on the latest version.</p>}

                            {updateStatus.status === 'downloading' && (
                                <div>
                                    <p>Downloading update...</p>
                                    {updateStatus.progress && (
                                        <div style={{ width: '100%', height: '4px', backgroundColor: '#444', marginTop: '8px', borderRadius: '2px' }}>
                                            <div style={{ width: `${updateStatus.progress.percent}%`, height: '100%', backgroundColor: '#4ade80', borderRadius: '2px' }} />
                                        </div>
                                    )}
                                </div>
                            )}
                            {updateStatus.status === 'downloaded' && (
                                <div>
                                    <p style={{ color: '#4ade80', fontWeight: 'bold', marginBottom: '8px' }}>Update ready to install!</p>
                                    <button
                                        onClick={quitAndInstall}
                                        style={{
                                            padding: '8px 16px',
                                            backgroundColor: '#4ade80',
                                            color: '#000',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontWeight: 'bold'
                                        }}
                                    >
                                        Restart & Install
                                    </button>
                                </div>
                            )}
                            {updateStatus.status === 'error' && (
                                <p style={{ color: '#ef4444' }}>Error: {updateStatus.error}</p>
                            )}
                        </div>
                    )}
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
                        <button
                            onClick={() => window.electronAPI?.openStorageFolder?.()}
                            style={{
                                marginTop: '8px',
                                marginLeft: '8px',
                                padding: '4px 12px',
                                backgroundColor: '#444',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            Open Folder
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
                            <option value="0">Original (No Compression)</option>
                            <option value="16">16 kbps (Smallest, lower quality)</option>
                            <option value="32">32 kbps (Recommended)</option>
                            <option value="64">64 kbps (Better quality)</option>
                            <option value="96">96 kbps (Best quality, larger files)</option>
                        </select>
                        <p className="setting-description">
                            Lower bitrates reduce file size and transcription costs but may affect audio quality.
                            Select "Original" to skip compression and upload the full-quality audio file for transcription.
                        </p>
                    </div>

                    {/* COMMENTED OUT: OpenRouter API Key - now handled by cloud backend
                    <div className="setting-item">
                        <label>OpenRouter API Key</label>
                        <input
                            type="password"
                            value={preferences.openRouterApiKey || ''}
                            onChange={(e) => updatePreference('openRouterApiKey', e.target.value)}
                            placeholder="Leave empty to use built-in key"
                            className="setting-input"
                            style={{ width: '100%', padding: '8px', marginTop: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#222', color: '#fff' }}
                        />
                        <p className="setting-hint" style={{ fontSize: '0.8rem', color: '#888', marginTop: '4px' }}>
                            For advanced AI-powered skippable segment detection via OpenRouter.
                        </p>
                    </div>
                    END COMMENTED OUT */}



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


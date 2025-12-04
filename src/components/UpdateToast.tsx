import React from 'react';
import { Download, RefreshCw, X, AlertCircle, CheckCircle } from 'lucide-react';
import { useAutoUpdater } from '../hooks/useAutoUpdater';

export const UpdateToast: React.FC = () => {
    const { status, updateInfo, progress, downloadUpdate, quitAndInstall } = useAutoUpdater();
    const [dismissed, setDismissed] = React.useState(false);

    // Reset dismissed state when status changes to something interesting
    React.useEffect(() => {
        if (status === 'available' || status === 'downloaded' || status === 'error') {
            setDismissed(false);
        }
    }, [status]);

    if (dismissed || status === 'idle' || status === 'checking' || status === 'not-available') {
        return null;
    }

    return (
        <div style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            backgroundColor: '#1e1e1e',
            border: '1px solid #333',
            borderRadius: '12px',
            padding: '20px',
            width: '360px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            zIndex: 9999,
            animation: 'slideIn 0.3s ease-out',
            fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px', color: '#fff' }}>
                    {status === 'available' && <SparklesIcon />}
                    {status === 'downloading' && <DownloadIcon />}
                    {status === 'downloaded' && <CheckCircle size={20} className="text-green-500" />}
                    {status === 'error' && <AlertCircle size={20} className="text-red-500" />}

                    {status === 'available' && 'Update Available'}
                    {status === 'downloading' && 'Downloading Update...'}
                    {status === 'downloaded' && 'Update Ready'}
                    {status === 'error' && 'Update Failed'}
                </h4>
                <button
                    onClick={() => setDismissed(true)}
                    style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                    <X size={18} />
                </button>
            </div>

            <div style={{ fontSize: '0.9rem', color: '#ccc', marginBottom: '16px', lineHeight: '1.5' }}>
                {status === 'available' && (
                    <>
                        <p style={{ margin: '0 0 12px 0' }}>
                            Version <span style={{ color: '#fff', fontWeight: 600 }}>{updateInfo?.version}</span> is available.
                        </p>
                        {updateInfo?.releaseNotes && (
                            <div style={{ marginBottom: '12px' }}>
                                <a
                                    href={`https://github.com/thisnameissoclever/STFUAI-Podcasts/releases/tag/v${updateInfo.version}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: '#3b82f6', textDecoration: 'none', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                                >
                                    View Release Notes <span style={{ fontSize: '1.2em' }}>›</span>
                                </a>
                            </div>
                        )}
                    </>
                )}

                {status === 'downloading' && (
                    <div>
                        <div style={{
                            width: '100%',
                            height: '6px',
                            backgroundColor: '#333',
                            borderRadius: '3px',
                            overflow: 'hidden',
                            marginBottom: '8px'
                        }}>
                            <div style={{
                                width: `${progress?.percent || 0}%`,
                                height: '100%',
                                backgroundColor: '#3b82f6',
                                transition: 'width 0.2s ease'
                            }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#888' }}>
                            <span>{Math.round(progress?.percent || 0)}%</span>
                            <span>{((progress?.transferred || 0) / 1024 / 1024).toFixed(1)} MB</span>
                        </div>
                    </div>
                )}

                {status === 'downloaded' && (
                    <p style={{ margin: 0 }}>Restart the app to install the new version.</p>
                )}

                {status === 'error' && (
                    <p style={{ margin: 0, color: '#ef4444' }}>
                        Unable to check for updates. Please try again later.
                        <br />
                        <span style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: '4px', display: 'block' }}>
                            (Check console for details)
                        </span>
                    </p>
                )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                {status === 'available' && (
                    <button
                        onClick={downloadUpdate}
                        style={{
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '8px 16px',
                            fontSize: '0.9rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
                    >
                        <Download size={16} />
                        Download Update
                    </button>
                )}

                {status === 'downloaded' && (
                    <button
                        onClick={quitAndInstall}
                        style={{
                            backgroundColor: '#22c55e',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '8px 16px',
                            fontSize: '0.9rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#16a34a'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#22c55e'}
                    >
                        <RefreshCw size={16} />
                        Restart & Install
                    </button>
                )}
            </div>
        </div>
    );
};

// Simple icon components to avoid missing imports if lucide doesn't have them all or for custom styling
const SparklesIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#fbbf24' }}>
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
);

const DownloadIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#3b82f6' }}>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" x2="12" y1="15" y2="3" />
    </svg>
);

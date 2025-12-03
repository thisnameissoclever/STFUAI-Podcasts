import React from 'react';
import { Download, RefreshCw, X, AlertCircle, CheckCircle } from 'lucide-react';
import { useAutoUpdater } from '../hooks/useAutoUpdater';

export const UpdateToast: React.FC = () => {
    const { status, updateInfo, progress, error, downloadUpdate, quitAndInstall } = useAutoUpdater();
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
            backgroundColor: '#2a2a2a',
            border: '1px solid #444',
            borderRadius: '8px',
            padding: '16px',
            width: '320px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            zIndex: 9999,
            animation: 'slideIn 0.3s ease-out'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {status === 'available' && <SparklesIcon />}
                    {status === 'downloading' && <DownloadIcon />}
                    {status === 'downloaded' && <CheckCircle size={18} className="text-green-500" />}
                    {status === 'error' && <AlertCircle size={18} className="text-red-500" />}

                    {status === 'available' && 'Update Available'}
                    {status === 'downloading' && 'Downloading Update...'}
                    {status === 'downloaded' && 'Update Ready'}
                    {status === 'error' && 'Update Failed'}
                </h4>
                <button
                    onClick={() => setDismissed(true)}
                    style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 0 }}
                >
                    <X size={18} />
                </button>
            </div>

            <div style={{ fontSize: '0.875rem', color: '#ccc', marginBottom: '12px' }}>
                {status === 'available' && (
                    <>
                        <p style={{ margin: '0 0 8px 0' }}>Version {updateInfo?.version} is available.</p>
                        {updateInfo?.releaseNotes && (
                            <div style={{
                                maxHeight: '100px',
                                overflowY: 'auto',
                                background: '#1a1a1a',
                                padding: '8px',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                color: '#aaa'
                            }}>
                                {updateInfo.releaseNotes.replace(/<[^>]*>?/gm, '')}
                            </div>
                        )}
                    </>
                )}

                {status === 'downloading' && (
                    <div>
                        <div style={{
                            width: '100%',
                            height: '6px',
                            backgroundColor: '#444',
                            borderRadius: '3px',
                            overflow: 'hidden',
                            marginBottom: '4px'
                        }}>
                            <div style={{
                                width: `${progress?.percent || 0}%`,
                                height: '100%',
                                backgroundColor: 'var(--accent-color, #3b82f6)',
                                transition: 'width 0.2s ease'
                            }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#888' }}>
                            <span>{Math.round(progress?.percent || 0)}%</span>
                            <span>{((progress?.transferred || 0) / 1024 / 1024).toFixed(1)} MB</span>
                        </div>
                    </div>
                )}

                {status === 'downloaded' && (
                    <p style={{ margin: 0 }}>Restart the app to install the new version.</p>
                )}

                {status === 'error' && (
                    <p style={{ margin: 0, color: '#ef4444' }}>{error || 'An unknown error occurred.'}</p>
                )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                {status === 'available' && (
                    <button
                        onClick={downloadUpdate}
                        style={{
                            backgroundColor: 'var(--accent-color, #3b82f6)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '6px 12px',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        <Download size={14} />
                        Download
                    </button>
                )}

                {status === 'downloaded' && (
                    <button
                        onClick={quitAndInstall}
                        style={{
                            backgroundColor: '#22c55e',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '6px 12px',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        <RefreshCw size={14} />
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

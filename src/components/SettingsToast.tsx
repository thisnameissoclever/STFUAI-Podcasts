import React from 'react';
import { CheckCircle } from 'lucide-react';
import { usePlayerStore } from '../store/usePlayerStore';

interface SettingsToastProps {
    visible: boolean;
}

export const SettingsToast: React.FC<SettingsToastProps> = ({ visible }) => {
    const currentEpisode = usePlayerStore(state => state.currentEpisode);
    const hasActivePlayer = !!currentEpisode;

    if (!visible) return null;

    return (
        <div
            className="settings-toast"
            style={{
                position: 'fixed',
                bottom: hasActivePlayer ? 'calc(var(--player-height) + 20px)' : '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: '#1e1e1e',
                border: '1px solid #333',
                borderRadius: '8px',
                padding: '12px 20px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                zIndex: 9998,
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                animation: 'slideInUp 0.3s ease-out',
                fontFamily: 'system-ui, -apple-system, sans-serif'
            }}
        >
            <CheckCircle size={18} style={{ color: '#4ade80' }} />
            <span style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 500 }}>
                Settings saved
            </span>
        </div>
    );
};

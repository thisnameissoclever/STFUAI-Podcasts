import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { SmallPlayer } from './Player/SmallPlayer';
import { FullPlayer } from './Player/FullPlayer';
import { usePlayerStore } from '../store/usePlayerStore';
import { Menu } from 'lucide-react';

export const Layout = () => {
    const { isPlayerOpen, togglePlayer } = usePlayerStore();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    return (
        <div className="app-container">
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

            <div className="main-content-wrapper">
                {!isSidebarOpen && !isPlayerOpen && (
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        style={{
                            position: 'absolute',
                            top: '1rem',
                            left: '1rem',
                            zIndex: 100,
                            background: 'transparent',
                            border: 'none',
                            color: 'white',
                            padding: '0.5rem',
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                        title="Open Menu"
                    >
                        <Menu size={24} />
                    </button>
                )}
                <main className="main-content">
                    <Outlet />
                </main>
                <SmallPlayer />
            </div>
            {isPlayerOpen && <FullPlayer onClose={togglePlayer} />}
        </div>
    );
};

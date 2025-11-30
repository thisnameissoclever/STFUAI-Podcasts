import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { SmallPlayer } from './Player/SmallPlayer';
import { FullPlayer } from './Player/FullPlayer';
import { usePlayerStore } from '../store/usePlayerStore';

export const Layout = () => {
    const { isPlayerOpen, togglePlayer } = usePlayerStore();

    return (
        <div className="app-container">
            <Sidebar />
            <div className="main-content-wrapper">
                <main className="main-content">
                    <Outlet />
                </main>
                <SmallPlayer />
            </div>
            {isPlayerOpen && <FullPlayer onClose={togglePlayer} />}
        </div>
    );
};

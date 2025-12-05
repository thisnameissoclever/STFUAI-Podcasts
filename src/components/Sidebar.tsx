import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Search, Library, Settings, HelpCircle, ChevronLeft } from 'lucide-react';
import clsx from 'clsx';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
    const location = useLocation();

    const navItems = [
        { icon: Home, label: 'Discover', path: '/' },
        { icon: Search, label: 'Search', path: '/search' },
        { icon: Library, label: 'Subscriptions', path: '/subscriptions' },
        { icon: Settings, label: 'Settings', path: '/settings' },
        { icon: HelpCircle, label: 'Help', path: '/help' },
    ];

    return (
        <>
            {/* Backdrop */}
            <div
                style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 999,
                    opacity: isOpen ? 1 : 0,
                    pointerEvents: isOpen ? 'auto' : 'none',
                    transition: 'opacity 0.3s ease'
                }}
                onClick={onClose}
            />

            {/* Sidebar */}
            <div
                className="sidebar"
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    height: '100vh',
                    width: 'var(--sidebar-width)',
                    padding: '1.5rem',
                    transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
                    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    zIndex: 1000,
                    backgroundColor: 'var(--bg-primary)',
                    borderRight: '1px solid var(--border-color)',
                    boxShadow: isOpen ? '4px 0 24px rgba(0,0,0,0.5)' : 'none'
                }}
            >
                <div className="sidebar-header" style={{
                    marginBottom: '2rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <h1 className="app-title">
                        <span className="text-accent">STFUAI</span> Podcasts
                    </h1>

                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            padding: '0.25rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '50%',
                            transition: 'color 0.2s'
                        }}
                        title="Collapse Menu"
                    >
                        <ChevronLeft size={24} />
                    </button>
                </div>

                <nav className="nav-list">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                onClick={onClose}
                                className={clsx(
                                    'nav-item',
                                    isActive && 'active'
                                )}
                            >
                                <Icon size={20} />
                                <span className="nav-label">{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>
            </div>
        </>
    );
};

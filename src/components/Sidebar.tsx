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
        <div
            className="sidebar"
            style={{
                width: isOpen ? 'var(--sidebar-width)' : '0',
                padding: isOpen ? '1.5rem' : '0',
                overflow: 'hidden',
                transition: 'all 0.3s ease',
                position: 'relative',
                borderRight: isOpen ? '1px solid var(--border-color)' : 'none',
                opacity: isOpen ? 1 : 0,
                pointerEvents: isOpen ? 'auto' : 'none'
            }}
        >
            <div className="sidebar-header" style={{
                marginBottom: '2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                minWidth: '200px' // Prevent text wrapping during transition
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

            <nav className="nav-list" style={{ minWidth: '200px' }}>
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
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
    );
};

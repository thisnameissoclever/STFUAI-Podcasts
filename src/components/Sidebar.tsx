import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Search, Library, Settings } from 'lucide-react';
import clsx from 'clsx';

export const Sidebar: React.FC = () => {
    const location = useLocation();

    const navItems = [
        { icon: Home, label: 'Discover', path: '/' },
        { icon: Search, label: 'Search', path: '/search' },
        { icon: Library, label: 'Subscriptions', path: '/subscriptions' },
        { icon: Settings, label: 'Settings', path: '/settings' },
    ];

    return (
        <div className="sidebar">
            <div className="sidebar-header">
                <h1 className="app-title">
                    <span className="text-accent">STFUAI</span> Podcasts
                </h1>
            </div>
            <nav className="nav-list">
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

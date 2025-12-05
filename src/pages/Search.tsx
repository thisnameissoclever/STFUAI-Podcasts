import React, { useState } from 'react';
import { Search as SearchIcon, Loader } from 'lucide-react';
import { api } from '../services/api';
import type { Podcast } from '../types';
import { PodcastCard } from '../components/PodcastCard';
import { useNavigate } from 'react-router-dom';

export const Search: React.FC = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Podcast[]>([]);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        try {
            const data = await api.search(query);
            if (data && data.feeds) {
                setResults(data.feeds);
            }
        } catch (error) {
            console.error('Search failed:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page-container">
            <h2 className="page-title" style={{ marginBottom: '0.5rem' }}>Search</h2>
            <div className="search-header">
                <form onSubmit={handleSearch} className="search-form">
                    <SearchIcon className="search-icon" size={20} />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search for podcasts..."
                        className="search-input"
                        autoFocus
                    />
                    {loading && <Loader className="search-loader animate-spin" size={20} />}
                </form>
            </div>

            <div className="podcast-grid">
                {results.map((podcast) => (
                    <PodcastCard
                        key={podcast.id}
                        podcast={podcast}
                        onClick={() => navigate(`/podcast/${podcast.id}`)}
                    />
                ))}
            </div>

            {results.length === 0 && !loading && query && (
                <div className="empty-state">
                    No results found for "{query}"
                </div>
            )}
        </div>
    );
};

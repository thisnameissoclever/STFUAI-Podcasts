import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Discover } from './pages/Discover';
import { Search } from './pages/Search';
import { PodcastDetail } from './pages/PodcastDetail';
import Settings from './pages/Settings';
import { Library } from './pages/Library';

import { AudioController } from './components/Player/AudioController';
import { usePlayerStore } from './store/usePlayerStore';
import { usePodcastStore } from './store/usePodcastStore';
import { useRef, useEffect } from 'react';
import { db } from './services/db';
import { feedService } from './services/feedService';

function App() {
  const loadPlayerState = usePlayerStore(state => state.loadState);
  const lastRefreshTime = useRef<number>(Date.now());

  useEffect(() => {
    const initApp = async () => {
      // Load all persisted data on app startup
      await loadPlayerState();
      await usePodcastStore.getState().loadSubscriptions();
      await usePodcastStore.getState().loadEpisodes();

      // Initial feed refresh
      await feedService.refreshFeeds();
      lastRefreshTime.current = Date.now();
    };
    initApp();

    // Background refresh loop
    const intervalId = setInterval(async () => {
      try {
        const prefs = await db.getPreferences();
        const intervalMinutes = prefs?.refreshIntervalMinutes || 5;
        const intervalMs = intervalMinutes * 60 * 1000;

        if (Date.now() - lastRefreshTime.current >= intervalMs) {
          console.log('Background refresh triggered');
          await feedService.refreshFeeds();
          lastRefreshTime.current = Date.now();
        }
      } catch (error) {
        console.error('Error in background refresh loop:', error);
      }
    }, 60000); // Check every minute

    return () => clearInterval(intervalId);
  }, [loadPlayerState]);

  return (
    <HashRouter>
      <AudioController />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Discover />} />
          <Route path="search" element={<Search />} />
          <Route path="podcast/:id" element={<PodcastDetail />} />
          <Route path="subscriptions" element={<Library />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;

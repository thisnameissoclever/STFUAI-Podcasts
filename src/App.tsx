import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Discover } from './pages/Discover';
import { Search } from './pages/Search';
import { PodcastDetail } from './pages/PodcastDetail';
import Settings from './pages/Settings';
import { Library } from './pages/Library';
import { Help } from './pages/Help';

import { AudioController } from './components/Player/AudioController';
import { usePlayerStore } from './store/usePlayerStore';
import { usePodcastStore } from './store/usePodcastStore';
import { useRef, useEffect } from 'react';
import { db } from './services/db';
import { feedService } from './services/feedService';

import { UpdateToast } from './components/UpdateToast';

function App() {
  const loadPlayerState = usePlayerStore(state => state.loadState);
  const lastRefreshTime = useRef<number>(Date.now());

  useEffect(() => {
    const initApp = async () => {
      // Load all persisted data on app startup
      await loadPlayerState();
      await usePodcastStore.getState().loadSubscriptions();
      await usePodcastStore.getState().loadEpisodes();

      // Apply theme preference on startup
      const prefs = await db.getPreferences();
      if (prefs?.theme) {
        document.documentElement.setAttribute('data-theme', prefs.theme);
        if (prefs.theme === 'light') {
          document.body.style.backgroundColor = '#ffffff';
          document.body.style.color = '#000000';
        } else {
          document.body.style.backgroundColor = '#1a1a1a';
          document.body.style.color = '#ffffff';
        }
      }

      // Verify files exist for currently-playing episode and queue before continuing
      // This ensures missing files are recovered before playback can fail
      const { verifyAndRecoverEpisodes } = await import('./services/episodeRecovery');
      const playerState = usePlayerStore.getState();
      const episodesToVerify = [];

      // Add current episode if it exists and is marked as downloaded
      if (playerState.currentEpisode?.isDownloaded) {
        episodesToVerify.push(playerState.currentEpisode);
      }

      // Add all queued episodes that are marked as downloaded
      for (const queuedEpisode of playerState.queue) {
        if (queuedEpisode.isDownloaded) {
          episodesToVerify.push(queuedEpisode);
        }
      }

      if (episodesToVerify.length > 0) {
        console.log(`[App] Verifying ${episodesToVerify.length} episode files on startup...`);
        const recoveryResults = await verifyAndRecoverEpisodes(episodesToVerify);
        if (recoveryResults.length > 0) {
          console.log(`[App] Recovered ${recoveryResults.filter(r => r.success).length}/${recoveryResults.length} missing episodes`);
        }
      }

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
      <UpdateToast />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Discover />} />
          <Route path="search" element={<Search />} />
          <Route path="podcast/:id" element={<PodcastDetail />} />
          <Route path="subscriptions" element={<Library />} />
          <Route path="settings" element={<Settings />} />
          <Route path="help" element={<Help />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;

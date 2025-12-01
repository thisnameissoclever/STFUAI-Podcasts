import { api } from './api';
import { db } from './db';
import { usePodcastStore } from '../store/usePodcastStore';
import { usePlayerStore } from '../store/usePlayerStore';
import type { Episode } from '../types';

export const feedService = {
    refreshFeeds: async () => {
        const { subscriptions, episodes } = usePodcastStore.getState();

        console.log('Starting feed refresh...');

        for (const podcast of Object.values(subscriptions)) {
            try {
                // Fetch recent episodes (limit to 20 to save bandwidth)
                const data = await api.getEpisodesByFeedId(podcast.id, 20);
                if (!data || !data.items) continue;

                const newEpisodes: Episode[] = [];

                for (const item of data.items) {
                    // Check if episode is new (published after subscription time)
                    // AND not already in our database
                    const isNew = item.datePublished * 1000 > podcast.subscribedAt;
                    const exists = Object.values(episodes).some(e => e.guid === item.guid || e.id === item.id);

                    if (isNew && !exists) {
                        // Map API response to Episode interface
                        const episode: Episode = {
                            id: item.id,
                            title: item.title,
                            link: item.link,
                            description: item.description,
                            guid: item.guid,
                            datePublished: item.datePublished,
                            datePublishedPretty: item.datePublishedPretty,
                            dateCrawled: item.dateCrawled,
                            enclosureUrl: item.enclosureUrl,
                            enclosureType: item.enclosureType,
                            enclosureLength: item.enclosureLength,
                            duration: item.duration,
                            explicit: item.explicit,
                            episode: item.episode,
                            season: item.season,
                            image: item.image,
                            feedImage: item.feedImage,
                            feedId: item.feedId,
                            feedTitle: item.feedTitle,
                            feedLanguage: item.feedLanguage,
                            isPlayed: false,
                            playbackPosition: 0,
                            isDownloaded: false,
                            inQueue: false
                        };

                        newEpisodes.push(episode);
                    }
                }

                if (newEpisodes.length > 0) {
                    console.log(`Found ${newEpisodes.length} new episodes for ${podcast.title}`);

                    // Save new episodes to DB and Store
                    for (const ep of newEpisodes) {
                        await db.saveEpisode(ep);

                        // Update Podcast Store
                        usePodcastStore.setState(state => ({
                            episodes: { ...state.episodes, [ep.id]: ep }
                        }));

                        // Auto-add to queue if enabled
                        if (podcast.autoAddToQueue) {
                            console.log(`Auto-adding to queue: ${ep.title}`);
                            await usePlayerStore.getState().addToQueue(ep);
                        }
                    }
                }

            } catch (error) {
                console.error(`Failed to refresh feed for ${podcast.title}:`, error);
            }
        }
        console.log('Feed refresh completed.');
    }
};

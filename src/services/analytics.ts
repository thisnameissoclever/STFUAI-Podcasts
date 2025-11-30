// Not yet implemented in app. 
// Will need to add this functionality in later. 

const GA_MEASUREMENT_ID = 'G-YG2D4NJM9N';

declare global {
    interface Window {
        dataLayer: any[];
        gtag: (...args: any[]) => void;
    }
}

// Initialize dataLayer
window.dataLayer = window.dataLayer || [];
window.gtag = function () {
    window.dataLayer.push(arguments);
};

export const analytics = {
    init: () => {
        console.debug('[Analytics] Init', GA_MEASUREMENT_ID);
        window.gtag('js', new Date());
        window.gtag('config', GA_MEASUREMENT_ID, {
            debug_mode: import.meta.env.DEV
        });
    },

    trackAppOpen: () => {
        console.debug('[Analytics] Track App Open');
        window.gtag('event', 'app_open');
    },

    trackSubscription: (feedTitle: string) => {
        console.debug('[Analytics] Track Subscription', { feedTitle });
        window.gtag('event', 'subscription', {
            event_category: 'engagement',
            event_label: feedTitle
        });
    },

    trackAdDetection: (method: 'basic' | 'advanced', podcastTitle: string, episodeTitle: string) => {
        console.debug('[Analytics] Track Ad Detection', { method, podcastTitle, episodeTitle });
        window.gtag('event', 'ad_detection', {
            event_category: 'ai_feature',
            event_label: method,
            podcast_title: podcastTitle,
            episode_title: episodeTitle
        });
    },

    trackRetranscription: (podcastTitle: string, episodeTitle: string) => {
        console.debug('[Analytics] Track Retranscription', { podcastTitle, episodeTitle });
        window.gtag('event', 'retranscription', {
            event_category: 'ai_feature',
            podcast_title: podcastTitle,
            episode_title: episodeTitle
        });
    },

    trackAudioPlayed: (duration: number) => {
        // Track in minutes for easier aggregation
        const minutes = Math.round(duration / 60);
        if (minutes > 0) {
            console.debug('[Analytics] Track Audio Played', { duration, minutes });
            window.gtag('event', 'audio_played', {
                event_category: 'engagement',
                value: minutes,
                unit: 'minutes'
            });
        }
    },

    trackEpisodeFinished: (podcastTitle: string, episodeTitle: string, progressSeconds: number, totalDuration: number) => {
        const percentage = totalDuration > 0 ? Math.round((progressSeconds / totalDuration) * 100) : 0;
        console.debug('[Analytics] Track Episode Finished', { podcastTitle, episodeTitle, progressSeconds, totalDuration, percentage });
        window.gtag('event', 'episode_finished', {
            event_category: 'engagement',
            podcast_title: podcastTitle,
            episode_title: episodeTitle,
            progress_percentage: percentage,
            total_duration: totalDuration
        });
    },

    trackAutoSkip: (podcastTitle: string, episodeTitle: string, secondsSkipped: number) => {
        console.debug('[Analytics] Track Auto Skip', { podcastTitle, episodeTitle, secondsSkipped });
        window.gtag('event', 'auto_skip', {
            event_category: 'ai_feature',
            podcast_title: podcastTitle,
            episode_title: episodeTitle,
            value: secondsSkipped
        });
    },

    trackSettingsChange: (setting: string, oldValue: any, newValue: any) => {
        // PRIVACY CHECK: Do not track API keys
        if (setting === 'assemblyAiApiKey' || setting === 'openAiApiKey') {
            return;
        }

        console.debug('[Analytics] Track Settings Change', { setting, oldValue, newValue });
        window.gtag('event', 'settings_change', {
            event_category: 'settings',
            setting_name: setting,
            old_value: String(oldValue),
            new_value: String(newValue)
        });
    }
};

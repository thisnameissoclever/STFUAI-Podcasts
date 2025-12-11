import axios from 'axios';

const API_KEY = import.meta.env.VITE_PODCAST_INDEX_KEY;
const API_SECRET = import.meta.env.VITE_PODCAST_INDEX_SECRET;
const BASE_URL = 'https://api.podcastindex.org/api/1.0';

async function getAuthHeaders() {
    const apiHeaderTime = Math.floor(Date.now() / 1000);
    const data = API_KEY + API_SECRET + apiHeaderTime;

    // Use Web Crypto API for SHA-1
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-1', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return {
        'X-Auth-Date': apiHeaderTime.toString(),
        'X-Auth-Key': API_KEY,
        'Authorization': hashHex,
        // Note: User-Agent headers are blocked by browsers, removed to prevent console warnings
    };
}

const client = axios.create({
    baseURL: BASE_URL,
});

client.interceptors.request.use(async (config) => {
    const headers = await getAuthHeaders();
    config.headers['X-Auth-Date'] = headers['X-Auth-Date'];
    config.headers['X-Auth-Key'] = headers['X-Auth-Key'];
    config.headers['Authorization'] = headers['Authorization'];
    // User-Agent removed - browsers block this header
    return config;
});

export const api = {
    search: async (term: string) => {
        // Use 'similar' param to prioritize title matches for better relevance
        const response = await client.get(`/search/byterm?q=${encodeURIComponent(term)}&similar`);
        return response.data;
    },

    getPodcastByFeedId: async (id: number) => {
        const response = await client.get(`/podcasts/byfeedid?id=${id}`);
        return response.data;
    },

    getEpisodesByFeedId: async (id: number, max = 100) => {
        const response = await client.get(`/episodes/byfeedid?id=${id}&max=${max}`);
        return response.data;
    },

    trending: async () => {
        const maxTrendingPodcasts = 100;
        // Calculate days ago as epoch timestamp (seconds)
        const daysAgo = 14;
        const sinceEpoch = Math.floor(Date.now() / 1000) - (daysAgo * 24 * 60 * 60);
        const response = await client.get(`/podcasts/trending?max=${maxTrendingPodcasts}&lang=en&since=${sinceEpoch}`);
        return response.data;
    }
};

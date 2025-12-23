// src/config/cloud.ts
// Cloud backend configuration

export const CLOUD_CONFIG = {
    SUPABASE_URL: 'https://bjtxxsjwfbsupmhspzmc.supabase.co',
    SUPABASE_ANON_KEY: 'sb_publishable_T59kktyMYkuHENzMkAEIog_E-9hFj6m',

    ENDPOINTS: {
        UPLOAD_EPISODE: '/functions/v1/upload-episode',
        GET_JOB_STATUS: '/functions/v1/get-job-status',
        GET_JOB_RESULTS: '/functions/v1/get-job-results',
    },

    POLLING_INTERVAL_MS: 3000,
    MAX_POLL_ATTEMPTS: 100,
} as const;

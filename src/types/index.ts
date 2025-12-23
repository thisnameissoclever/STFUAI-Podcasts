export interface Podcast {
    id: number;
    title: string;
    url: string;
    originalUrl: string;
    link: string;
    description: string;
    author: string;
    ownerName: string;
    image: string;
    artwork: string;
    lastUpdateTime: number;
    contentType: string;
    itunesId: number | null;
    generator: string;
    language: string;
    episodeCount: number;
    // Auto-queue settings
    autoAddToQueue: boolean;
    subscribedAt: number;
}

export interface TranscriptWord {
    word: string;
    startTime: number; // seconds
    endTime: number;
    speaker?: string;
}

export interface TranscriptSegment {
    id: number;
    start: number; // seconds
    end: number;
    text: string;
    words: TranscriptWord[];
    speaker?: string;
}

export interface Transcript {
    episodeId: number;
    text: string; // full transcript text
    segments: TranscriptSegment[];
    language: string;
    duration: number;
    createdAt: number; // timestamp
}

export interface Episode {
    id: number;
    title: string;
    link: string;
    description: string;
    guid: string;
    datePublished: number;
    datePublishedPretty: string;
    dateCrawled: number;
    enclosureUrl: string;
    enclosureType: string;
    enclosureLength: number;
    duration: number;
    explicit: 0 | 1;
    episode: number | null;
    season: number | null;
    image: string;
    feedImage: string;
    feedId: number;
    feedTitle: string;
    feedLanguage: string;

    // Local state
    isPlayed: boolean;
    playbackPosition: number; // in seconds
    localFilePath?: string;
    isDownloaded: boolean;
    inQueue: boolean;

    // Transcription
    transcript?: Transcript;
    transcriptionStatus?: 'pending' | 'processing' | 'completed' | 'failed';
    adSegments?: AdSegment[];
    adDetectionType?: 'basic' | 'advanced';
}

export interface AdSegment {
    startTime: string; // "MM:SS" or "HH:MM:SS"
    endTime: string;
    startTimeSeconds: number; // calculated for easier processing
    endTimeSeconds: number;
    confidence: number;
    type: 'advertisement' | 'self-promotion' | 'intro/outro' | 'closing credits';
    description: string;
}

export type TranscriptionProvider = 'whisper' | 'google' | 'assemblyai';
export type CompressionQuality = 0 | 16 | 32 | 64 | 96 | 128; // kbps (0 = no compression, use original file)

// LLM Model types for OpenRouter integration
export type LLMModelId =
    | 'google/gemini-2.0-flash-lite-001'
    | 'google/gemini-2.0-flash-001'
    | 'google/gemini-2.5-flash'
    | 'openai/gpt-5-mini'
    | 'meta-llama/llama-4-maverick'
    | 'anthropic/claude-haiku-4.5'
    | 'google/gemini-3-pro-preview';

export interface LLMModelConfig {
    id: LLMModelId;
    displayName: string;
    pricePerMillion: number;
    contextWindow: number;
    supportsTemperature: boolean;
}

// Reasoning effort levels for OpenRouter
export type ReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high';

export interface UserPreferences {
    playbackSpeed: number;
    theme: 'dark' | 'light';
    volume: number;
    transcriptionProvider: TranscriptionProvider;
    compressionQuality: CompressionQuality;
    autoPlayNext: boolean;
    skipForwardSeconds: number;
    skipBackwardSeconds: number;
    debugLogsEnabled: boolean;
    refreshIntervalMinutes: number;
    // COMMENTED OUT: API keys now handled by cloud backend
    // assemblyAiApiKey?: string;
    // openRouterApiKey?: string;
    // selectedLLMModel?: LLMModelId;
    // llmTemperature?: number;
    // llmReasoningEffort?: ReasoningEffort;
    includePrereleases: boolean;
    autoDetectSkippables?: boolean;
}
export interface UserSession {
    username: string;
    isAnonymous: boolean;
    subscriptions: number[]; // feedIds
    queue: number[]; // episodeIds (ordered)
    history: number[]; // episodeIds (played)
}

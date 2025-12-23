// src/services/cloudApi.ts
// Cloud backend API wrapper

import { CLOUD_CONFIG } from '../config/cloud';
import { getAccessToken } from './supabaseClient';
import type { AdSegment, TranscriptSegment } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export interface CloudJobStatus {
    jobId: string;
    status: 'pending' | 'uploading' | 'transcribing' | 'detecting_basic' | 'detecting_advanced' | 'completed' | 'failed';
    progress?: number;
    error?: string;
    createdAt: string;
    updatedAt: string;
    completedAt?: string;
}

export interface CloudJobResults {
    jobId: string;
    episodeId: number;
    transcript: {
        id: number;
        text: string;
        segments: TranscriptSegment[];
        language: string;
        duration: number;
        wordCount: number;
    };
    detectedSegments: AdSegment[];
    detectionMethod: 'basic' | 'advanced';
}

export interface EpisodeUploadMetadata {
    feedId: number;
    guid: string;
    title?: string;
    description?: string;
    durationSeconds?: number;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

async function getAuthHeaders(): Promise<HeadersInit> {
    const token = await getAccessToken();
    if (!token) throw new Error('Not authenticated. Please sign in.');

    return {
        'Authorization': `Bearer ${token}`,
        'apikey': CLOUD_CONFIG.SUPABASE_ANON_KEY,
    };
}

/**
 * Upload episode audio file to cloud for processing
 * Returns job ID for status polling
 */
export async function uploadEpisodeToCloud(
    fileBuffer: ArrayBuffer,
    filename: string,
    metadata: EpisodeUploadMetadata
): Promise<string> {
    const headers = await getAuthHeaders();

    const formData = new FormData();
    formData.append('file', new Blob([fileBuffer], { type: 'audio/mpeg' }), filename);
    formData.append('metadata', JSON.stringify(metadata));

    console.log('[CloudAPI] Uploading episode:', metadata.title || filename);

    const response = await fetch(
        `${CLOUD_CONFIG.SUPABASE_URL}${CLOUD_CONFIG.ENDPOINTS.UPLOAD_EPISODE}`,
        {
            method: 'POST',
            headers: headers,
            body: formData
        }
    );

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Upload failed: ${response.status}`);
    }

    const { jobId } = await response.json();
    console.log('[CloudAPI] Upload complete, job ID:', jobId);
    return jobId;
}

/**
 * Get current status of a processing job
 */
export async function getCloudJobStatus(jobId: string): Promise<CloudJobStatus> {
    const headers = await getAuthHeaders();

    const response = await fetch(
        `${CLOUD_CONFIG.SUPABASE_URL}${CLOUD_CONFIG.ENDPOINTS.GET_JOB_STATUS}?jobId=${jobId}`,
        { method: 'GET', headers }
    );

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Status check failed: ${response.status}`);
    }

    return response.json();
}

/**
 * Get results of a completed job (transcript + segments)
 */
export async function getCloudJobResults(jobId: string): Promise<CloudJobResults> {
    const headers = await getAuthHeaders();

    const response = await fetch(
        `${CLOUD_CONFIG.SUPABASE_URL}${CLOUD_CONFIG.ENDPOINTS.GET_JOB_RESULTS}?jobId=${jobId}`,
        { method: 'GET', headers }
    );

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Results fetch failed: ${response.status}`);
    }

    return response.json();
}

/**
 * Wait for job completion with polling
 */
export async function waitForCloudJobCompletion(
    jobId: string,
    onProgress?: (status: CloudJobStatus) => void
): Promise<CloudJobResults> {
    let attempts = 0;

    while (attempts < CLOUD_CONFIG.MAX_POLL_ATTEMPTS) {
        const status = await getCloudJobStatus(jobId);

        if (onProgress) onProgress(status);

        if (status.status === 'completed') {
            return getCloudJobResults(jobId);
        }

        if (status.status === 'failed') {
            throw new Error(status.error || 'Cloud processing failed');
        }

        await new Promise(r => setTimeout(r, CLOUD_CONFIG.POLLING_INTERVAL_MS));
        attempts++;
    }

    throw new Error('Cloud processing timeout');
}

/**
 * Full pipeline: Upload -> Wait -> Return results
 */
export async function processEpisodeInCloud(
    fileBuffer: ArrayBuffer,
    filename: string,
    metadata: EpisodeUploadMetadata,
    onProgress?: (status: CloudJobStatus) => void
): Promise<CloudJobResults> {
    const jobId = await uploadEpisodeToCloud(fileBuffer, filename, metadata);
    return waitForCloudJobCompletion(jobId, onProgress);
}

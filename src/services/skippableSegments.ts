import type { Transcript, AdSegment, Episode, LLMModelConfig, LLMModelId } from '../types';
import { SKIPPABLE_SEGMENTS_SYSTEM_PROMPT } from '../config/prompts';
import { parseAISegmentResponse } from './aiResponseParser';
import { preprocessTranscript } from './transcriptPreprocessor';

const API_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

// Available LLM models for advanced ad detection via OpenRouter
export const LLM_MODELS: LLMModelConfig[] = [
    { id: 'google/gemini-2.0-flash-lite-001', displayName: 'Gemini 2.0 Flash-Lite ($0.07/M)', pricePerMillion: 0.07, contextWindow: 1000000, supportsTemperature: true },
    { id: 'google/gemini-2.0-flash-001', displayName: 'Gemini 2.0 Flash ($0.10/M)', pricePerMillion: 0.10, contextWindow: 1000000, supportsTemperature: true },
    { id: 'google/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash ($0.15/M)', pricePerMillion: 0.15, contextWindow: 1000000, supportsTemperature: true },
    { id: 'openai/gpt-5-mini', displayName: 'GPT-5 Mini ($0.25/M)', pricePerMillion: 0.25, contextWindow: 400000, supportsTemperature: false },
    { id: 'meta-llama/llama-4-maverick', displayName: 'Llama 4 Maverick ($0.22/M)', pricePerMillion: 0.22, contextWindow: 1000000, supportsTemperature: true },
    { id: 'anthropic/claude-haiku-4.5', displayName: 'Claude Haiku 4.5 ($1.00/M)', pricePerMillion: 1.00, contextWindow: 200000, supportsTemperature: true },
    { id: 'google/gemini-3-pro-preview', displayName: 'Gemini 3 Pro ($2.00/M)', pricePerMillion: 2.00, contextWindow: 1000000, supportsTemperature: true }
];

export const DEFAULT_LLM_MODEL: LLMModelId = 'google/gemini-2.5-flash';

/**
 * Parse time string (MM:SS or HH:MM:SS) to seconds
 */
function parseTime(timeStr: string | number): number {
    if (typeof timeStr === 'number') return timeStr;
    if (!timeStr) return 0;

    const parts = timeStr.toString().split(':').map(Number);
    if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return 0;
}

function formatTime(seconds: number): string {
    if (!seconds || isNaN(seconds)) return '0:00';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
        return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Detect basic skippable segments using speaker labels (e.g. "Advertiser")
 * This is a fast, free, heuristic-based approach.
 */
/**
 * Detect basic skippable segments using speaker labels (e.g. "Advertiser")
 * This is a fast, free, heuristic-based approach.
 */
export function detectBasicSegments(transcript: Transcript, duration: number): AdSegment[] {
    if (!transcript.segments || transcript.segments.length === 0) {
        return [];
    }

    const segments: AdSegment[] = [];
    let currentAdStart: number | null = null;
    let currentAdEnd: number | null = null;

    for (const segment of transcript.segments) {
        // Check if speaker is explicitly labeled as "Advertiser", "Advertisement", "Ad", or "Sponsor"
        // Note: AssemblyAI returns "Advertiser"
        const isAdvertiser = segment.speaker && (
            segment.speaker.toLowerCase() === 'advertiser' ||
            segment.speaker.toLowerCase() === 'advertisement' ||
            segment.speaker.toLowerCase() === 'ad' ||
            segment.speaker.toLowerCase() === 'sponsor'
        );

        if (isAdvertiser) {
            if (currentAdStart === null) {
                // Start of a new ad block
                currentAdStart = segment.start;
            }
            // Extend current ad block
            currentAdEnd = segment.end;
        } else {
            // Non-advertiser segment. If we were tracking an ad block, close it.
            if (currentAdStart !== null && currentAdEnd !== null) {
                // Only include if the segment is at least 6 seconds long
                if (currentAdEnd - currentAdStart >= 6) {
                    segments.push({
                        startTime: formatTime(currentAdStart),
                        endTime: formatTime(currentAdEnd),
                        startTimeSeconds: currentAdStart,
                        endTimeSeconds: currentAdEnd,
                        confidence: 100, // High confidence because it's explicit in the transcript
                        type: 'advertisement',
                        description: 'Detected via transcript diarization analysis. Click "Analyze" to perform advanced skippable segment detection.'
                    });
                }
                currentAdStart = null;
                currentAdEnd = null;
            }
        }
    }

    // Handle case where the episode ends with an ad
    if (currentAdStart !== null && currentAdEnd !== null) {
        if (currentAdEnd - currentAdStart >= 6) {
            segments.push({
                startTime: formatTime(currentAdStart),
                endTime: formatTime(currentAdEnd),
                startTimeSeconds: currentAdStart,
                endTimeSeconds: currentAdEnd,
                confidence: 100,
                type: 'advertisement',
                description: 'Detected via transcript diarization analysis. Click "Analyze" to perform advanced skippable segment detection.'
            });
        }
    }

    return validateAndMitigateSegments(segments, duration);
}

/**
 * Detect advanced skippable segments using OpenRouter LLM API
 * This is slower and costs money, but is more accurate and detects more types.
 */
export async function detectAdvancedSegments(episode: Episode): Promise<AdSegment[]> {
    if (!episode.transcript) {
        throw new Error('No transcript available for this episode');
    }

    const { db } = await import('./db');
    const { getSecureValue, SECURE_KEYS } = await import('./secureStorage');
    const prefs = await db.getPreferences();

    // Priority: 1) User's custom key, 2) Secure storage, 3) Bundled env var
    let apiKey = prefs.openRouterApiKey;
    if (!apiKey) {
        apiKey = await getSecureValue(SECURE_KEYS.OPENROUTER_API_KEY) || '';
    }
    if (!apiKey) {
        apiKey = import.meta.env.VITE_OPENROUTER_TOKEN || '';
    }

    if (!apiKey) {
        throw new Error('OpenRouter API key is required for advanced ad detection. Please add your API key in Settings.');
    }

    // Get model configuration
    const selectedModelId = prefs.selectedLLMModel || DEFAULT_LLM_MODEL;
    const modelConfig = LLM_MODELS.find(m => m.id === selectedModelId) || LLM_MODELS.find(m => m.id === DEFAULT_LLM_MODEL)!;

    const systemPrompt = SKIPPABLE_SEGMENTS_SYSTEM_PROMPT.replaceAll('{{DURATION}}', Math.floor(episode.transcript.duration).toString());

    const userContent = `
PODCAST NAME: 
${episode.feedTitle || 'Unknown Podcast'}

PODCAST EPISODE TITLE: 
${episode.title}

PODCAST EPISODE LENGTH (in seconds):
${episode.transcript.duration}

EPISODE TRANSCRIPT WITH INLINE TIME-CODES [MM:SS]: 
${preprocessTranscript(episode.transcript)}
`;

    try {
        // Build payload dynamically based on model capabilities
        const payload: Record<string, unknown> = {
            model: selectedModelId,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userContent }
            ],
            response_format: { type: 'json_object' }
        };

        // Add temperature if the model supports it
        if (modelConfig.supportsTemperature) {
            payload.temperature = prefs.llmTemperature ?? 0.2;
        }

        // Add reasoning effort - always send to explicitly set the level
        const reasoningEffort = prefs.llmReasoningEffort ?? 'none';
        payload.reasoning = {
            effort: reasoningEffort,
            exclude: true // Don't return reasoning text in the response
        };
        
        console.log('[AI] Detecting skippable segments via OpenRouter');
        console.log(`[AI] Model: ${selectedModelId}, Temperature: ${payload.temperature ?? 'N/A'}, Reasoning: ${reasoningEffort}`);

        if (prefs.debugLogsEnabled) {
            console.debug('[AI] OpenRouter Request Payload:', payload);
        }

        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://stfuai.app',
                'X-Title': 'STFUAI Podcasts'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const content = data.choices[0].message.content;

        // Robust JSON extraction (response_format should guarantee valid JSON, but be safe)
        let jsonStr = content.trim();

        // If content is wrapped in markdown code blocks, extract it
        const jsonBlockMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonBlockMatch) {
            jsonStr = jsonBlockMatch[1].trim();
        } else {
            // Fallback: try to find the first '[' and last ']'
            const firstBracket = content.indexOf('[');
            const lastBracket = content.lastIndexOf(']');
            if (firstBracket !== -1 && lastBracket !== -1) {
                jsonStr = content.substring(firstBracket, lastBracket + 1);
            }
        }

        // Parse, sanitize, and validate the AI response
        const validatedSegments = parseAISegmentResponse(jsonStr);

        // Convert to internal AdSegment format with seconds
        const segments = validatedSegments.map(seg => {
            const startTimeSeconds = parseTime(seg.startTime);
            const endTimeSeconds = parseTime(seg.endTime);

            return {
                startTime: formatTime(startTimeSeconds),
                endTime: formatTime(endTimeSeconds),
                startTimeSeconds,
                endTimeSeconds,
                confidence: seg.confidence,
                type: seg.type,
                description: seg.description
            };
        });

        return validateAndMitigateSegments(segments, episode.transcript.duration);

    } catch (error) {
        console.error('[AI] Skippable segment detection failed:', error);
        throw error;
    }
}


/**
 * Merges advertisement segments that are close together (< 8 seconds apart).
 * This prevents fragmented ad blocks from being displayed as separate segments.
 * 
 * Rules:
 * - Only merges segments where BOTH are type='advertisement'.
 * - Merges if gap between segments is < 8 seconds.
 * - merging logic handles overlaps as well (gap < 0).
 */
export function mergeCloseAdSegments(segments: AdSegment[]): AdSegment[] {
    if (segments.length <= 1) return segments;

    // Create a copy to avoid mutating inputs during processing
    // Note: Caller is expected to pass sorted segments, but we sort again to be safe.
    const sorted = [...segments].sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);
    const merged: AdSegment[] = [];

    let current = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
        const next = sorted[i];

        // Check if both are advertisements (SPECIFICALLY advertisements, per rules)
        const isAdSequence = current.type === 'advertisement' && next.type === 'advertisement';

        // Calculate gap (next start - current end)
        // If they overlap, gap is negative, which is < 8, so they merge.
        const gap = next.startTimeSeconds - current.endTimeSeconds;

        if (isAdSequence && gap < 8) {
            // Merge them
            // Use maximum end time (in case nested/overlap)
            const newEndSeconds = Math.max(current.endTimeSeconds, next.endTimeSeconds);

            // Combine descriptions if specific enough, otherwise keep simple
            let newDesc = current.description;
            // Only append if it's not a duplicate description
            if (next.description && next.description !== current.description && !newDesc.includes(next.description)) {
                newDesc += ' | ' + next.description;
            }

            console.info(`[Validation] Merging close ad segments (<8s gap): [${current.startTime}-${current.endTime}] + [${next.startTime}-${next.endTime}]`);

            current = {
                ...current,
                endTimeSeconds: newEndSeconds,
                endTime: formatTime(newEndSeconds),
                description: newDesc,
                // Take the higher confidence of the two
                confidence: Math.max(current.confidence, next.confidence)
            };
        } else {
            // Push current and start new
            merged.push(current);
            current = next;
        }
    }
    merged.push(current);

    return merged;
}

/**
 * Validates and mitigates issues with skippable segments.
 * Handles overlaps, invalid times, and short segments.
 */
export function validateAndMitigateSegments(segments: AdSegment[], episodeDuration: number): AdSegment[] {
    // 1. Initial Filter & Sanitization
    let validSegments = segments.filter(seg => {
        // Start time > Episode duration
        if (seg.startTimeSeconds >= episodeDuration) {
            console.warn(`[Validation] Segment starts after episode end: ${seg.startTime} - ${seg.endTime}. Ignoring.`);
            return false;
        }
        // Start time < 0
        if (seg.startTimeSeconds < 0) {
            console.warn(`[Validation] Segment starts before 0: ${seg.startTime} - ${seg.endTime}. Ignoring.`);
            return false;
        }
        // End time <= Start time
        if (seg.endTimeSeconds <= seg.startTimeSeconds) {
            console.warn(`[Validation] Invalid segment detected (End <= Start): ${seg.startTime} - ${seg.endTime}. Ignoring.`);
            return false;
        }
        return true;
    }).map(seg => {
        // Cap at duration
        if (seg.endTimeSeconds > episodeDuration) {
            console.warn(`[Validation] Segment ends after episode end. Capping at duration: ${seg.endTime} -> ${formatTime(episodeDuration)}`);
            return {
                ...seg,
                endTimeSeconds: episodeDuration,
                endTime: formatTime(episodeDuration)
            };
        }
        return seg;
    });

    // 2. Filter Short Segments (Pre-overlap check)
    validSegments = validSegments.filter(seg => {
        const duration = seg.endTimeSeconds - seg.startTimeSeconds;

        // Advertisements must be at least 8 seconds
        if (seg.type === 'advertisement' && duration < 8) {
            console.debug(`[Validation] Advertisement too short (<8s): ${seg.startTime} - ${seg.endTime}. Ignoring.`);
            return false;
        }

        // All other types must be at least 3 seconds
        if (duration < 3) {
            console.debug(`[Validation] Skippable segment too short (<3s): ${seg.startTime} - ${seg.endTime}. Ignoring.`);
            return false;
        }
        return true;
    });

    // 3. Filter by Confidence Threshold (2a)
    const CONFIDENCE_THRESHOLD = 60;
    const beforeConfidenceFilter = validSegments.length;
    validSegments = validSegments.filter(seg => {
        if (seg.confidence < CONFIDENCE_THRESHOLD) {
            console.info(`[Validation] Segment below confidence threshold (${seg.confidence}% < ${CONFIDENCE_THRESHOLD}%): ${seg.startTime} - ${seg.endTime}. Ignoring.`);
            return false;
        }
        return true;
    });
    if (beforeConfidenceFilter > validSegments.length) {
        console.info(`[Validation] Filtered out ${beforeConfidenceFilter - validSegments.length} low-confidence segments`);
    }

    // 4. Sanity Check: Unusual Segment Count (2d)
    // Most podcasts have 3-8 skippable segments. More than 15 is suspicious.
    const MAX_EXPECTED_SEGMENTS = 15;
    if (validSegments.length > MAX_EXPECTED_SEGMENTS) {
        console.warn(`[Validation] Unusually high segment count (${validSegments.length} > ${MAX_EXPECTED_SEGMENTS}). This may indicate detection issues.`);
    }

    // 3. Handle Overlaps & Merge Close Ads
    // Sort by start time to make overlap detection easier
    validSegments.sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);

    // Merge close advertisement segments (<8s gap) BEFORE general overlap resolution
    validSegments = mergeCloseAdSegments(validSegments);

    const mitigatedSegments: AdSegment[] = [];

    for (const current of validSegments) {
        if (mitigatedSegments.length === 0) {
            mitigatedSegments.push(current);
            continue;
        }

        const previous = mitigatedSegments[mitigatedSegments.length - 1];

        // Check for overlap
        if (current.startTimeSeconds < previous.endTimeSeconds) {
            console.warn(`[Validation] Overlap detected: [${previous.startTime}-${previous.endTime}] and [${current.startTime}-${current.endTime}]`);

            // Case A: Nested (Current is inside Previous)
            if (current.endTimeSeconds <= previous.endTimeSeconds) {
                console.warn(`[Validation] Segment is entirely contained within previous. Ignoring current.`);
                continue; // Skip current
            }

            // Case B: Partial Overlap
            // Split the difference
            const midpoint = (current.startTimeSeconds + previous.endTimeSeconds) / 2;

            console.warn(`[Validation] Resolving overlap by splitting at ${formatTime(midpoint)}`);

            // Update previous end time
            previous.endTimeSeconds = midpoint;
            previous.endTime = formatTime(midpoint);

            // Update current start time
            current.startTimeSeconds = midpoint;
            current.startTime = formatTime(midpoint);

            mitigatedSegments.push(current);
        } else {
            // No overlap
            mitigatedSegments.push(current);
        }
    }

    // 4. Final Short Segment Check (Post-overlap mitigation)
    // Splitting might have created short segments
    return mitigatedSegments.filter(seg => {
        if (seg.endTimeSeconds - seg.startTimeSeconds < 2) {
            console.info(`[Validation] Segment too short after mitigation (<2s): ${seg.startTime} - ${seg.endTime}. Ignoring.`);
            return false;
        }
        return true;
    });
}

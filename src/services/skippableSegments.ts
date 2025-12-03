import type { Transcript, AdSegment, Episode } from '../types';
import { SKIPPABLE_SEGMENTS_SYSTEM_PROMPT } from '../config/prompts';

const API_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

interface AIAdSegment {
    startTime: string;
    endTime: string;
    confidence: number;
    type: 'advertisement' | 'self-promotion' | 'intro/outro' | 'closing credits';
    description: string;
}

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
 * Detect advanced skippable segments using OpenAI (LLM)
 * This is slower and costs money, but is more accurate and detects more types.
 */
export async function detectAdvancedSegments(episode: Episode): Promise<AdSegment[]> {
    if (!episode.transcript) {
        throw new Error('No transcript available for this episode');
    }

    const { db } = await import('./db');
    const prefs = await db.getPreferences();
    const apiKey = prefs.openAiApiKey || import.meta.env.VITE_OPENAI_API_KEY || '';

    if (!apiKey) {
        throw new Error('API key is required for advanced ad detection. Please check your settings.');
    }

    const systemPrompt = SKIPPABLE_SEGMENTS_SYSTEM_PROMPT.replaceAll('{{DURATION}}', Math.floor(episode.transcript.duration).toString());

    const userContent = `
PODCAST NAME: 
${episode.feedTitle || 'Unknown Podcast'}

PODCAST EPISODE TITLE: 
${episode.title}

PODCAST EPISODE LENGTH (in seconds):
${episode.transcript.duration}

EPISODE TRANSCRIPT WITH TIME-CODES: 
${episode.transcript.segments.map(s => `[${formatTime(s.start)}]${s.speaker ? ` (${s.speaker}):` : ''} ${s.text}`).join('\n')}
`;

    try {
        const payload = {
            //model: 'gpt-4o', //Not great, and costs more... why in the world?
            model: 'gpt-5.1', //gpt-5.1 is the latest valid model that seems to work well. 
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userContent }
            ],
            verbosity: 'medium',
            reasoning_effort: 'none',
            temperature: 0.1
        };

        console.log('[AI] Detecting skippable segments with payload:');
        console.log(payload);

        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const content = data.choices[0].message.content;

        // Robust JSON extraction
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

        const rawSegments: AIAdSegment[] = JSON.parse(jsonStr);

        // Convert to internal AdSegment format with seconds
        const segments = rawSegments.map(seg => {
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
        if (seg.endTimeSeconds - seg.startTimeSeconds < 2) {
            console.info(`[Validation] Segment too short (<2s): ${seg.startTime} - ${seg.endTime}. Ignoring.`);
            return false;
        }
        return true;
    });

    // 3. Handle Overlaps
    // Sort by start time to make overlap detection easier
    validSegments.sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);

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

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
export function detectBasicSegments(transcript: Transcript): AdSegment[] {
    if (!transcript.segments || transcript.segments.length === 0) {
        return [];
    }

    const segments: AdSegment[] = [];
    let currentAdStart: number | null = null;
    let currentAdEnd: number | null = null;

    for (const segment of transcript.segments) {
        // Check if speaker is explicitly labeled as "Advertiser"
        // Note: AssemblyAI returns "Advertiser" (case sensitive usually, but let's be safe)
        const isAdvertiser = segment.speaker && segment.speaker.toLowerCase() === 'advertiser';

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
                        description: 'Detected via speaker label'
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
                description: 'Detected via speaker label'
            });
        }
    }

    return segments;
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
        throw new Error('OpenAI API key is required for advanced ad detection. Please check your settings.');
    }

    const systemPrompt = SKIPPABLE_SEGMENTS_SYSTEM_PROMPT.replaceAll('{{DURATION}}', Math.floor(episode.duration).toString());

    const userContent = `
PODCAST NAME: 
${episode.feedTitle || 'Unknown Podcast'}

PODCAST EPISODE TITLE: 
${episode.title}

PODCAST EPISODE LENGTH (in seconds):
${episode.duration}

EPISODE TRANSCRIPT WITH TIME-CODES: 
${episode.transcript.segments.map(s => `[${formatTime(s.start)}]${s.speaker ? ` (${s.speaker}):` : ''} ${s.text}`).join('\n')}
`;

    try {
        const payload = {
            //model: 'gpt-4o', //Not great, and costs more... why in the world?
            model: 'gpt-5.1',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userContent }
            ],
            verbosity: 'low',
            reasoning_effort: 'none',
            temperature: 0
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
        return rawSegments
            .map(seg => {
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
            })
            .filter(seg => {
                if (seg.endTimeSeconds <= seg.startTimeSeconds) {
                    console.warn(`[AI] Invalid segment detected (End <= Start): ${seg.startTime} - ${seg.endTime}. Ignoring.`);
                    return false;
                }
                return true;
            });

    } catch (error) {
        console.error('[AI] Skippable segment detection failed:', error);
        throw error;
    }
}

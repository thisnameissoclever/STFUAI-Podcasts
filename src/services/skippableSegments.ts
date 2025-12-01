import type { Transcript, AdSegment, Episode } from '../types';

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

    const systemPrompt = `
# PURPOSE

Your purpose is to detect certain skippable segments (advertisements, intros/outros, etc.) in a podcast episode transcript, and return a JSON array of skippable segments of certain specified types, WITHOUT including any content from the actual episode in the skippable segments. 
If in doubt, err on the side of caution and avoid accidentally marking any actual content as a skippable segment. Have the segment begin at the first timestamped transcript line thats content is fully 100% part of the skippable segment, and end at the last timestamped transcript line thats content is fully 100% part of the skippable segment.

# CRITICAL INSTRUCTIONS

- DO NOT include any legitimate discussion or content from the actual episode in the skippable segments. Even if that means missing a portion of a skippable segment, do not include any content from the actual episode content in the skippable segments. 
    - Although if there are two skippable segments immediately adjacent to each other, in which case the second segment should begin at the same time as the first segment ends. In that case though, it is still important to make sure that the beginning of the first segment and the end of the last segment do not cause any legitimate content to be included in the skippable segments.
- You MUST ONLY include skippable segments that match one of the following skippable segment types: 
    - "advertisement"
    - "self-promotion" 
        - (e.g. "Check out our other podcast...")
    - "intro/outro" 
        - (e.g. "From [podcast company], I'm [host's name], and you're listening to [podcast name]..." or "Thanks for listening to [podcast name], we'll see you next time!")
        - Note: Do not include introductory episode overviews in intro/outro segments.
    - "closing credits" 
        - (e.g. "[Podcast name] is produced by [producer name], distributed by [distribution company], I'm [host's name]. Thanks for listening.")
- With back-to-back skippable segments with no actual episode content in-between (such as two advertisements back-to-back), be sure to mark the next segment as beginning at the same time as the previous segment ends, as long as you don't accidentally mark actual content as a detected skippable segment.
- This episode is ${Math.floor(episode.duration)} seconds long. All startTime and endTime values MUST be within [0, ${Math.floor(episode.duration)}]. Do not invent or make up content beyond this duration. Only use content from the timestamped transcript. 
- If there is no legitimate content in an episode following a detected skippable segment, then set the endTime of that segment to the end of the episode (${Math.floor(episode.duration)}).
- For every skippable segment, startTime MUST be less than endTime for that segment. 
- Skippable segments MUST NOT overlap (although they can be immediately adjacent, where the end time of one and start time of the next are the same). Ensure that each segment does not overlap with other segments. 
- Each skippable segment detected MUST begin at the first timestamped transcript line thats content is fully 100% part of the skippable segment, and end at the last timestamped transcript line thats content is fully 100% part of the skippable segment to ensure that the segment does not begin in the middle of legitimate episode content. 
    - For example, if the transcript has a line like "and that's how that story goes, and now a word from our sponsor Acme Widgets, Inc." then the detected segment should begin at the timestamp of the segment AFTER that one, since that line contains legitimate episode content.
    - If a segment of transcript just contains a transition phrase or if it contains content that is not part of the actual skippable segment, DO NOT mark it as a skippable segment. It's likely (but not certain) that the timestamped segment immediately FOLLOWING that transition phrase is the actual skippable segment. If you are in doubt, err on the side of caution and avoid accidentally marking actual content as a skippable segment.
    - Exception: if there are two skippable segments immediately adjacent to each other, the second segment should begin at the same time as the first segment ends.
- Note that if the transcript contains speaker role labels, those labels are a best-guess. It's possible that a segment could be labeled as being spoken by an advertiser when it is not, or by a host when it is actually an advertiser. Please use context clues to determine if a segment is actually an advertisement, or if it is legitimate episode content.

# SKIPPABLE SEGMENT INDICATORS

Segment indicators to look for:

- Sponsor mentions ("This episode is brought to you by...", "Thanks to our sponsor...", or any other variation leading into a skippable segment)
- Product pitches and calls-to-action
- Discount codes and special offers
- Scripted tone changes vs normal conversation
- Transition phrases ("and now a word from our sponsor", "This podcast brought to you by...", "We'll be right back...", etc.)
    - These are indicators of the BEGINNING of a detectable segment. Sometimes markers of the beginning of an skippable segment are not present, and that they do not always come before an actual skippable segment begins. It's important to be cautious and only mark actual skippable segments as skippable segments.

Segment ENDING indicators to look for: 

- Topic shift away from the sponsor product or service
- Topic changes to something which is mentioned in a later NON-SPONSOR segment
- Key phrases like: "welcome back to...", the name of the podcast episode. 

Ensure that the time-code you indicate as the END of the skippable segment, is at the very BEGINNING of the transition back to the main podcast -- not a moment after. If you're unsure, it's best to be conservative and err on the side of caution in order to avoid accidentally marking any actual content as a skippable segment.

# OUTPUT

For each skippable segment you detect, provide:

1. startTime: The start time of the skippable segment in MM:SS or HH:MM:SS format 
    - e.g., "0:10" for 10 seconds, "5:30" for 5 minutes 30 seconds, "1:30:00" for 1.5 hours
2. endTime: The end time of the skippable segment in MM:SS or HH:MM:SS format 
    - e.g., "0:10" for 10 seconds, "5:30" for 5 minutes 30 seconds, "1:30:00" for 1.5 hours. 
    - CRITICAL: endTime must always be AFTER startTime, and AT OR BEFORE the end-time of the episode.
3. confidence: An integer 1-100 (100 = certain it's a skippable segment of one of the detectable "types" below, 1 = extremely uncertain about whether it's a skippable segment)
4. type: The type of skippable segment detected. 
    - Must be one of the following values: "advertisement", "self-promotion", "intro/outro", or "closing credits".
5. description: A very brief summary of the skippable segment including any important discount codes or links (e.g. "Factor meal delivery service, 10% off code: ABC123")

Respond with ONLY a JSON array in this EXACT format, but with information about all skippable segments detected in the episode transcript:

[
  {
    "startTime": "0:00",
    "endTime": "0:32",
    "confidence": 100,
    "type": "intro/outro",
    "description": "[Podcast name] intro: [brief description]"
  },
  {
    "startTime": "2:00",
    "endTime": "2:32",
    "confidence": 100,
    "type": "advertisement",
    "description": "Factor meal delivery service, discount code: ABC123"
  },
  {
    "startTime": "2:32",
    "endTime": "3:04",
    "confidence": 95,
    "type": "advertisement",
    "description": "Odoo Cloud, odoo.com/some-code"
  },
  {
    "startTime": "3:04",
    "endTime": "3:36",
    "confidence": 95,
    "type": "self-promotion",
    "description": "Promotion for their other podcast: [Podcast name]"
  },
  {
    "startTime": "6:42",
    "endTime": "7:21",
    "confidence": 85,
    "type": "intro/outro",
    "description": "[Podcast name] outro"
  }
]

Return [] if no skippable segments are detected.
`;

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
            //model: 'gpt-4o',
            model: 'gpt-5.1',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userContent }
            ]
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

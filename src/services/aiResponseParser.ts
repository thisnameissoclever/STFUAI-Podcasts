/**
 * AI Response Parser and Validator
 * 
 * Utilities for parsing, sanitizing, and validating JSON responses from AI models.
 * Handles common issues like unquoted time values, invalid types, and malformed data.
 */

// Valid segment types as defined in the AIAdSegment interface
export const VALID_SEGMENT_TYPES = [
    'advertisement',
    'self-promotion',
    'intro/outro',
    'closing credits'
] as const;

export type ValidSegmentType = typeof VALID_SEGMENT_TYPES[number];

/**
 * Raw segment data from the AI before validation
 */
interface RawAISegment {
    startTime?: unknown;
    endTime?: unknown;
    confidence?: unknown;
    type?: unknown;
    description?: unknown;
    [key: string]: unknown; // Allow extra properties that we'll strip
}

/**
 * Validated segment data ready for conversion to AdSegment
 */
export interface ValidatedAISegment {
    startTime: string;
    endTime: string;
    confidence: number;
    type: ValidSegmentType;
    description: string;
}

/**
 * Sanitize JSON string to fix unquoted time values.
 * 
 * Sometimes the AI returns times like 15:10 without quotes, which breaks JSON.parse().
 * This function detects patterns like `: 15:10` or `: 1:23:45` and wraps them in quotes.
 * 
 * @example
 * // Fixes: {"startTime": 15:10, "endTime": 17:30}
 * // To:    {"startTime": "15:10", "endTime": "17:30"}
 */
export function sanitizeJsonTimestamps(jsonStr: string): string {
    // Match a colon (property separator) followed by optional whitespace,
    // then an unquoted time pattern (M:SS, MM:SS, H:MM:SS, or HH:MM:SS),
    // followed by a comma, closing brace, or closing bracket.
    // The negative lookbehind (?<!") ensures we don't match already-quoted values.
    // The negative lookahead (?!") ensures there's no closing quote immediately after.
    const unquotedTimePattern = /:\s*(?<!")(\d{1,2}:\d{2}(?::\d{2})?)(?!")(\s*[,}\]])/g;

    const sanitized = jsonStr.replace(unquotedTimePattern, ': "$1"$2');

    if (sanitized !== jsonStr) {
        console.warn('[AI] Detected and fixed unquoted time values in JSON response');
    }

    return sanitized;
}

/**
 * Validate a time string format (M:SS, MM:SS, H:MM:SS, or HH:MM:SS)
 */
function isValidTimeFormat(timeStr: string): boolean {
    if (!timeStr || typeof timeStr !== 'string') return false;
    const trimmed = timeStr.trim();
    // Match M:SS, MM:SS, H:MM:SS, HH:MM:SS
    return /^\d{1,2}:\d{2}(:\d{2})?$/.test(trimmed);
}

/**
 * Normalize a segment type string to a valid type.
 * Handles case-insensitive matching and trimming.
 * 
 * @returns The normalized type or null if invalid
 */
function normalizeSegmentType(type: unknown): ValidSegmentType | null {
    if (type === null || type === undefined) return null;
    if (typeof type !== 'string') return null;

    const trimmed = type.trim().toLowerCase();
    if (trimmed === '') return null;

    // Check if it matches any valid type (case-insensitive)
    const matchedType = VALID_SEGMENT_TYPES.find(
        validType => validType.toLowerCase() === trimmed
    );

    return matchedType || null;
}

/**
 * Normalize and clamp confidence to valid range [1, 100]
 */
function normalizeConfidence(confidence: unknown): number {
    let value: number;

    if (typeof confidence === 'number') {
        value = confidence;
    } else if (typeof confidence === 'string') {
        value = parseFloat(confidence);
    } else {
        // Default to 50 if missing or invalid type
        return 50;
    }

    if (isNaN(value)) {
        return 50;
    }

    // Round to integer and clamp to [1, 100]
    return Math.max(1, Math.min(100, Math.round(value)));
}

/**
 * Sanitize and validate an array of AI-generated segments.
 * 
 * This function:
 * - Trims whitespace from string fields
 * - Validates and normalizes segment types (case-insensitive)
 * - Validates time format
 * - Clamps confidence to valid range
 * - Filters out invalid segments
 * - Strips extra properties not in the schema
 * 
 * @param rawSegments Raw segment data from AI response
 * @returns Array of validated segments (invalid ones are filtered out)
 */
export function sanitizeAndValidateAISegments(rawSegments: unknown): ValidatedAISegment[] {
    // Handle non-array inputs
    if (!Array.isArray(rawSegments)) {
        console.warn('[AI] Expected array of segments, got:', typeof rawSegments);
        return [];
    }

    const validatedSegments: ValidatedAISegment[] = [];

    for (const raw of rawSegments as RawAISegment[]) {
        // Skip null/undefined entries
        if (!raw || typeof raw !== 'object') {
            console.debug('[AI] Skipping invalid segment entry:', raw);
            continue;
        }

        // Validate required fields exist
        if (raw.startTime === undefined || raw.startTime === null) {
            console.debug('[AI] Segment missing startTime, skipping:', raw);
            continue;
        }
        if (raw.endTime === undefined || raw.endTime === null) {
            console.debug('[AI] Segment missing endTime, skipping:', raw);
            continue;
        }
        if (raw.type === undefined || raw.type === null) {
            console.debug('[AI] Segment missing type, skipping:', raw);
            continue;
        }

        // Trim and validate time strings
        const startTime = String(raw.startTime).trim();
        const endTime = String(raw.endTime).trim();

        if (!isValidTimeFormat(startTime)) {
            console.debug('[AI] Invalid startTime format:', startTime);
            continue;
        }
        if (!isValidTimeFormat(endTime)) {
            console.debug('[AI] Invalid endTime format:', endTime);
            continue;
        }

        // Normalize and validate type
        const normalizedType = normalizeSegmentType(raw.type);
        if (!normalizedType) {
            console.debug('[AI] Invalid segment type:', raw.type);
            continue;
        }

        // Normalize confidence
        const confidence = normalizeConfidence(raw.confidence);

        // Handle description (optional, default to empty string)
        const description = raw.description !== undefined && raw.description !== null
            ? String(raw.description).trim()
            : '';

        // Create validated segment with only the expected properties
        validatedSegments.push({
            startTime,
            endTime,
            confidence,
            type: normalizedType,
            description
        });
    }

    if (validatedSegments.length < rawSegments.length) {
        console.warn(
            `[AI] Filtered out ${rawSegments.length - validatedSegments.length} invalid segments`
        );
    }

    return validatedSegments;
}

/**
 * Parse and validate a JSON string containing AI segment data.
 * 
 * This is the main entry point that combines:
 * 1. JSON sanitization (fixing unquoted times)
 * 2. JSON parsing
 * 3. Segment validation and normalization
 * 
 * @param jsonStr Raw JSON string from AI response
 * @returns Array of validated segments
 * @throws Error if JSON cannot be parsed even after sanitization
 */
export function parseAISegmentResponse(jsonStr: string): ValidatedAISegment[] {
    // First sanitize the JSON to fix common issues
    const sanitized = sanitizeJsonTimestamps(jsonStr);

    // Parse the JSON
    let parsed: unknown;
    try {
        parsed = JSON.parse(sanitized);
    } catch (error) {
        console.error('[AI] Failed to parse JSON after sanitization:', error);
        throw new Error(`Invalid JSON in AI response: ${(error as Error).message}`);
    }

    // Validate and normalize the segments
    return sanitizeAndValidateAISegments(parsed);
}

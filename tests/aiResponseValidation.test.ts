import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for JSON sanitization and AI response validation in aiResponseParser.ts
 * 
 * These tests cover:
 * 1. sanitizeJsonTimestamps - Fixing unquoted time values in JSON
 * 2. sanitizeAndValidateAISegments - Validating and cleaning AI-generated segment data
 */

import {
    sanitizeJsonTimestamps,
    sanitizeAndValidateAISegments,
    VALID_SEGMENT_TYPES,
} from '../src/services/aiResponseParser';

describe('JSON Timestamp Sanitization', () => {
    describe('sanitizeJsonTimestamps', () => {
        describe('Valid JSON (should not be modified)', () => {
            it('should not modify properly quoted time values', () => {
                const input = '{"startTime": "15:10", "endTime": "17:30"}';
                expect(sanitizeJsonTimestamps(input)).toBe(input);
            });

            it('should not modify properly quoted HH:MM:SS times', () => {
                const input = '{"startTime": "1:23:45", "endTime": "2:00:00"}';
                expect(sanitizeJsonTimestamps(input)).toBe(input);
            });

            it('should not modify a full valid segment array', () => {
                const input = JSON.stringify([{
                    startTime: "0:10",
                    endTime: "0:20",
                    confidence: 90,
                    type: "advertisement",
                    description: "Test Ad"
                }]);
                expect(sanitizeJsonTimestamps(input)).toBe(input);
            });

            it('should not modify empty arrays', () => {
                const input = '[]';
                expect(sanitizeJsonTimestamps(input)).toBe(input);
            });

            it('should not modify JSON with no time values', () => {
                const input = '{"name": "test", "value": 123}';
                expect(sanitizeJsonTimestamps(input)).toBe(input);
            });
        });

        describe('Unquoted time values (should be fixed)', () => {
            it('should fix unquoted MM:SS time value', () => {
                const input = '{"startTime": 15:10, "endTime": "17:30"}';
                const expected = '{"startTime": "15:10", "endTime": "17:30"}';
                expect(sanitizeJsonTimestamps(input)).toBe(expected);
            });

            it('should fix unquoted M:SS time value (single digit minutes)', () => {
                const input = '{"startTime": 5:30, "endTime": "7:00"}';
                const expected = '{"startTime": "5:30", "endTime": "7:00"}';
                expect(sanitizeJsonTimestamps(input)).toBe(expected);
            });

            it('should fix unquoted HH:MM:SS time value', () => {
                const input = '{"startTime": 1:23:45, "endTime": "2:00:00"}';
                const expected = '{"startTime": "1:23:45", "endTime": "2:00:00"}';
                expect(sanitizeJsonTimestamps(input)).toBe(expected);
            });

            it('should fix unquoted H:MM:SS time value (single digit hour)', () => {
                const input = '{"startTime": 0:05:30, "endTime": "1:00:00"}';
                const expected = '{"startTime": "0:05:30", "endTime": "1:00:00"}';
                expect(sanitizeJsonTimestamps(input)).toBe(expected);
            });

            it('should fix multiple unquoted time values in the same object', () => {
                const input = '{"startTime": 15:10, "endTime": 17:30}';
                const expected = '{"startTime": "15:10", "endTime": "17:30"}';
                expect(sanitizeJsonTimestamps(input)).toBe(expected);
            });

            it('should fix unquoted times in an array of segments', () => {
                const input = '[{"startTime": 0:10, "endTime": 0:20}, {"startTime": 5:00, "endTime": 6:30}]';
                const expected = '[{"startTime": "0:10", "endTime": "0:20"}, {"startTime": "5:00", "endTime": "6:30"}]';
                expect(sanitizeJsonTimestamps(input)).toBe(expected);
            });

            it('should fix unquoted times with extra whitespace', () => {
                const input = '{"startTime":  15:10 , "endTime":17:30}';
                const expected = '{"startTime": "15:10" , "endTime": "17:30"}';
                expect(sanitizeJsonTimestamps(input)).toBe(expected);
            });

            it('should fix times at the end of an object (before closing brace)', () => {
                const input = '{"startTime": 15:10}';
                const expected = '{"startTime": "15:10"}';
                expect(sanitizeJsonTimestamps(input)).toBe(expected);
            });

            it('should fix times at the end of an array element', () => {
                const input = '[{"time": 5:30}]';
                const expected = '[{"time": "5:30"}]';
                expect(sanitizeJsonTimestamps(input)).toBe(expected);
            });
        });

        describe('Edge cases and mixed scenarios', () => {
            it('should handle mixed quoted and unquoted times', () => {
                const input = '{"startTime": 15:10, "endTime": "17:30", "anotherTime": 20:00}';
                const expected = '{"startTime": "15:10", "endTime": "17:30", "anotherTime": "20:00"}';
                expect(sanitizeJsonTimestamps(input)).toBe(expected);
            });

            it('should not break numeric values that look like partial times', () => {
                // A number like 1530 should not be affected
                const input = '{"value": 1530, "time": "15:30"}';
                expect(sanitizeJsonTimestamps(input)).toBe(input);
            });

            it('should handle real-world malformed AI response', () => {
                const input = `[
                    {
                        "startTime": 0:00,
                        "endTime": 0:32,
                        "confidence": 100,
                        "type": "intro/outro",
                        "description": "Podcast intro"
                    },
                    {
                        "startTime": 2:00,
                        "endTime": 2:32,
                        "confidence": 95,
                        "type": "advertisement",
                        "description": "Factor meal delivery"
                    }
                ]`;

                const result = sanitizeJsonTimestamps(input);
                // Should be parseable now
                expect(() => JSON.parse(result)).not.toThrow();

                const parsed = JSON.parse(result);
                expect(parsed[0].startTime).toBe("0:00");
                expect(parsed[0].endTime).toBe("0:32");
                expect(parsed[1].startTime).toBe("2:00");
                expect(parsed[1].endTime).toBe("2:32");
            });
        });

        describe('Malformed/unrecoverable cases', () => {
            it('should not fix times without the property separator colon', () => {
                // This is malformed JSON that we can't reasonably fix
                const input = '{"startTime" 15:10}'; // Missing the : after key
                const result = sanitizeJsonTimestamps(input);
                // This should remain broken - we only fix the time values, not the JSON structure
                expect(() => JSON.parse(result)).toThrow();
            });

            it('should not affect values that are already strings but look like times', () => {
                // The time is in quotes, just testing we don't double-quote
                const input = '{"time": "15:10"}';
                expect(sanitizeJsonTimestamps(input)).toBe(input);
            });
        });
    });
});

describe('AI Segment Validation and Sanitization', () => {
    describe('sanitizeAndValidateAISegments', () => {
        describe('Valid segments (should pass through)', () => {
            it('should pass through a valid segment', () => {
                const input = [{
                    startTime: "0:10",
                    endTime: "0:20",
                    confidence: 90,
                    type: "advertisement" as const,
                    description: "Test Ad"
                }];

                const result = sanitizeAndValidateAISegments(input);
                expect(result).toHaveLength(1);
                expect(result[0]).toEqual(input[0]);
            });

            it('should pass through all valid segment types', () => {
                const validTypes = ['advertisement', 'self-promotion', 'intro/outro', 'closing credits'] as const;

                for (const type of validTypes) {
                    const result = sanitizeAndValidateAISegments([{
                        startTime: "1:00",
                        endTime: "2:00",
                        confidence: 80,
                        type,
                        description: `Test ${type}`
                    }]);
                    expect(result).toHaveLength(1);
                    expect(result[0].type).toBe(type);
                }
            });

            it('should return empty array for empty input', () => {
                expect(sanitizeAndValidateAISegments([])).toEqual([]);
            });
        });

        describe('Trimming whitespace', () => {
            it('should trim whitespace from startTime', () => {
                const result = sanitizeAndValidateAISegments([{
                    startTime: "  0:10  ",
                    endTime: "0:20",
                    confidence: 90,
                    type: "advertisement",
                    description: "Test"
                }]);
                expect(result[0].startTime).toBe("0:10");
            });

            it('should trim whitespace from endTime', () => {
                const result = sanitizeAndValidateAISegments([{
                    startTime: "0:10",
                    endTime: "  0:20\n",
                    confidence: 90,
                    type: "advertisement",
                    description: "Test"
                }]);
                expect(result[0].endTime).toBe("0:20");
            });

            it('should trim whitespace from type', () => {
                const result = sanitizeAndValidateAISegments([{
                    startTime: "0:10",
                    endTime: "0:20",
                    confidence: 90,
                    type: "  advertisement  " as any,
                    description: "Test"
                }]);
                expect(result[0].type).toBe("advertisement");
            });

            it('should trim whitespace from description', () => {
                const result = sanitizeAndValidateAISegments([{
                    startTime: "0:10",
                    endTime: "0:20",
                    confidence: 90,
                    type: "advertisement",
                    description: "  Test Ad  "
                }]);
                expect(result[0].description).toBe("Test Ad");
            });
        });

        describe('Invalid type handling', () => {
            it('should filter out segments with invalid type', () => {
                const result = sanitizeAndValidateAISegments([{
                    startTime: "0:10",
                    endTime: "0:20",
                    confidence: 90,
                    type: "sponsor" as any, // Invalid type
                    description: "Test"
                }]);
                expect(result).toHaveLength(0);
            });

            it('should filter out segments with empty type', () => {
                const result = sanitizeAndValidateAISegments([{
                    startTime: "0:10",
                    endTime: "0:20",
                    confidence: 90,
                    type: "" as any,
                    description: "Test"
                }]);
                expect(result).toHaveLength(0);
            });

            it('should filter out segments with null/undefined type', () => {
                const result = sanitizeAndValidateAISegments([{
                    startTime: "0:10",
                    endTime: "0:20",
                    confidence: 90,
                    type: null as any,
                    description: "Test"
                }]);
                expect(result).toHaveLength(0);
            });

            it('should handle case-insensitive type values and normalize them', () => {
                const result = sanitizeAndValidateAISegments([{
                    startTime: "0:10",
                    endTime: "0:20",
                    confidence: 90,
                    type: "ADVERTISEMENT" as any,
                    description: "Test"
                }]);
                expect(result).toHaveLength(1);
                expect(result[0].type).toBe("advertisement");
            });

            it('should handle "Advertisement" with capital A', () => {
                const result = sanitizeAndValidateAISegments([{
                    startTime: "0:10",
                    endTime: "0:20",
                    confidence: 90,
                    type: "Advertisement" as any,
                    description: "Test"
                }]);
                expect(result).toHaveLength(1);
                expect(result[0].type).toBe("advertisement");
            });

            it('should handle "Self-Promotion" with capitals', () => {
                const result = sanitizeAndValidateAISegments([{
                    startTime: "0:10",
                    endTime: "0:20",
                    confidence: 90,
                    type: "Self-Promotion" as any,
                    description: "Test"
                }]);
                expect(result).toHaveLength(1);
                expect(result[0].type).toBe("self-promotion");
            });
        });

        describe('Invalid time format handling', () => {
            it('should filter out segments with invalid startTime format', () => {
                const result = sanitizeAndValidateAISegments([{
                    startTime: "invalid",
                    endTime: "0:20",
                    confidence: 90,
                    type: "advertisement",
                    description: "Test"
                }]);
                expect(result).toHaveLength(0);
            });

            it('should filter out segments with invalid endTime format', () => {
                const result = sanitizeAndValidateAISegments([{
                    startTime: "0:10",
                    endTime: "not-a-time",
                    confidence: 90,
                    type: "advertisement",
                    description: "Test"
                }]);
                expect(result).toHaveLength(0);
            });

            it('should filter out segments with empty startTime', () => {
                const result = sanitizeAndValidateAISegments([{
                    startTime: "",
                    endTime: "0:20",
                    confidence: 90,
                    type: "advertisement",
                    description: "Test"
                }]);
                expect(result).toHaveLength(0);
            });

            it('should filter out segments with null/undefined times', () => {
                const result = sanitizeAndValidateAISegments([{
                    startTime: null as any,
                    endTime: "0:20",
                    confidence: 90,
                    type: "advertisement",
                    description: "Test"
                }]);
                expect(result).toHaveLength(0);
            });

            it('should accept 0:00 as a valid time', () => {
                const result = sanitizeAndValidateAISegments([{
                    startTime: "0:00",
                    endTime: "0:30",
                    confidence: 90,
                    type: "advertisement",
                    description: "Test"
                }]);
                expect(result).toHaveLength(1);
                expect(result[0].startTime).toBe("0:00");
            });
        });

        describe('Invalid confidence handling', () => {
            it('should clamp confidence above 100 to 100', () => {
                const result = sanitizeAndValidateAISegments([{
                    startTime: "0:10",
                    endTime: "0:20",
                    confidence: 150,
                    type: "advertisement",
                    description: "Test"
                }]);
                expect(result[0].confidence).toBe(100);
            });

            it('should clamp confidence below 1 to 1', () => {
                const result = sanitizeAndValidateAISegments([{
                    startTime: "0:10",
                    endTime: "0:20",
                    confidence: -10,
                    type: "advertisement",
                    description: "Test"
                }]);
                expect(result[0].confidence).toBe(1);
            });

            it('should round floating point confidence to integer', () => {
                const result = sanitizeAndValidateAISegments([{
                    startTime: "0:10",
                    endTime: "0:20",
                    confidence: 85.7,
                    type: "advertisement",
                    description: "Test"
                }]);
                expect(result[0].confidence).toBe(86);
            });

            it('should handle confidence as string and convert to number', () => {
                const result = sanitizeAndValidateAISegments([{
                    startTime: "0:10",
                    endTime: "0:20",
                    confidence: "90" as any,
                    type: "advertisement",
                    description: "Test"
                }]);
                expect(result[0].confidence).toBe(90);
            });

            it('should default to 50 if confidence is NaN', () => {
                const result = sanitizeAndValidateAISegments([{
                    startTime: "0:10",
                    endTime: "0:20",
                    confidence: "not a number" as any,
                    type: "advertisement",
                    description: "Test"
                }]);
                expect(result[0].confidence).toBe(50);
            });

            it('should default to 50 if confidence is missing', () => {
                const result = sanitizeAndValidateAISegments([{
                    startTime: "0:10",
                    endTime: "0:20",
                    type: "advertisement",
                    description: "Test"
                } as any]);
                expect(result[0].confidence).toBe(50);
            });
        });

        describe('Missing/extra properties handling', () => {
            it('should filter out segments missing startTime', () => {
                const result = sanitizeAndValidateAISegments([{
                    endTime: "0:20",
                    confidence: 90,
                    type: "advertisement",
                    description: "Test"
                } as any]);
                expect(result).toHaveLength(0);
            });

            it('should filter out segments missing endTime', () => {
                const result = sanitizeAndValidateAISegments([{
                    startTime: "0:10",
                    confidence: 90,
                    type: "advertisement",
                    description: "Test"
                } as any]);
                expect(result).toHaveLength(0);
            });

            it('should filter out segments missing type', () => {
                const result = sanitizeAndValidateAISegments([{
                    startTime: "0:10",
                    endTime: "0:20",
                    confidence: 90,
                    description: "Test"
                } as any]);
                expect(result).toHaveLength(0);
            });

            it('should use empty string if description is missing', () => {
                const result = sanitizeAndValidateAISegments([{
                    startTime: "0:10",
                    endTime: "0:20",
                    confidence: 90,
                    type: "advertisement"
                } as any]);
                expect(result).toHaveLength(1);
                expect(result[0].description).toBe("");
            });

            it('should strip extra properties not in the schema', () => {
                const result = sanitizeAndValidateAISegments([{
                    startTime: "0:10",
                    endTime: "0:20",
                    confidence: 90,
                    type: "advertisement",
                    description: "Test",
                    extraField: "should be removed",
                    anotherExtra: 123
                } as any]);

                expect(result).toHaveLength(1);
                expect(result[0]).toEqual({
                    startTime: "0:10",
                    endTime: "0:20",
                    confidence: 90,
                    type: "advertisement",
                    description: "Test"
                });
                expect((result[0] as any).extraField).toBeUndefined();
                expect((result[0] as any).anotherExtra).toBeUndefined();
            });
        });

        describe('Mixed valid and invalid segments', () => {
            it('should keep valid segments and filter out invalid ones', () => {
                const result = sanitizeAndValidateAISegments([
                    {
                        startTime: "0:10",
                        endTime: "0:20",
                        confidence: 90,
                        type: "advertisement",
                        description: "Valid Ad"
                    },
                    {
                        startTime: "invalid",
                        endTime: "0:40",
                        confidence: 90,
                        type: "advertisement",
                        description: "Invalid - bad startTime"
                    },
                    {
                        startTime: "1:00",
                        endTime: "1:30",
                        confidence: 80,
                        type: "sponsor" as any, // Invalid type
                        description: "Invalid - bad type"
                    },
                    {
                        startTime: "2:00",
                        endTime: "2:30",
                        confidence: 95,
                        type: "self-promotion",
                        description: "Valid Self-Promotion"
                    }
                ]);

                expect(result).toHaveLength(2);
                expect(result[0].description).toBe("Valid Ad");
                expect(result[1].description).toBe("Valid Self-Promotion");
            });
        });

        describe('Non-array input handling', () => {
            it('should return empty array for null input', () => {
                expect(sanitizeAndValidateAISegments(null as any)).toEqual([]);
            });

            it('should return empty array for undefined input', () => {
                expect(sanitizeAndValidateAISegments(undefined as any)).toEqual([]);
            });

            it('should return empty array for object input (not array)', () => {
                expect(sanitizeAndValidateAISegments({} as any)).toEqual([]);
            });

            it('should return empty array for string input', () => {
                expect(sanitizeAndValidateAISegments("not an array" as any)).toEqual([]);
            });
        });
    });

    describe('VALID_SEGMENT_TYPES constant', () => {
        it('should contain all expected segment types', () => {
            expect(VALID_SEGMENT_TYPES).toContain('advertisement');
            expect(VALID_SEGMENT_TYPES).toContain('self-promotion');
            expect(VALID_SEGMENT_TYPES).toContain('intro/outro');
            expect(VALID_SEGMENT_TYPES).toContain('closing credits');
        });

        it('should have exactly 4 valid types', () => {
            expect(VALID_SEGMENT_TYPES).toHaveLength(4);
        });
    });
});

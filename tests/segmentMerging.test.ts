import { describe, it, expect } from 'vitest';
import { mergeCloseAdSegments } from '../src/services/skippableSegments';
import type { AdSegment } from '../src/types';

describe('Ad Segment Merging', () => {
    function createSegment(start: number, end: number, type: AdSegment['type'] = 'advertisement', description = 'Ad'): AdSegment {
        // Simple mock, converting seconds to "MM:SS" roughly
        const format = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
        return {
            startTimeSeconds: start,
            endTimeSeconds: end,
            startTime: format(start),
            endTime: format(end),
            type,
            confidence: 90,
            description
        };
    }

    it('should stay empty if empty input', () => {
        expect(mergeCloseAdSegments([])).toEqual([]);
    });

    it('should return single segment as is', () => {
        const seg = createSegment(0, 10);
        expect(mergeCloseAdSegments([seg])).toEqual([seg]);
    });

    it('should merge two advertisements with small gap (<8s)', () => {
        const ad1 = createSegment(0, 10, 'advertisement', 'Ad 1');
        const ad2 = createSegment(15, 25, 'advertisement', 'Ad 2'); // Gap = 5s

        const result = mergeCloseAdSegments([ad1, ad2]);

        expect(result).toHaveLength(1);
        expect(result[0].startTimeSeconds).toBe(0);
        expect(result[0].endTimeSeconds).toBe(25);
        expect(result[0].description).toContain('Ad 1');
        expect(result[0].description).toContain('Ad 2');
    });

    it('should NOT merge advertisements with large gap (>=8s)', () => {
        const ad1 = createSegment(0, 10);
        const ad2 = createSegment(18, 28); // Gap = 8s

        const result = mergeCloseAdSegments([ad1, ad2]);

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual(ad1);
        expect(result[1]).toEqual(ad2);
    });

    it('should NOT merge if types are different', () => {
        const ad1 = createSegment(0, 10, 'advertisement');
        const promo = createSegment(15, 25, 'self-promotion'); // Gap = 5s

        const result = mergeCloseAdSegments([ad1, promo]);

        expect(result).toHaveLength(2);
        expect(result[0].type).toBe('advertisement');
        expect(result[1].type).toBe('self-promotion');
    });

    it('should merge chain of close advertisements', () => {
        const ad1 = createSegment(0, 10);
        const ad2 = createSegment(15, 25); // Gap 5s
        const ad3 = createSegment(30, 40); // Gap 5s from ad2

        const result = mergeCloseAdSegments([ad1, ad2, ad3]);

        expect(result).toHaveLength(1);
        expect(result[0].startTimeSeconds).toBe(0);
        expect(result[0].endTimeSeconds).toBe(40);
    });

    it('should handle complex sequence', () => {
        // Ad1 - (merge) - Ad2 - (gap) - Promo - (gap) - Ad3
        const ad1 = createSegment(0, 10);
        const ad2 = createSegment(15, 25);
        const promo = createSegment(40, 50, 'self-promotion');
        const ad3 = createSegment(55, 65);

        const result = mergeCloseAdSegments([ad1, ad2, promo, ad3]);

        expect(result).toHaveLength(3);
        expect(result[0].endTimeSeconds).toBe(25); // Merged Ad1+Ad2
        expect(result[1].type).toBe('self-promotion');
        expect(result[2].startTimeSeconds).toBe(55);
    });
});

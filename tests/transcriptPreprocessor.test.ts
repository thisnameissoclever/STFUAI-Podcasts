import { describe, it, expect } from 'vitest';
import { preprocessTranscript } from '../src/services/transcriptPreprocessor';
import type { Transcript } from '../src/types';
import fs from 'fs';
import path from 'path';

// Load sample transcript directly
const sampleTranscriptPath = path.resolve(__dirname, 'assets/sample_transcript.json');
const sampleTranscript = JSON.parse(fs.readFileSync(sampleTranscriptPath, 'utf8'));

describe('Transcript Pre-processor (Smart Timestamps)', () => {

    // Mock transcript for specific rule testing
    const createMockTranscript = (words: any[]): Transcript => ({
        episodeId: 1,
        text: 'Full text',
        segments: [{
            id: 0,
            start: 0,
            end: 100,
            text: 'Segment text',
            words: words,
            speaker: 'Host'
        }],
        language: 'en',
        duration: 100,
        createdAt: 0
    });

    it('should inject timestamp at the very beginning', () => {
        const transcript = createMockTranscript([
            { word: "Hello", startTime: 0.5, endTime: 1.0, speaker: "Host" },
            { word: "World", startTime: 1.2, endTime: 1.5, speaker: "Host" }
        ]);

        const result = preprocessTranscript(transcript);
        // Expect: [0:00] (Host): Hello World
        expect(result).toContain('[0:00]');
        expect(result).toContain('(Host):');
        expect(result).toContain('Hello');
    });

    it('should inject timestamp when speaker changes', () => {
        const transcript = createMockTranscript([
            { word: "Hello", startTime: 10.0, endTime: 10.5, speaker: "Host" },
            { word: "Hi", startTime: 12.0, endTime: 12.5, speaker: "Guest" }
        ]);

        const result = preprocessTranscript(transcript);
        // Expect: ...Hello \n[0:12] (Guest): Hi
        expect(result).toMatch(/Hello/);
        expect(result).toMatch(/\[0:12\] \(Guest\): Hi/);
    });

    it('should inject timestamp at new sentence start', () => {
        const transcript = createMockTranscript([
            { word: "Hello.", startTime: 10.0, endTime: 10.5, speaker: "Host" },
            { word: "New", startTime: 11.0, endTime: 11.5, speaker: "Host" },
            { word: "Sentence", startTime: 11.6, endTime: 12.0, speaker: "Host" }
        ]);

        const result = preprocessTranscript(transcript);
        // Expect: ...Hello. [0:11] New Sentence
        // [0:11] should appear before "New" because "Hello." ended with period
        expect(result).toMatch(/Hello\./);
        expect(result).toMatch(/\[0:11\] New/);
    });

    it('should inject timestamp after 3 second gap', () => {
        const transcript = createMockTranscript([
            { word: "Gap", startTime: 10.0, endTime: 10.5, speaker: "Host" },
            // Gap of 4 seconds (10.0 to 14.1)
            { word: "After", startTime: 14.1, endTime: 14.5, speaker: "Host" }
        ]);

        const result = preprocessTranscript(transcript);
        // Expect: ...Gap [0:14] After
        // (Note: first word 'Gap' gets timestamp [0:10], next one needs one due to gap)
        expect(result).toContain('[0:10]');
        expect(result).toContain('[0:14]');
    });

    it('should inject timestamp after 3 words (fallback)', () => {
        const words = [];
        for (let i = 0; i < 5; i++) {
            words.push({
                word: `Word${i}`,
                startTime: 10 + (i * 0.1),
                endTime: 10 + (i * 0.1) + 0.05,
                speaker: "Host"
            });
        }
        const transcript = createMockTranscript(words);

        const result = preprocessTranscript(transcript);
        // Expect at least two timestamps: one at start, one after 3rd word
        const timestampMatches = result.match(/\[\d+:\d+\]/g);
        expect(timestampMatches?.length).toBeGreaterThanOrEqual(2);
    });

    it('should process the real sample transcript effectively', () => {
        // This is a smoke test using the real heavy file
        const result = preprocessTranscript(sampleTranscript);

        // Assert basic structure
        expect(result.length).toBeGreaterThan(0);
        // Should be much smaller than the original JSON stringified
        expect(result.length).toBeLessThan(JSON.stringify(sampleTranscript).length);

        // Check for expected markers from the known content
        // "Picture trying to cook..." starts at 1.12 -> [0:01]
        expect(result).toContain('[0:01]');
        expect(result).toContain('(Advertiser):');

        // Check for multiple timestamps (it's a long transcript)
        const timestampMatches = result.match(/\[\d+:\d+\]/g);
        expect(timestampMatches?.length).toBeGreaterThan(10);

        console.log(`Original JSON size: ${JSON.stringify(sampleTranscript).length} chars`);
        console.log(`Processed Text size: ${result.length} chars`);
        console.log(`Reduction: ${Math.round((1 - result.length / JSON.stringify(sampleTranscript).length) * 100)}%`);
    });
});

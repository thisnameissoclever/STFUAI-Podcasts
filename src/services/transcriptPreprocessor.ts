/**
 * Transcript Pre-processor for AI
 * 
 * Compresses detailed JSON transcripts into a token-efficient plain text format
 * with smart inline timestamps for precision.
 */

import type { Transcript } from '../types';

/**
 * Format seconds to MM:SS string
 */
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
 * Check if the word ends with a sentence-ending punctuation.
 * Checks for '.', '!', '?' at the end of the word.
 */
function isEndOfSentence(word: string): boolean {
    if (!word) return false;
    const lastChar = word.trim().slice(-1);
    return ['.', '!', '?'].includes(lastChar);
}

/**
 * Pre-process a transcript into a token-efficient text format with inline timestamps.
 * 
 * Rules for inserting `[MM:SS]`:
 * 1. Speaker Change: The speaker is different from the previous word.
 * 2. Sentence Start: The previous word ended with a sentence-ending punctuation.
 * 3. Time Gap: >3 seconds since the last timestamped word.
 * 4. Word Count: >10 words since the last timestamp (fallback).
 */
export function preprocessTranscript(transcript: Transcript): string {
    if (!transcript.segments || transcript.segments.length === 0) {
        return '';
    }

    let output = '';
    let lastSpeaker = '';
    let lastTimestampSeconds = -1;
    let wordCountSinceTimestamp = 0;
    let lastWordEndedSentence = true; // Assume start of transcript is start of sentence

    // Flatten segments into a single stream of words if possible
    // Note: AssemblyAI transcripts have a 'words' array in each segment.
    // Use nested loops to iterate through the logical stream.

    for (const segment of transcript.segments) {
        // Some segments might not have words (rare but possible), fallback to segment text
        if (!segment.words || segment.words.length === 0) {
            // Fallback handling for segments without word-level data
            // Just treat the whole segment as a block
            const timestamp = formatTime(segment.start);
            const speakerLabel = segment.speaker && segment.speaker !== lastSpeaker
                ? ` (${segment.speaker}):`
                : '';

            output += `[${timestamp}]${speakerLabel} ${segment.text}\n`;
            lastSpeaker = segment.speaker || '';
            lastTimestampSeconds = segment.start;
            wordCountSinceTimestamp = 0;
            lastWordEndedSentence = true;
            continue;
        }

        for (const wordObj of segment.words) {
            const currentSpeaker = wordObj.speaker || segment.speaker || 'Unknown';
            const currentTime = wordObj.startTime;

            let shouldInsertTimestamp = false;

            // 1. Speaker Change
            if (currentSpeaker !== lastSpeaker) {
                shouldInsertTimestamp = true;
            }

            // 2. Sentence Start (Previous word ended sentence)
            else if (lastWordEndedSentence) {
                shouldInsertTimestamp = true;
            }

            // 3. Time Gap (>3s)
            else if (currentTime - lastTimestampSeconds >= 3) {
                shouldInsertTimestamp = true;
            }

            // 4. Word Count (Every 3 words)
            else if (wordCountSinceTimestamp >= 3) {
                shouldInsertTimestamp = true;
            }

            if (shouldInsertTimestamp) {
                const timestamp = formatTime(currentTime);
                // Only add speaker label if it changed or it's the very first line
                // or if we want to reinforce it periodically? 
                // The requirement is "Every time the speaker changes".
                // Let's also add it if we are starting a new block after a newline (implied by this logic?)
                // Actually, let's keep it simple: [MM:SS] (Speaker): Word
                // But only add (Speaker): if it Changed.

                if (currentSpeaker !== lastSpeaker) {
                    // double newline for speaker change to make it readable? 
                    // Or just inline? Inline saves tokens.
                    // Let's add a space before the timestamp if it's not the start
                    const prefix = output.length > 0 ? '\n' : '';
                    output += `${prefix}[${timestamp}] (${currentSpeaker}): `;
                } else {
                    const prefix = output.length > 0 ? ' ' : '';
                    output += `${prefix}[${timestamp}]`;
                    // Add a space after timestamp if continuing same speaker
                    output += ' ';
                }

                lastTimestampSeconds = currentTime;
                lastSpeaker = currentSpeaker;
                wordCountSinceTimestamp = 0;
            } else {
                // Just add a space
                output += ' ';
            }

            output += wordObj.word;
            wordCountSinceTimestamp++;
            lastWordEndedSentence = isEndOfSentence(wordObj.word);
        }
    }

    return output.trim();
}

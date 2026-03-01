"use server";

import { speechClient } from '../_utils/speech-to-text';

export interface WordTimestamp {
  word: string;
  startSeconds: number;
  endSeconds: number;
  confidence: number;
}

export interface SpeechToTextResult {
  success: boolean;
  words?: WordTimestamp[];
  transcript?: string;
  error?: string;
}

/**
 * Process audio file with GCP Speech-to-Text API
 * Returns words with timestamps for lyrics synchronization
 */
export async function processAudioWithSpeechToText(
  audioUri: string
): Promise<SpeechToTextResult> {
  try {
    console.log('🎙️ Processing audio with Speech-to-Text:', audioUri);

    // Configure request for Japanese audio with word timestamps
    const request = {
      config: {
        // Let GCP auto-detect encoding for better compatibility
        encoding: 'FLAC' as const,
        sampleRateHertz: 16000, // Explicit sample rate for FLAC
        languageCode: 'ja-JP',
        model: 'latest_long', // Best for music/long audio
        enableWordTimeOffsets: true,
        enableAutomaticPunctuation: true,
        useEnhanced: true, // Better accuracy for complex audio
        maxAlternatives: 1,
      },
      audio: {
        uri: audioUri,
      },
    };

    console.log('📡 Sending request to Speech-to-Text API...');
    const [response] = await speechClient.recognize(request);

    if (!response.results || response.results.length === 0) {
      return {
        success: false,
        error: 'No transcription results returned from Speech-to-Text API',
      };
    }

    // Extract words with timestamps from all results
    const words: WordTimestamp[] = [];
    let fullTranscript = '';

    for (const result of response.results) {
      const alternative = result.alternatives?.[0];
      if (!alternative) continue;

      fullTranscript += alternative.transcript || '';

      if (alternative.words) {
        for (const wordInfo of alternative.words) {
          // Parse time structure ({seconds: string, nanos: number})
          const startSeconds = parseTimeObject(wordInfo.startTime);
          const endSeconds = parseTimeObject(wordInfo.endTime);

          if (wordInfo.word && startSeconds !== null && endSeconds !== null) {
            words.push({
              word: wordInfo.word,
              startSeconds,
              endSeconds,
              confidence: wordInfo.confidence || 0.0,
            });
          }
        }
      }
    }

    console.log('✅ Speech-to-Text processing complete');
    console.log(`📊 Results: ${words.length} words, ${fullTranscript.length} chars transcript`);

    return {
      success: true,
      words,
      transcript: fullTranscript,
    };

  } catch (error) {
    console.error('❌ Speech-to-Text processing error:', error);
    
    let errorMessage = 'Unknown error during audio processing';
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Parse GCP time object format to seconds as number
 * Handles IDuration which can have seconds as string | number | Long | null
 */
function parseTimeObject(timeObj: any): number | null {
  if (!timeObj) return null;
  
  let seconds = 0;
  if (typeof timeObj.seconds === 'string') {
    seconds = parseInt(timeObj.seconds, 10);
  } else if (typeof timeObj.seconds === 'number') {
    seconds = timeObj.seconds;
  } else if (timeObj.seconds && typeof timeObj.seconds === 'object') {
    // Handle Long type
    seconds = Number(timeObj.seconds);
  }
  
  const nanos = timeObj.nanos || 0;
  
  // Convert nanoseconds to seconds and add to seconds
  return seconds + (nanos / 1000000000);
}

/**
 * Parse GCP duration format (e.g., "1.234s") to seconds as number
 * (Legacy function - kept for backward compatibility)
 */
function parseDuration(duration: string | undefined): number | null {
  if (!duration) return null;
  
  // Remove 's' suffix and parse as float
  const secondsStr = duration.replace('s', '');
  const seconds = parseFloat(secondsStr);
  
  return isNaN(seconds) ? null : seconds;
}

/**
 * Process longer audio files using BatchRecognize (for files > 60 seconds)
 * This is asynchronous and requires polling for completion
 */
export async function processLongAudioWithSpeechToText(
  audioUri: string
): Promise<SpeechToTextResult> {
  try {
    console.log('🎙️ Processing long audio with BatchRecognize:', audioUri);

    // For batch recognition, we need to use the v2 API (if available)
    // For now, let's use the regular recognize method with longer timeout
    // In production, you might want to implement proper BatchRecognize
    
    return processAudioWithSpeechToText(audioUri);
    
  } catch (error) {
    console.error('❌ Long audio processing error:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during long audio processing',
    };
  }
}

interface AlignmentResult {
  success: boolean;
  alignedLines?: Array<{
    lineId: string;
    position: number;
    originalText: string;
    matchedWords: Array<{
      word: string;
      startTime: number;
      endTime: number;
      confidence: number;
    }>;
    startTime: number;
    endTime: number;
    confidence: number;
  }>;
  error?: string;
}

/**
 * Aligns lyrics lines with speech recognition word timestamps
 */
export async function alignLyricsWithSpeech(
  songId: string,
  audioUri: string,
  languageId?: string
): Promise<AlignmentResult> {
  try {
    console.log('🎯 Starting lyrics alignment for song:', songId);
    
    // Import getLyrics function
    const { getLyrics } = await import('./lyrics');
    
    // Get audio word timestamps
    const speechResult = await processAudioWithSpeechToText(audioUri);
    
    if (!speechResult.success || !speechResult.words) {
      return {
        success: false,
        error: speechResult.error || 'Failed to extract word timestamps from audio'
      };
    }
    
    // Get lyrics for the song
    const lyricsArray = await getLyrics(songId);
    
    if (lyricsArray.length === 0) {
      return {
        success: false,
        error: 'No lyrics found for this song'
      };
    }
    
    // Use the first lyrics version (or find by languageId if provided)
    const lyrics = lyricsArray[0];
    
    console.log(`📝 Found ${lyrics.lines.length} lyrics lines`);
    console.log(`🎵 Extracted ${speechResult.words.length} word timestamps`);
    
    // Normalize and align lyrics with word timestamps
    const alignedLines = alignLyricsWithWordTimestamps(
      lyrics.lines,
      speechResult.words,
      languageId
    );
    
    console.log(`✅ Aligned ${alignedLines.length} lines successfully`);
    
    return {
      success: true,
      alignedLines
    };
    
  } catch (error) {
    console.error('❌ Lyrics alignment error:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during lyrics alignment'
    };
  }
}

/**
 * Normalize text for comparison (remove punctuation, convert to lowercase)
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Calculate similarity between two strings using simple word matching
 */
function calculateSimilarity(text1: string, text2: string): number {
  const words1 = normalizeText(text1).split(' ');
  const words2 = normalizeText(text2).split(' ');
  
  if (words1.length === 0 && words2.length === 0) return 1.0;
  if (words1.length === 0 || words2.length === 0) return 0.0;
  
  const commonWords = words1.filter(word => words2.includes(word));
  
  return (commonWords.length * 2) / (words1.length + words2.length);
}

/**
 * Align lyrics lines with word timestamps using sliding window approach
 */
function alignLyricsWithWordTimestamps(
  lyricsLines: any[],
  wordTimestamps: Array<{
    word: string;
    startSeconds: number;
    endSeconds: number;
    confidence: number;
  }>,
  languageId?: string
): Array<{
  lineId: string;
  position: number;
  originalText: string;
  matchedWords: Array<{
    word: string;
    startTime: number;
    endTime: number;
    confidence: number;
  }>;
  startTime: number;
  endTime: number;
  confidence: number;
}> {
  const alignedLines: any[] = [];
  let currentWordIndex = 0;
  
  for (const line of lyricsLines) {
    // Get the text for the specified language (or first available)
    const lineText = languageId 
      ? line.texts.find((t: any) => t.languageId === languageId)?.text
      : line.texts[0]?.text;
    
    if (!lineText) continue;
    
    const normalizedLineText = normalizeText(lineText);
    const lineWords = normalizedLineText.split(' ').filter(word => word.length > 0);
    
    if (lineWords.length === 0) continue;
    
    // Find best matching sequence of words
    let bestMatch = {
      words: [] as any[],
      startIndex: currentWordIndex,
      endIndex: currentWordIndex,
      confidence: 0
    };
    
    // Try different window sizes and positions
    const maxWindowSize = Math.min(lineWords.length + 3, 10); // Allow some flexibility
    
    for (let windowSize = Math.max(1, lineWords.length - 2); windowSize <= maxWindowSize; windowSize++) {
      for (let startIdx = Math.max(0, currentWordIndex - 2); 
           startIdx <= Math.min(wordTimestamps.length - windowSize, currentWordIndex + 2); 
           startIdx++) {
        
        const windowWords = wordTimestamps.slice(startIdx, startIdx + windowSize);
        const windowText = windowWords.map(w => normalizeText(w.word)).join(' ');
        
        const similarity = calculateSimilarity(normalizedLineText, windowText);
        
        if (similarity > bestMatch.confidence) {
          bestMatch = {
            words: windowWords,
            startIndex: startIdx,
            endIndex: startIdx + windowSize - 1,
            confidence: similarity
          };
        }
      }
    }
    
    // Only accept matches with reasonable confidence
    if (bestMatch.confidence >= 0.3 && bestMatch.words.length > 0) {
      const matchedWords = bestMatch.words.map(w => ({
        word: w.word,
        startTime: w.startSeconds,
        endTime: w.endSeconds,
        confidence: w.confidence
      }));
      
      const startTime = matchedWords[0].startTime;
      const endTime = matchedWords[matchedWords.length - 1].endTime;
      
      alignedLines.push({
        lineId: line.id,
        position: line.position,
        originalText: lineText,
        matchedWords,
        startTime,
        endTime,
        confidence: bestMatch.confidence
      });
      
      // Move the current position forward
      currentWordIndex = Math.max(currentWordIndex, bestMatch.endIndex + 1);
      
      console.log(`🎯 Aligned line ${line.position}: "${lineText}" (${startTime.toFixed(2)}s-${endTime.toFixed(2)}s, conf: ${bestMatch.confidence.toFixed(2)})`);
    } else {
      console.log(`⚠️ Could not align line ${line.position}: "${lineText}" (best conf: ${bestMatch.confidence.toFixed(2)})`);
    }
  }
  
  return alignedLines;
}

/**
 * Save synchronized lyrics timestamps to database
 */
export async function saveSynchronizedLyrics(
  songId: string,
  alignedLines: Array<{
    lineId: string;
    position: number;
    startTime: number;
    endTime: number;
  }>
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('💾 Saving synchronized lyrics to database...');
    
    const { connectToDatabase } = await import('@/db');
    const { lyrics_lines } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');
    
    const db = connectToDatabase();
    
    // Update each aligned line with new timestamps
    await db.transaction(async (tx) => {
      for (const line of alignedLines) {
        await tx
          .update(lyrics_lines)
          .set({ 
            start: line.startTime.toString(),
            end: line.endTime.toString() 
          })
          .where(eq(lyrics_lines.id, line.lineId));
        
        console.log(`✅ Updated line ${line.position}: ${line.startTime.toFixed(2)}s-${line.endTime.toFixed(2)}s`);
      }
    });
    
    console.log(`💾 Successfully saved ${alignedLines.length} synchronized lyrics`);
    
    return { success: true };
    
  } catch (error) {
    console.error('❌ Error saving synchronized lyrics:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error saving synchronized lyrics'
    };
  }
}

/**
 * Complete workflow: Process audio, align with lyrics, and save timestamps
 */
export async function synchronizeLyricsWithAudio(
  songId: string,
  audioUri: string,
  languageId?: string,
  saveToDatabase: boolean = true
): Promise<{
  success: boolean;
  alignedLines?: any[];
  savedCount?: number;
  error?: string;
}> {
  try {
    console.log('🎵 Starting complete lyrics synchronization workflow...');
    
    // Step 1: Align lyrics with speech recognition
    const alignmentResult = await alignLyricsWithSpeech(songId, audioUri, languageId);
    
    if (!alignmentResult.success || !alignmentResult.alignedLines) {
      return {
        success: false,
        error: alignmentResult.error || 'Alignment failed'
      };
    }
    
    // Step 2: Save to database if requested
    let savedCount = 0;
    if (saveToDatabase) {
      const saveResult = await saveSynchronizedLyrics(
        songId,
        alignmentResult.alignedLines.map(line => ({
          lineId: line.lineId,
          position: line.position,
          startTime: line.startTime,
          endTime: line.endTime
        }))
      );
      
      if (!saveResult.success) {
        return {
          success: false,
          error: saveResult.error || 'Failed to save synchronized lyrics'
        };
      }
      
      savedCount = alignmentResult.alignedLines.length;
    }
    
    console.log('🎯 Lyrics synchronization completed successfully!');
    
    return {
      success: true,
      alignedLines: alignmentResult.alignedLines,
      savedCount
    };
    
  } catch (error) {
    console.error('❌ Complete synchronization error:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during complete synchronization'
    };
  }
}
import { processAudioWithSpeechToText } from './app/actions/speech-to-text';

// Mock lyrics data for testing
const mockLyricsLines = [
  {
    id: 'line1',
    position: 1,
    start: '0',
    end: '0',
    texts: [
      {
        id: 'text1',
        languageId: 'en',
        text: 'How old'
      }
    ]
  },
  {
    id: 'line2',
    position: 2,
    start: '0',
    end: '0',
    texts: [
      {
        id: 'text2',
        languageId: 'en',
        text: 'the brother'
      }
    ]
  }
];

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
 * Test version of lyrics alignment
 */
function testAlignLyricsWithWordTimestamps(
  lyricsLines: any[],
  wordTimestamps: Array<{
    word: string;
    startSeconds: number;
    endSeconds: number;
    confidence: number;
  }>
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
    const lineText = line.texts[0]?.text;
    
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
    const maxWindowSize = Math.min(lineWords.length + 3, 10);
    
    for (let windowSize = Math.max(1, lineWords.length - 1); windowSize <= maxWindowSize; windowSize++) {
      for (let startIdx = Math.max(0, currentWordIndex - 1); 
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

async function testLyricsSynchronization() {
  console.log('🧪 Testing lyrics synchronization algorithm...');
  
  try {
    // Step 1: Get audio word timestamps
    const testAudioUri = 'gs://cloud-samples-data/speech/audio.flac';
    
    console.log('🎙️ Getting word timestamps from audio...');
    const speechResult = await processAudioWithSpeechToText(testAudioUri);
    
    if (!speechResult.success || !speechResult.words) {
      console.log('❌ Failed to get speech recognition results:', speechResult.error);
      return;
    }
    
    console.log(`✅ Got ${speechResult.words.length} word timestamps`);
    console.log('📄 Transcript:', speechResult.transcript);
    
    // Step 2: Test alignment with mock lyrics
    console.log('\n🎯 Testing alignment with mock lyrics...');
    console.log('Mock lyrics lines:');
    mockLyricsLines.forEach((line, i) => {
      console.log(`  ${i + 1}. "${line.texts[0].text}"`);
    });
    
    const alignedLines = testAlignLyricsWithWordTimestamps(mockLyricsLines, speechResult.words);
    
    console.log('\n📊 Alignment results:');
    if (alignedLines.length > 0) {
      alignedLines.forEach((line, index) => {
        console.log(`  ✅ ${index + 1}. "${line.originalText}"`);
        console.log(`      Time: ${line.startTime.toFixed(2)}s → ${line.endTime.toFixed(2)}s`);
        console.log(`      Confidence: ${line.confidence.toFixed(2)}`);
        console.log(`      Matched words: ${line.matchedWords.map(w => w.word).join(', ')}`);
      });
      
      console.log(`\n🎉 Successfully aligned ${alignedLines.length} out of ${mockLyricsLines.length} lines!`);
    } else {
      console.log('  ⚠️ No lines were aligned');
    }
    
  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

// Run the test
testLyricsSynchronization();
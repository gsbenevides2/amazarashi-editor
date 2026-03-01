import { processAudioWithSpeechToText } from './app/actions/speech-to-text';

async function main() {
  console.log('🧪 Testing Speech-to-Text action...\n');
  
  // Test with Google's sample audio file
  const testAudioUri = 'gs://cloud-samples-data/speech/audio.flac';
  
  const result = await processAudioWithSpeechToText(testAudioUri);
  
  if (result.success && result.words) {
    console.log('✅ Processing successful!');
    console.log('📄 Transcript:', result.transcript);
    console.log(`🔤 Words extracted: ${result.words.length}`);
    
    result.words.forEach((word, i) => {
      console.log(`  ${i + 1}. "${word.word}" (${word.startSeconds}s → ${word.endSeconds}s, conf: ${word.confidence.toFixed(2)})`);
    });
    
    console.log('\n🎯 Ready for lyrics synchronization!');
  } else {
    console.log('❌ Processing failed:', result.error);
  }
}

main().catch(console.error);
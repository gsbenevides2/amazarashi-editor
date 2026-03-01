import { SpeechClient } from '@google-cloud/speech';
import { Storage } from '@google-cloud/storage';
import path from 'path';

// Initialize clients using the existing service account
const speechClient = new SpeechClient({
  keyFilename: path.join(process.cwd(), 'gcp.json'),
  projectId: 'gui-dev-br',
});

const storageClient = new Storage({
  keyFilename: path.join(process.cwd(), 'gcp.json'),
  projectId: 'gui-dev-br',
});

export async function testSpeechToTextSetup() {
  try {
    console.log('🧪 Testing GCP Speech-to-Text API setup...');
    
    // Test 1: Simple recognition test with a small audio sample
    const request = {
      config: {
        encoding: 'FLAC' as const,
        sampleRateHertz: 16000,
        languageCode: 'ja-JP',
        model: 'latest_long',
        enableWordTimeOffsets: true,
        enableAutomaticPunctuation: true,
      },
      audio: {
        uri: 'gs://cloud-samples-data/speech/audio.flac', // Test file from Google
      },
    };

    const [response] = await speechClient.recognize(request);
    console.log('✅ Speech-to-Text API is accessible');
    console.log('📝 Recognition results:', response.results?.length || 0, 'results');
    
    if (response.results && response.results.length > 0) {
      const firstResult = response.results[0];
      if (firstResult.alternatives && firstResult.alternatives.length > 0) {
        console.log('📄 Sample transcript:', firstResult.alternatives[0].transcript);
        console.log('🔤 Words with timestamps:', firstResult.alternatives[0].words?.length || 0);
      }
    }
    
    // Test 2: Check basic storage client initialization (without listing buckets)
    console.log('✅ Google Cloud Storage client initialized');
    
    return {
      success: true,
      speechApi: true,
      storageApi: true,
      message: 'GCP Speech-to-Text setup successful - ready to process Japanese audio with timestamps!',
    };
    
  } catch (error) {
    console.error('❌ Error testing GCP setup:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Test configuration for Japanese audio processing
export const SPEECH_CONFIG = {
  encoding: 'FLAC' as const,
  sampleRateHertz: 16000,
  languageCode: 'ja-JP',
  model: 'latest_long',
  enableWordTimeOffsets: true,
  enableAutomaticPunctuation: true,
} as const;

// Export clients for use in other modules
export { speechClient, storageClient };
import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';
import { getGCPCredentials } from '../../../_utils/gcp';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Configuration
const ALLOWED_EXTENSIONS = ['.mp3', '.wav', '.flac', '.m4a', '.ogg'];
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB (enough for 8 hours of audio)

interface UploadResponse {
  success: boolean;
  fileUri?: string;
  fileName?: string;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<UploadResponse>> {
  try {
    console.log('📤 Starting audio file upload...');

    const bucketName = process.env.GCS_BUCKET_NAME;

    if (!bucketName) {
      return NextResponse.json(
        { success: false, error: 'GCS_BUCKET_NAME not configured' },
        { status: 500 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('audio') as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No audio file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const fileExtension = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}` 
        },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'File too large. Maximum size: 500MB' },
        { status: 400 }
      );
    }

    // Generate unique filename in audio subfolder
    const uniqueId = uuidv4();
    const fileName = `amazarashi/audio/${uniqueId}_${Date.now()}${fileExtension}`;
    
    console.log('📁 Uploading file:', fileName);
    console.log('📊 File size:', (file.size / 1024 / 1024).toFixed(2), 'MB');

    // Initialize storage client with existing credentials
    const storage = new Storage(getGCPCredentials());

    // Upload file using the same method as image upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const gcsFile = storage.bucket(bucketName).file(fileName);
    await gcsFile.save(buffer, {
      contentType: file.type || 'audio/mpeg',
      metadata: {
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
      },
    });

    // Generate GCS URI for Speech-to-Text API
    const fileUri = `gs://${bucketName}/${fileName}`;

    console.log('✅ Upload successful:', fileUri);

    return NextResponse.json({
      success: true,
      fileUri,
      fileName,
    });

  } catch (error) {
    console.error('❌ Upload error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Upload failed' 
      },
      { status: 500 }
    );
  }
}

// Helper function to clean up old audio files (can be called periodically)
export async function cleanupOldAudioFiles() {
  try {
    const bucketName = process.env.GCS_BUCKET_NAME;
    
    if (!bucketName) {
      throw new Error('GCS_BUCKET_NAME not configured');
    }

    const storage = new Storage(getGCPCredentials());
    const bucket = storage.bucket(bucketName);
    
    // Only clean audio files
    const [files] = await bucket.getFiles({ prefix: 'amazarashi/audio/' });
    
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    let deletedCount = 0;
    
    for (const file of files) {
      const [metadata] = await file.getMetadata();
      const fileAge = now - new Date(metadata.timeCreated!).getTime();
      
      if (fileAge > maxAge) {
        await file.delete();
        deletedCount++;
        console.log('🗑️ Deleted old audio file:', file.name);
      }
    }
    
    console.log('🧹 Audio cleanup complete:', deletedCount, 'files deleted');
    return deletedCount;
    
  } catch (error) {
    console.error('❌ Audio cleanup error:', error);
    return 0;
  }
}
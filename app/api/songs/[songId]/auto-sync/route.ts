import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';
import { getGCPCredentials } from '../../../../_utils/gcp';
import { synchronizeLyricsWithAudio } from '../../../../actions/speech-to-text';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

const ALLOWED_EXTENSIONS = ['.mp3', '.wav', '.flac', '.m4a', '.ogg'];
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

interface AutoSyncResponse {
  success: boolean;
  alignedLines?: any[];
  savedCount?: number;
  stats?: {
    totalLines: number;
    alignedLines: number;
    averageConfidence: number;
  };
  error?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ songId: string }> }
): Promise<NextResponse<AutoSyncResponse>> {
  let uploadedFileUri: string | null = null;
  
  try {
    const { songId } = await params;
    console.log('🎵 Starting auto-sync for song:', songId);

    const bucketName = process.env.GCS_BUCKET_NAME;
    if (!bucketName) {
      return NextResponse.json(
        { success: false, error: 'GCS_BUCKET_NAME not configured' },
        { status: 500 }
      );
    }

    // Step 1: Parse and validate audio file
    const formData = await request.formData();
    const file = formData.get('audio') as File;
    const languageId = formData.get('languageId') as string | null;

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

    console.log('📁 Uploading audio file...');
    console.log('📊 File size:', (file.size / 1024 / 1024).toFixed(2), 'MB');

    // Step 2: Upload to GCS
    const storage = new Storage(getGCPCredentials());
    const uniqueId = uuidv4();
    const fileName = `amazarashi/audio/${uniqueId}_${Date.now()}${fileExtension}`;
    
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const gcsFile = storage.bucket(bucketName).file(fileName);
    await gcsFile.save(buffer, {
      contentType: file.type || 'audio/mpeg',
      metadata: {
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
        songId,
      },
    });

    uploadedFileUri = `gs://${bucketName}/${fileName}`;
    console.log('✅ Upload complete:', uploadedFileUri);

    // Step 3: Process with Speech-to-Text and align with lyrics
    console.log('🎙️ Processing audio with Speech-to-Text...');
    const result = await synchronizeLyricsWithAudio(
      songId,
      uploadedFileUri,
      languageId || undefined,
      true // saveToDatabase
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Synchronization failed' },
        { status: 500 }
      );
    }

    // Step 4: Calculate statistics
    const stats = result.alignedLines
      ? {
          totalLines: result.alignedLines.length,
          alignedLines: result.savedCount || 0,
          averageConfidence:
            result.alignedLines.reduce((sum, line) => sum + line.confidence, 0) /
            result.alignedLines.length,
        }
      : undefined;

    console.log('✅ Auto-sync complete!');
    console.log('📊 Stats:', stats);

    // Step 5: Cleanup temporary file from GCS
    console.log('🧹 Cleaning up temporary file...');
    try {
      await gcsFile.delete();
      console.log('✅ Cleanup complete');
    } catch (cleanupError) {
      console.warn('⚠️ Cleanup warning:', cleanupError);
      // Don't fail the request if cleanup fails
    }

    return NextResponse.json({
      success: true,
      alignedLines: result.alignedLines,
      savedCount: result.savedCount,
      stats,
    });

  } catch (error) {
    console.error('❌ Auto-sync error:', error);

    // Attempt cleanup on error
    if (uploadedFileUri) {
      try {
        const bucketName = process.env.GCS_BUCKET_NAME;
        if (bucketName) {
          const storage = new Storage(getGCPCredentials());
          const fileName = uploadedFileUri.replace(`gs://${bucketName}/`, '');
          await storage.bucket(bucketName).file(fileName).delete();
          console.log('🧹 Cleaned up file after error');
        }
      } catch (cleanupError) {
        console.warn('⚠️ Cleanup after error failed:', cleanupError);
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Auto-sync failed'
      },
      { status: 500 }
    );
  }
}

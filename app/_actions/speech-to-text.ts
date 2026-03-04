"use server";

import { eq } from "drizzle-orm";
import { after } from "next/server";
import { v4 as uuidv4 } from "uuid";

import { getLyrics, Lyrics } from "@/app/_actions/lyrics";
import { processTextToSpeachUsingElevenLabs } from "@/app/_utils/elevenLabs";
import {
  deleteFileFromGCS,
  getPreSignedUrlForAudioUpload as getPreSignedUrlForAudioUploadInternal,
} from "@/app/_utils/gcs";
import {
  AIAlignmentResult,
  // sendToGeminiForProcessAlingnment,
} from "@/app/_utils/gemini";
//import { processTextToSpeachUsingGST } from "@/app/_utils/gst";
import { invalidateISG } from "@/app/_utils/invalidateISG";
import { connectToDatabase } from "@/db";
import { ai_sync_status, lyrics_lines } from "@/db/schema";
import { syncLyrics } from "../_utils/algorithm";

function getLatestLyricsOfSong(songId: string): Promise<
  | {
      lyrics: Lyrics;
    }
  | { error: string }
> {
  return getLyrics(songId)
    .then((lyricsArray) => {
      if (lyricsArray.length === 0) {
        return {
          error: "No lyrics found for this song",
        };
      }
      const lastestItemOfArray = lyricsArray[lyricsArray.length - 1];
      return {
        lyrics: lastestItemOfArray,
      };
    })
    .catch((error) => {
      console.error("❌ Error fetching latest lyrics:", error);
      return {
        error: "Error while fetching latest lyrics",
      };
    });
}

function updateStartAndEndInDatabaseFromAiResponse(
  lyrics: Lyrics,
  aiResponse: AIAlignmentResult,
) {
  const db = connectToDatabase();
  const updatePromises = aiResponse.data.map((item) => {
    const dbId = lyrics.lines.find(
      (line) => line.position === item.position,
    )?.id;
    if (!dbId) {
      return Promise.resolve({
        error: `No matching line found in database for position ${item.position}`,
      });
    }
    return db
      .update(lyrics_lines)
      .set({
        start: item.start,
        end: item.end,
      })
      .where(eq(lyrics_lines.id, dbId))
      .execute();
  });

  return Promise.all(updatePromises)
    .then(() => ({ success: true }))
    .catch((error) => {
      console.error("❌ Error updating database with AI response:", error);
      return { error: "Error while updating database" };
    });
}

function createProcessOnDatabase(processId: string) {
  const db = connectToDatabase();
  return db
    .insert(ai_sync_status)
    .values({
      id: processId,
      running: true,
    })
    .execute()
    .then(() => ({ success: true }))
    .catch((error) => {
      console.error("❌ Error creating process in database:", error);
      return { error: "Error while creating process in database" };
    });
}

function updateProcessStatusInDatabase(
  processId: string,
  errorMessage?: string,
) {
  const db = connectToDatabase();
  return db
    .update(ai_sync_status)
    .set({
      running: false,
      error: errorMessage,
    })
    .where(eq(ai_sync_status.id, processId))
    .execute()
    .then(() => ({ success: true }))
    .catch((error) => {
      console.error("❌ Error updating process status in database:", error);
      return { error: "Error while updating process status in database" };
    });
}

export async function synchronizeAudioWithExistingLyrics(
  gcpAudioUri: string,
  songId: string,
): Promise<{
  processId: string;
  success: boolean;
  error?: string;
}> {
  const processId = uuidv4();

  try {
    const processCreationResult = await createProcessOnDatabase(processId);
    if ("error" in processCreationResult) {
      return { processId, success: false, error: processCreationResult.error };
    }
    const latestLyricsResult = await getLatestLyricsOfSong(songId);
    if ("error" in latestLyricsResult) {
      updateProcessStatusInDatabase(processId, latestLyricsResult.error);
      return { processId, success: false, error: latestLyricsResult.error };
    }
    const lyrics = latestLyricsResult.lyrics;
    const fileUri = gcpAudioUri;
    after(async () => {
      const speechResult = await processTextToSpeachUsingElevenLabs(fileUri);
      if ("error" in speechResult) {
        updateProcessStatusInDatabase(processId, speechResult.error);
        return { processId, success: false, error: speechResult.error };
      }
      await deleteFileFromGCS(fileUri);
      const aiResult = syncLyrics({
        data: {
          lyrics,
          response: speechResult.result ?? [],
        },
        success: true,
      });
      /*
      const aiResult = await sendToGeminiForProcessAlingnment(
        lyrics,
        speechResult.result ?? [],
      );
      */

      if ("error" in aiResult) {
        updateProcessStatusInDatabase(processId, aiResult.error);
        return { processId, success: false, error: aiResult.error };
      }

      await updateStartAndEndInDatabaseFromAiResponse(lyrics, {
        data: aiResult.lyrics,
      });
      invalidateISG();
      updateProcessStatusInDatabase(processId);
    });
    return {
      processId,
      success: true,
    };
  } catch (error) {
    console.error("❌ Form data validation error:", error);
    return {
      processId,
      success: false,
      error: "Unknown error during form data validation",
    };
  }
}

export async function getProcessIdStatus(processId: string): Promise<{
  error?: string;
  running?: boolean;
}> {
  const db = connectToDatabase();
  return db
    .select()
    .from(ai_sync_status)
    .where(eq(ai_sync_status.id, processId))
    .then((result) => {
      if (result.length === 0) {
        return { error: "Process ID not found" };
      }
      const process = result[0];
      return { running: process.running, error: process.error ?? undefined };
    })
    .catch((error) => {
      console.error("❌ Error fetching process status from database:", error);
      return { error: "Error while fetching process status" };
    });
}

export async function getPreSignedUrlForAudioUpload(
  fileName: string,
  contentType: string,
): Promise<
  | {
      signedUrl: string;
      gcsUri: string;
    }
  | { error: string }
> {
  return getPreSignedUrlForAudioUploadInternal(fileName, contentType);
}

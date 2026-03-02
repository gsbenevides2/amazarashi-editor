"use server";

import { getLyrics, Lyrics } from "./lyrics";
import path from "path";
import { getGCPCredentials } from "../_utils/gcp";
import { Storage } from "@google-cloud/storage";
import { SpeechClient } from "@google-cloud/speech";
import { v4 as uuidv4 } from "uuid";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import fs from "fs";
import { connectToDatabase } from "@/db";
import { eq } from "drizzle-orm";
import { ai_sync_status, lyrics_lines } from "@/db/schema";
import { invalidateISG } from "../_utils/invalidateISG";
import { after } from "next/server";

interface SpeechToTextResult {
  word: string;
  startSeconds: string;
  startNanos: string;
  endSeconds: string;
  endNanos: string;
}

interface AiResponse {
  data: {
    position: number;
    start: string;
    end: string;
  }[];
}

async function AIForProcessAlingnment(
  lyrics: Lyrics,
  speechToTextResult: SpeechToTextResult[],
): Promise<
  | {
      error: string;
    }
  | {
      response: AiResponse;
    }
> {
  const systemPrompt = fs.readFileSync(
    process.cwd() + "/app/_prompts/alignment-system-prompt.md",
    "utf-8",
  );
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || "",
  });
  return ai.models
    .generateContent({
      model: "gemini-3-flash-preview",
      config: {
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.HIGH,
        },
        responseMimeType: "application/json",
        responseJsonSchema: {
          type: Type.OBJECT,
          required: ["data"],
          properties: {
            data: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["position", "start", "end"],
                properties: {
                  position: {
                    type: Type.NUMBER,
                  },
                  start: {
                    type: Type.STRING,
                  },
                  end: {
                    type: Type.STRING,
                  },
                },
              },
            },
          },
        },
        systemInstruction: [{ text: systemPrompt }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: JSON.stringify({ lyrics, speechToTextResult }) }],
        },
      ],
    })
    .then((response) => {
      if (!response.candidates || response.candidates.length === 0) {
        console.error("❌ No candidates in AI response");
        return { error: "Invalid AI response format" };
      }
      const firstPart = response.candidates?.[0].content?.parts?.[0].text;
      if (!firstPart) {
        console.error("❌ No text in AI response candidate");
        return { error: "Invalid AI response format" };
      }
      const parsedResponse = JSON.parse(firstPart) as AiResponse;
      if (!parsedResponse.data) {
        console.error("❌ No data field in AI response");
        return { error: "Invalid AI response format" };
      }
      return { response: parsedResponse };
    })
    .catch((error) => {
      console.error("❌ AI processing error:", error);
      return { error: "Unknown error during AI processing" };
    });
}

async function processTextToSpeach(gcpAudioUri: string) {
  const speachClient = new SpeechClient(getGCPCredentials());
  return await speachClient
    .longRunningRecognize({
      config: {
        languageCode: "ja-JP",
        model: "default",
        enableWordTimeOffsets: true,
        enableAutomaticPunctuation: true,
        encoding: "OGG_OPUS",
        sampleRateHertz: 48000,
        audioChannelCount: 2,
        useEnhanced: true,
      },
      audio: { uri: gcpAudioUri },
    })
    .then(([operation]) => operation.promise())
    .then(([response]) => ({
      result: response.results?.flatMap(
        (result) =>
          result.alternatives?.[0].words?.flatMap((wordInfo) => {
            const startSeconds = wordInfo.startTime?.seconds?.toString() ?? "";
            const startNanos = wordInfo.startTime?.nanos?.toString() ?? "";
            const endSeconds = wordInfo.endTime?.seconds?.toString() ?? "";
            const endNanos = wordInfo.endTime?.nanos?.toString() ?? "";
            const word = wordInfo.word ?? "";
            return { word, startSeconds, startNanos, endSeconds, endNanos };
          }) ?? [],
      ),
    }))
    .catch((error) => {
      console.error("❌ Speech-to-Text processing error:", error);
      return { error: "Unknown error during audio processing" };
    });
}

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

function getFileExtension(fileName: string): string {
  return path.extname(fileName).toLowerCase();
}

function validateFormData(
  formData: FormData,
): { file: File; songId: string } | { error: string } {
  const ALLOWED_EXTENSIONS = [".mp3", ".wav", ".flac", ".m4a", ".ogg", ".opus"];
  const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
  const file = formData.get("audio") as File | null;
  const songId = formData.get("songId") as string | null;

  if (!file) {
    return { error: "Audio file is required" };
  }
  const fileExtension = getFileExtension(file.name);
  if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
    return {
      error: `Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`,
    };
  }
  if (file.size > MAX_FILE_SIZE) {
    return {
      error: `File size exceeds the maximum allowed size of ${(
        MAX_FILE_SIZE /
        (1024 * 1024)
      ).toFixed(2)} MB`,
    };
  }
  if (!songId) {
    return { error: "Song ID is required" };
  }

  return { file, songId };
}

async function uploadFileToGCS(
  file: File,
  songId: string,
): Promise<
  | {
      fileUri: string;
    }
  | { error: string }
> {
  const bucketName = process.env.GCS_BUCKET_NAME;
  if (!bucketName) {
    return Promise.resolve({
      error: "Error while uploading file.",
    });
  }
  const fileExtension = getFileExtension(file.name);
  const uniqueId = uuidv4();

  const fileName = `amazarashi/audio/${uniqueId}_${Date.now()}${fileExtension}`;

  const bufferResult = await file
    .arrayBuffer()
    .then((result) => {
      return { buffer: Buffer.from(result) };
    })
    .catch((error) => {
      console.error("❌ Error reading file as ArrayBuffer:", error);
      return { error: "Error while reading file" };
    });

  if ("error" in bufferResult) {
    return Promise.resolve({
      error: bufferResult.error,
    });
  }
  const buffer = bufferResult.buffer;
  const storage = new Storage(getGCPCredentials());
  const gcsFile = storage.bucket(bucketName).file(fileName);
  return gcsFile
    .save(buffer, {
      contentType: file.type || "audio/mpeg",
      metadata: {
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
        songId,
      },
    })
    .then(() => {
      const fileUri = `gs://${bucketName}/${fileName}`;
      return { fileUri };
    })
    .catch((error) => {
      console.error("❌ Error uploading file to GCS:", error);
      return { error: "Error while uploading file" };
    });
}

function parseGCSUri(uri: string): { bucketName: string; filePath: string } {
  if (!uri.startsWith("gs://")) {
    throw new Error("Invalid GCS URI");
  }
  const parts = uri.slice(5).split("/");
  const bucketName = parts.shift() || "";
  const filePath = parts.join("/");
  return { bucketName, filePath };
}

async function deleteFileFromGCS(fileUri: string): Promise<void> {
  const storage = new Storage(getGCPCredentials());
  const { bucketName, filePath } = parseGCSUri(fileUri);
  await storage.bucket(bucketName).file(filePath).delete();
}

function updateStartAndEndInDatabaseFromAiResponse(
  lyrics: Lyrics,
  aiResponse: AiResponse,
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
      const speechResult = await processTextToSpeach(fileUri);
      if ("error" in speechResult) {
        updateProcessStatusInDatabase(processId, speechResult.error);
        return { processId, success: false, error: speechResult.error };
      }
      await deleteFileFromGCS(fileUri);
      const aiResult = await AIForProcessAlingnment(
        lyrics,
        speechResult.result ?? [],
      );

      if ("error" in aiResult) {
        updateProcessStatusInDatabase(processId, aiResult.error);
        return { processId, success: false, error: aiResult.error };
      }

      await updateStartAndEndInDatabaseFromAiResponse(
        lyrics,
        aiResult.response,
      );
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
  const bucketName = process.env.GCS_BUCKET_NAME;
  if (!bucketName) {
    return { error: "Error while get signed url to upload" };
  }
  const fileExtension = getFileExtension(fileName);
  const uniqueId = uuidv4();
  const gcsFileName = `amazarashi/audio/${uniqueId}_${Date.now()}${fileExtension}`;
  const storage = new Storage(getGCPCredentials());
  const file = storage.bucket(bucketName).file(gcsFileName);
  return file
    .getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + 60 * 60 * 1000, // 1 hour
      contentType,
    })
    .then(([signedUrl]) => ({
      signedUrl,
      gcsUri: `gs://${bucketName}/${gcsFileName}`,
    }))
    .catch((error) => {
      console.error("❌ Error generating signed URL:", error);
      return { error: "Error while generating signed URL" };
    });
}

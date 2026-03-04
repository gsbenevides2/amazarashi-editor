import { Storage } from "@google-cloud/storage";
import { v4 as uuidv4 } from "uuid";

import { getFileExtension } from "@/app/_utils/files";
import { getGCPCredentials } from "@/app/_utils/gcp";

export async function uploadFileToGCS(
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

export function parseGCSUri(uri: string): {
  bucketName: string;
  filePath: string;
} {
  if (!uri.startsWith("gs://")) {
    throw new Error("Invalid GCS URI");
  }
  const parts = uri.slice(5).split("/");
  const bucketName = parts.shift() || "";
  const filePath = parts.join("/");
  return { bucketName, filePath };
}

export async function deleteFileFromGCS(fileUri: string): Promise<void> {
  const storage = new Storage(getGCPCredentials());
  const { bucketName, filePath } = parseGCSUri(fileUri);
  await storage.bucket(bucketName).file(filePath).delete();
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

export async function getPreSignedUrlForAudioDownload(gcsUri: string): Promise<
  | {
      signedUrl: string;
    }
  | { error: string }
> {
  const storage = new Storage(getGCPCredentials());
  const { bucketName, filePath } = parseGCSUri(gcsUri);
  const file = storage.bucket(bucketName).file(filePath);
  return file
    .getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + 60 * 60 * 1000, // 1 hour
    })
    .then(([signedUrl]) => ({ signedUrl }))
    .catch((error) => {
      console.error("❌ Error generating signed URL for download:", error);
      return { error: "Error while generating signed URL" };
    });
}

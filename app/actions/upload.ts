"use server";

import { Storage } from "@google-cloud/storage";

export async function uploadImage(
  formData: FormData,
): Promise<{ url: string } | { error: string }> {
  const bucketName = process.env.GCS_BUCKET_NAME;

  if (!bucketName) {
    return { error: "GCS_BUCKET_NAME not configured" };
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return { error: "No file provided" };
  }

  try {
    const storage = new Storage();

    const ext = file.name.split(".").pop() ?? "jpg";
    const fileName = `amazarashi/${crypto.randomUUID()}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const gcsFile = storage.bucket(bucketName).file(fileName);
    const downloadToken = crypto.randomUUID();
    await gcsFile.save(buffer, {
      contentType: file.type || "image/jpeg",
    });
    await gcsFile.setMetadata({
      metadata: {
        firebaseStorageDownloadTokens: downloadToken,
      },
    });

    return {
      url: `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(fileName)}?alt=media&token=${downloadToken}`,
    };
  } catch (err) {
    console.error("uploadImage error:", err);
    return { error: String(err) };
  }
}

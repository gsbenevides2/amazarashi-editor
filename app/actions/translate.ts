"use server";

import { v3 } from "@google-cloud/translate";

export async function translateLyrics(
  lines: string[],
): Promise<
  | { lyrics: { original: string; romanized: string; translated: string }[] }
  | { error: string }
> {
  const projectId = process.env.GCP_PROJECT_ID;

  if (!projectId) {
    return { error: "GCP_PROJECT_ID not configured" };
  }

  try {
    const client = new v3.TranslationServiceClient();
    const parent = client.locationPath(projectId, "global");

    const [[translateResponse], [romanizeResponse]] = await Promise.all([
      client.translateText({
        parent,
        contents: lines,
        sourceLanguageCode: "ja",
        targetLanguageCode: "pt",
      }),
      client.romanizeText({
        parent,
        contents: lines,
        sourceLanguageCode: "ja",
      }),
    ]);

    const translations = translateResponse.translations ?? [];
    const romanizations = romanizeResponse.romanizations ?? [];

    return {
      lyrics: lines.map((original, i) => ({
        original,
        romanized: romanizations[i]?.romanizedText ?? "",
        translated: translations[i]?.translatedText ?? "",
      })),
    };
  } catch (err) {
    console.error("translateLyrics error:", err);
    return { error: String(err) };
  }
}

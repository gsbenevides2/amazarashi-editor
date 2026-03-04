import { SpeechClient } from "@google-cloud/speech";

import { getGCPCredentials } from "@/app/_utils/gcp";

export interface SpeechToTextResult {
  word: string;
  startSeconds: string;
  startNanos: string;
  endSeconds: string;
  endNanos: string;
}

export type ProcessTextToSpeechResult =
  | {
      result: SpeechToTextResult[];
    }
  | {
      error: string;
    };
export async function processTextToSpeachUsingGST(
  gcpAudioUri: string,
): Promise<ProcessTextToSpeechResult> {
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
      result:
        response.results?.flatMap(
          (result) =>
            result.alternatives?.[0].words?.flatMap((wordInfo) => {
              const startSeconds =
                wordInfo.startTime?.seconds?.toString() ?? "";
              const startNanos = wordInfo.startTime?.nanos?.toString() ?? "";
              const endSeconds = wordInfo.endTime?.seconds?.toString() ?? "";
              const endNanos = wordInfo.endTime?.nanos?.toString() ?? "";
              const word = wordInfo.word ?? "";
              return { word, startSeconds, startNanos, endSeconds, endNanos };
            }) ?? [],
        ) ?? [],
    }))
    .catch((error) => {
      console.error("❌ Speech-to-Text processing error:", error);
      return { error: "Unknown error during audio processing" };
    });
}

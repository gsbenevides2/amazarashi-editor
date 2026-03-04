import { SpeechClient } from "@google-cloud/speech";

import { getGCPCredentials } from "@/app/_utils/gcp";
import {
  transformNanoSeccondsToTimeFormat,
  transformNonBigIntNanoToBigIntNano,
} from "@/app/_utils/time";

export interface SpeechToTextResult {
  word: string;
  start: string;
  end: string;
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
              const start = transformNanoSeccondsToTimeFormat(
                transformNonBigIntNanoToBigIntNano(
                  wordInfo.startTime?.nanos ?? 0,
                ),
              );
              const end = transformNanoSeccondsToTimeFormat(
                transformNonBigIntNanoToBigIntNano(
                  wordInfo.endTime?.nanos ?? 0,
                ),
              );
              const word = wordInfo.word ?? "";
              return { word, start, end };
            }) ?? [],
        ) ?? [],
    }))
    .catch((error) => {
      console.error("❌ Speech-to-Text processing error:", error);
      return { error: "Unknown error during audio processing" };
    });
}

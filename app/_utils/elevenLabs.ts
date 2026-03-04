import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { SpeechToTextCharacterResponseModel } from "@elevenlabs/elevenlabs-js/api/types";
import { char } from "drizzle-orm/mysql-core";

import { getPreSignedUrlForAudioDownload } from "@/app/_utils/gcs";
import { ProcessTextToSpeechResult } from "@/app/_utils/gst";

type SpeechToTextCharacterResponseModelStrict = {
  [K in keyof SpeechToTextCharacterResponseModel]-?: NonNullable<
    SpeechToTextCharacterResponseModel[K]
  >;
};

function secondsToNanosBigInt(seconds: number): bigint {
  return BigInt(Math.round(seconds * 1_000_000_000));
}

export async function processTextToSpeachUsingElevenLabs(
  gcpAudioUri: string,
): Promise<ProcessTextToSpeechResult> {
  const urlResult = await getPreSignedUrlForAudioDownload(gcpAudioUri);
  if ("error" in urlResult) {
    console.error("❌ Error getting signed URL for download:", urlResult.error);
    return { error: "Error while getting signed URL for download" };
  }
  const elevenLabsClient = new ElevenLabsClient({
    apiKey: process.env.ELEVENLABS_API_KEY || "",
  });
  return elevenLabsClient.speechToText
    .convert({
      modelId: "scribe_v2",
      cloudStorageUrl: urlResult.signedUrl,
    })
    .then((response) => ({
      result: response.words
        .flatMap((wordInfo) => wordInfo.characters)
        .filter(
          (charInfo): charInfo is SpeechToTextCharacterResponseModelStrict =>
            charInfo &&
            "text" in charInfo &&
            "start" in charInfo &&
            "end" in charInfo
              ? true
              : false,
        )
        .map((charInfo) => ({
          word: charInfo.text,
          startSeconds: charInfo.start.toString(),
          startNanos: secondsToNanosBigInt(charInfo.start).toString(),
          endSeconds: charInfo.end.toString(),
          endNanos: secondsToNanosBigInt(charInfo.end).toString(),
        })),
    }))
    .catch((error) => {
      console.error("❌ Error processing text to speech:", error);
      return { error: "Error while processing text to speech" };
    });
}

import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { SpeechToTextCharacterResponseModel } from "@elevenlabs/elevenlabs-js/api/types";

import { getPreSignedUrlForAudioDownload } from "@/app/_utils/gcs";
import { ProcessTextToSpeechResult } from "@/app/_utils/gst";
import { transformSecondsToTimeFormat } from "@/app/_utils/time";

type SpeechToTextCharacterResponseModelStrict = {
  [K in keyof SpeechToTextCharacterResponseModel]-?: NonNullable<
    SpeechToTextCharacterResponseModel[K]
  >;
};

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
      languageCode: "ja",
      tagAudioEvents: true,
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
          start: transformSecondsToTimeFormat(charInfo.start),
          end: transformSecondsToTimeFormat(charInfo.end),
        })),
    }))
    .catch((error) => {
      console.error("❌ Error processing text to speech:", error);
      return { error: "Error while processing text to speech" };
    });
}

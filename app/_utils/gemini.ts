import fs from "fs";

import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";

import { Lyrics } from "@/app/_actions/lyrics";
import { SpeechToTextResult } from "@/app/_utils/gst";

export interface AIAlignmentResult {
  data: {
    position: number;
    start: string;
    end: string;
  }[];
}

export async function sendToGeminiForProcessAlingnment(
  lyrics: Lyrics,
  speechToTextResult: SpeechToTextResult[],
): Promise<
  | {
      error: string;
    }
  | {
      response: AIAlignmentResult;
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
      const parsedResponse = JSON.parse(firstPart) as AIAlignmentResult;
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

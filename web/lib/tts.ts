import { GoogleGenAI } from "@google/genai";

const INWORLD_TTS_API = "https://api.inworld.ai/tts/v1/voice";

/**
 * Summarize a long response into a concise spoken blurb using Gemini Flash.
 */
export async function summarizeForVoice(text: string): Promise<string> {
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  const response = await client.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `You are Suzi, an AI assistant. Summarize this response as a brief spoken recap (3-5 sentences). Rules:
- Speak in first person as Suzi
- Cover ALL key points, not just the greeting
- Be natural and conversational, like you're giving a verbal update to your boss
- Do NOT use phrases like "the speaker" or "the response says"
- Do NOT output just a greeting — lead with substance
- Strip out markdown formatting, bullet points, and lists — convert to flowing speech

Response to summarize:
${text}`,
  });

  const result = response.text;
  if (result) {
    return result;
  }
  return "Here's a quick summary of what I said.";
}

/**
 * Synthesize TTS audio via Inworld API.
 * Returns a ReadableStream of mp3 chunks — pipe directly to the client response.
 */
export async function textToSpeechStream(text: string): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.INWORLD_TTS_KEY;
  if (!apiKey) {
    throw new Error("INWORLD_TTS_KEY must be set");
  }

  const voiceId = process.env.INWORLD_VOICE_ID || "Kelsey";

  const res = await fetch(INWORLD_TTS_API, {
    method: "POST",
    headers: {
      Authorization: `Basic ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      voiceId,
      modelId: "inworld-tts-1.5-max",
      audioConfig: {
        audioEncoding: "MP3",
        sampleRateHertz: 22050,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "Unknown error");
    throw new Error(`Inworld TTS error ${res.status}: ${err}`);
  }

  const data = await res.json();
  if (!data.audioContent) {
    throw new Error("No audioContent in Inworld response");
  }

  // Inworld returns base64-encoded audio — decode to binary stream
  const audioBytes = Buffer.from(data.audioContent, "base64");

  return new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(audioBytes));
      controller.close();
    },
  });
}

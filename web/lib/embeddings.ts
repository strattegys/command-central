import { GoogleGenAI } from "@google/genai";

/**
 * Suzi vector memory (`_memory.embedding`, pgvector 768). Uses Gemini because GroqCloud
 * does not expose text-embedding models on standard developer keys (verified: /v1/models has none).
 * When Groq ships embeddings with a 768-dim model for your account, you can add a Groq path here.
 */

const EMBEDDING_MODEL = "gemini-embedding-001";

let _ai: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!_ai) _ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  return _ai;
}

/** Embed a single text string. Returns a 768-dim float array. */
export async function embedText(text: string): Promise<number[]> {
  const ai = getAI();
  const result = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
    config: { outputDimensionality: 768 },
  });
  return result.embeddings![0].values!;
}

/** Format a vector array as a pgvector literal string: '[0.1,0.2,...]' */
export function toPgVector(vec: number[]): string {
  return `[${vec.join(",")}]`;
}

import { GoogleGenAI } from "@google/genai";

const EMBEDDING_MODEL = "text-embedding-004";

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
  });
  return result.embeddings![0].values!;
}

/** Format a vector array as a pgvector literal string: '[0.1,0.2,...]' */
export function toPgVector(vec: number[]): string {
  return `[${vec.join(",")}]`;
}

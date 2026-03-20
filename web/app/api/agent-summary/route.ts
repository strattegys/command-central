import { NextResponse, type NextRequest } from "next/server";
import { readFileSync } from "fs";
import { createHash } from "crypto";
import { GoogleGenAI } from "@google/genai";
import { getAgentConfig } from "@/lib/agent-config";

interface CachedSummary {
  summary: string;
  promptHash: string;
}

const summaryCache = new Map<string, CachedSummary>();

function hashPrompt(content: string): string {
  return createHash("md5").update(content).digest("hex");
}

export async function GET(request: NextRequest) {
  const agentId = request.nextUrl.searchParams.get("agent") || "tim";
  const config = getAgentConfig(agentId);

  let promptContent: string;
  try {
    promptContent = readFileSync(config.systemPromptFile, "utf-8");
  } catch {
    return NextResponse.json({ summary: "" });
  }

  const currentHash = hashPrompt(promptContent);
  const cached = summaryCache.get(agentId);
  if (cached && cached.promptHash === currentHash) {
    return NextResponse.json({ summary: cached.summary });
  }

  try {
    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const result = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are summarizing an AI agent for a dashboard card. Given the agent's system prompt, tools, and config below, write a 1-2 sentence summary of what this agent does and its key capabilities. Be concise and direct. Do not start with "This agent" — start with a verb or the agent's purpose.

Tools: ${config.tools.join(", ")}

System prompt:
${promptContent.substring(0, 3000)}`,
    });

    const summary = result.text?.trim() || "";
    summaryCache.set(agentId, { summary, promptHash: currentHash });
    return NextResponse.json({ summary });
  } catch (err) {
    console.error("[agent-summary] Gemini call failed:", err);
    return NextResponse.json({ summary: "" });
  }
}

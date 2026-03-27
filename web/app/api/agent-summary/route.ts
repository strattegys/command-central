import { NextResponse, type NextRequest } from "next/server";
import { readFileSync } from "fs";
import { createHash } from "crypto";
import { groqCompletion } from "@/lib/groq-completion";
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
    const system =
      'You summarize an AI agent for a dashboard card. Reply with 1-2 sentences only: what it does and key capabilities. Be concise. Do not start with "This agent" — start with a verb or the purpose.';
    const user = `Tools: ${config.tools.join(", ")}

System prompt:
${promptContent.substring(0, 3000)}`;

    const summary = (await groqCompletion(system, user, { max_tokens: 256, temperature: 0.35 })) || "";
    summaryCache.set(agentId, { summary, promptHash: currentHash });
    return NextResponse.json({ summary });
  } catch (err) {
    console.error("[agent-summary] Groq call failed:", err);
    return NextResponse.json({ summary: "" });
  }
}

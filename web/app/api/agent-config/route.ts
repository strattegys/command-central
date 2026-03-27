import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { getAgentConfig } from "@/lib/agent-config";
import { getAgentSpec } from "@/lib/agent-registry";

function parseApprovalCommands(systemPromptFile: string): string[] {
  try {
    const content = readFileSync(systemPromptFile, "utf-8");
    // Look for ## Approval Commands section
    const match = content.match(/##\s*Approval Commands\s*\n([\s\S]*?)(?=\n##\s|\n#\s|$)/i);
    if (!match) return [];
    const section = match[1];
    // Extract bullet items (- or *)
    const items: string[] = [];
    for (const line of section.split("\n")) {
      const bullet = line.match(/^\s*[-*]\s+(.+)/);
      if (bullet) {
        items.push(bullet[1].trim().replace(/^["'`]+|["'`]+$/g, ""));
      }
    }
    return items;
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get("agent") || "tim";
  const config = getAgentConfig(agentId);
  const approvalPhrases = parseApprovalCommands(config.systemPromptFile);
  const spec = getAgentSpec(agentId);
  const ttsVoice = spec.ttsVoice?.trim() || null;
  return NextResponse.json({
    config,
    approvalPhrases,
    voiceRuntime: {
      registryVoiceId: ttsVoice,
      inworldKeyPresent: !!process.env.INWORLD_TTS_KEY?.trim(),
      envFallbackVoiceId: process.env.INWORLD_VOICE_ID?.trim() || null,
      groqPresent: !!process.env.GROQ_API_KEY?.trim(),
    },
  });
}

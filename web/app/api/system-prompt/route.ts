import { NextResponse, type NextRequest } from "next/server";
import { readFileSync } from "fs";
import { getAgentConfig } from "@/lib/agent-config";

export async function GET(request: NextRequest) {
  const agentId = request.nextUrl.searchParams.get("agent") || "tim";
  const config = getAgentConfig(agentId);

  try {
    const content = readFileSync(config.systemPromptFile, "utf-8");
    return NextResponse.json({ prompt: content, file: config.systemPromptFile });
  } catch {
    return NextResponse.json(
      { error: "Could not read system prompt" },
      { status: 500 }
    );
  }
}
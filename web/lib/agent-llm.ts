/**
 * Routes non-stream chat and autonomous (heartbeat) calls to the agent's LLM provider.
 * Keeps Gemini / Groq / Anthropic selection in one place.
 */

import { getAgentConfig } from "./agent-config";

export type AgentChatOptions = { sessionFile?: string; saveMessage?: string };

export async function agentChat(
  agentId: string,
  userMessage: string,
  options?: AgentChatOptions
): Promise<string> {
  const config = getAgentConfig(agentId);
  if (config.provider === "groq") {
    const { chatGroq } = await import("./groq-chat");
    return chatGroq(agentId, userMessage, options);
  }
  if (config.provider === "anthropic") {
    const { chatStreamAnthropic } = await import("./anthropic-chat");
    let latest = "";
    const result = await chatStreamAnthropic(agentId, userMessage, (c) => {
      latest = c;
    });
    return result.text || latest;
  }
  const { chat } = await import("./gemini");
  return chat(agentId, userMessage, options);
}

export type AgentAutonomousOptions = {
  maxHistory?: number;
  fromAgent?: string;
  sessionFile?: string;
};

export async function agentAutonomousChat(
  agentId: string,
  triggerPrompt: string,
  options?: AgentAutonomousOptions
): Promise<string> {
  const config = getAgentConfig(agentId);
  if (config.provider === "groq") {
    const { autonomousChatGroq } = await import("./groq-chat");
    return autonomousChatGroq(agentId, triggerPrompt, options);
  }
  if (config.provider === "anthropic") {
    const { autonomousChatAnthropic } = await import("./anthropic-chat");
    return autonomousChatAnthropic(agentId, triggerPrompt, options);
  }
  const { autonomousChat } = await import("./gemini");
  return autonomousChat(agentId, triggerPrompt, options);
}

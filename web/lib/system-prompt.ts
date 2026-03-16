import { readFileSync } from "fs";
import { readMemory } from "./memory";

const promptCache = new Map<string, string>();

export function clearPromptCache(path?: string) {
  if (path) {
    promptCache.delete(path);
  } else {
    promptCache.clear();
  }
}

export function getSystemPrompt(promptFile?: string, agentId?: string): string {
  const path = promptFile || "/root/.nanobot/system-prompt.md";

  let content: string;
  const cached = promptCache.get(path);
  if (cached) {
    content = cached;
  } else {
    try {
      content = readFileSync(path, "utf-8");
      promptCache.set(path, content);
    } catch {
      content =
        "You are a helpful AI assistant. Be friendly, direct, and efficient.";
      promptCache.set(path, content);
    }
  }

  // Inject current date/time so the model always knows the real date
  const now = new Date();
  const pacific = now.toLocaleString("en-US", { timeZone: "America/Los_Angeles", dateStyle: "full", timeStyle: "short" });

  // Inject long-term memory (always fresh-read, not cached)
  let memorySection = "";
  if (agentId) {
    const memoryContent = readMemory(agentId);
    if (memoryContent) {
      memorySection = `\n\n## Long-term Memory\nThese are facts you have saved from previous conversations. Use them to provide personalized, context-aware responses:\n${memoryContent}`;
    } else {
      memorySection = `\n\n## Long-term Memory\nNo memories saved yet. Use the memory tool to save important facts as you learn them.`;
    }
  }

  return `${content}\n\nCurrent date and time (US Pacific): ${pacific}${memorySection}`;
}

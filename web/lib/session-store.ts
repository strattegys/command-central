import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";

export interface ChatMessage {
  role: "user" | "model";
  text: string;
  timestamp: number;
}

interface JournalLine {
  _type?: string;
  role?: string;
  content?: string | Array<{ type?: string; text?: string }> | null;
  text?: string; // alternate field name
  timestamp?: string | number;
  tool_calls?: unknown;
  last_consolidated?: number;
}

/**
 * Read a JSONL session file and return displayable messages.
 * Skips metadata, tool_call lines, and null content.
 * Returns ALL messages — consolidation only affects memory extraction,
 * not chat display.
 */
export function getHistory(sessionFile: string): ChatMessage[] {
  if (!existsSync(sessionFile)) return [];

  try {
    const raw = readFileSync(sessionFile, "utf-8");
    const lines = raw.trim().split("\n");
    if (lines.length === 0) return [];

    const messages: ChatMessage[] = [];
    for (let i = 0; i < lines.length; i++) {
      try {
        const entry: JournalLine = JSON.parse(lines[i]);
        if (!entry.role || entry.tool_calls || entry._type) {
          continue;
        }
        // Normalize content: handle string, array of parts, or fallback to text field
        let content: string | undefined;
        if (typeof entry.content === "string") {
          content = entry.content;
        } else if (Array.isArray(entry.content)) {
          content = entry.content
            .filter((p) => p.type === "text" && p.text)
            .map((p) => p.text)
            .join("\n");
        } else if (typeof entry.text === "string") {
          content = entry.text;
        }
        if (!content) continue;
        messages.push({
          role: entry.role === "assistant" ? "model" : "user",
          text: content,
          timestamp: entry.timestamp
            ? new Date(entry.timestamp).getTime()
            : Date.now(),
        });
      } catch {
        // skip malformed lines
      }
    }

    return messages;
  } catch {
    return [];
  }
}

/**
 * Append a message to a JSONL session file.
 * Uses nanobot format: role=user/assistant, content, ISO timestamp.
 */
export function addMessage(sessionFile: string, msg: ChatMessage): void {
  // Ensure directory exists
  const dir = dirname(sessionFile);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const entry = {
    role: msg.role === "model" ? "assistant" : "user",
    content: msg.text,
    timestamp: new Date(msg.timestamp).toISOString(),
  };
  const line = JSON.stringify(entry) + "\n";
  writeFileSync(sessionFile, line, { flag: "a" });
}

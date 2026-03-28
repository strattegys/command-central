/**
 * Appended to tool results shown to the LLM so the assistant's natural-language
 * reply matches what actually ran (reduces wrong item # / wrong action in chat).
 */

const GROUNDED_TOOL_NAMES = new Set([
  "punch_list",
  "reminders",
  "notes",
  "intake",
  "workflow_items",
]);

const MAX_LEN = 1200;

export function withToolGroundingHint(toolName: string, result: string): string {
  if (!GROUNDED_TOOL_NAMES.has(toolName)) return result;
  const t = result.trim();
  if (t.length === 0 || t.length > MAX_LEN) return result;
  if (/^(error:|unknown |tool error:)/i.test(t)) return result;

  return (
    t +
    "\n\n[Assistant reply rule: One short conversational sentence (voice/chat friendly). Same item # and action as this output only. Do not paste UUIDs, internal ids, or the raw tool line. Do not describe a different item # or operation.]"
  );
}

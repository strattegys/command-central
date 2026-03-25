/**
 * Extract plain text from a MESSAGE_DRAFT / REPLY_DRAFT markdown artifact for Unipile send.
 */

/**
 * Strip markdown boilerplate from a draft artifact to get text suitable for Unipile.
 */
export function extractPlainDmFromDraftMarkdown(markdown: string): string {
  let s = markdown;

  s = s.replace(/^## Enrichment summary\n[\s\S]*?(?=\n## Why this draft\n|\n## Why this reply\n)/im, "");
  s = s.replace(/^## Why this draft\n[\s\S]*?(?=\n# |\n## Message\b)/im, "");
  s = s.replace(/^## Why this reply\n[\s\S]*?(?=\n# |\n## Reply\b)/im, "");

  const dmMatch = s.match(/# [^\n]+\n+([\s\S]*?)(?:\n---\s*\n|\n---$)/);
  if (dmMatch?.[1]) {
    s = dmMatch[1].trim();
  }

  s = s.replace(/^#+\s+.+$/gm, "");
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/^\*Tim[^\n]*$/gm, "");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

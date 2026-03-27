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

/** Parsed warm MESSAGE_DRAFT / REPLY_DRAFT artifact: message body vs Tim footer & preamble. */
export type WarmDmArtifactSplit = {
  prefix: string;
  titleLine: string;
  body: string;
  footer: string;
};

/**
 * Split a Tim warm DM artifact into preamble (enrichment / rationale), H1 title line, editable body, and --- footer.
 * Returns null if the markdown does not match the expected shape (caller falls back to full-document UI).
 */
export function splitWarmLinkedInDmArtifact(markdown: string): WarmDmArtifactSplit | null {
  const md = markdown.replace(/\s+$/, "");
  let sepStart = md.lastIndexOf("\n---\n");
  if (sepStart < 0) {
    if (/\n---\s*$/.test(md)) {
      sepStart = md.lastIndexOf("\n---");
      if (sepStart < 0) return null;
    } else {
      return null;
    }
  }
  const beforeFooter = md.slice(0, sepStart);
  const footer = md.slice(sepStart);

  const br = beforeFooter.lastIndexOf("\n# ");
  let titleStart: number;
  if (br >= 0) {
    titleStart = br + 1;
  } else if (beforeFooter.startsWith("# ")) {
    titleStart = 0;
  } else {
    return null;
  }
  if (beforeFooter.slice(titleStart, titleStart + 2) === "##") return null;

  const nl = beforeFooter.indexOf("\n", titleStart);
  if (nl < 0) return null;
  const titleLine = beforeFooter.slice(titleStart, nl).trimEnd();
  if (!/^#\s.+/.test(titleLine)) return null;

  const body = beforeFooter.slice(nl + 1);
  const prefix = beforeFooter.slice(0, titleStart);
  return { prefix, titleLine, body, footer };
}

/** Rebuild stored artifact after Govind edits only the DM body. */
export function recomposeWarmLinkedInDmArtifact(split: WarmDmArtifactSplit, newBody: string): string {
  const pre = split.prefix.trimEnd();
  const body = newBody.trimEnd();
  const foot = split.footer.startsWith("\n") ? split.footer : `\n${split.footer}`;
  if (!pre) return `${split.titleLine}\n${body}${foot}`;
  return `${pre}\n\n${split.titleLine}\n${body}${foot}`;
}

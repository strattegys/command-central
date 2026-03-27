import Anthropic from "@anthropic-ai/sdk";
import type { Message } from "@anthropic-ai/sdk/resources/messages";
import type { ToolModule } from "./types";

/** Primary long-form model; override with ANTHROPIC_ARTICLE_MODEL. */
const DEFAULT_MODEL = "claude-opus-4-6";
/** Supports structured JSON outputs (same family as 4.6). */
const DEFAULT_STRUCTURED_FALLBACK = "claude-opus-4-5-20251101";
/** Last resort: prompt-only JSON (no output_config — older API shape). */
const DEFAULT_LEGACY_FALLBACK = "claude-opus-4-20250514";

const MAX_TOKENS = 12000;

/** Constrained decoding — avoids malformed JSON / preamble from Opus. */
const ARTICLE_JSON_SCHEMA = {
  type: "object",
  properties: {
    mdxContent: {
      type: "string",
      description:
        "Full article in Markdown: use ## and ### for sections. No frontmatter or JSX.",
    },
    suggestedTitle: { type: "string", description: "Compelling article title" },
    excerpt: { type: "string", description: "1–2 sentence hook, max ~160 characters" },
    seoTitle: { type: "string", description: "SEO page title, max ~60 characters" },
    seoDescription: { type: "string", description: "Meta description, max ~155 characters" },
    tags: {
      type: "array",
      items: { type: "string" },
      description: "3–8 topical tags",
    },
  },
  required: [
    "mdxContent",
    "suggestedTitle",
    "excerpt",
    "seoTitle",
    "seoDescription",
    "tags",
  ],
  additionalProperties: false,
} as const;

const WRITING_SYSTEM_PROMPT = `You are an expert long-form content writer for B2B technology and strategy audiences.

Your response is validated against a fixed JSON schema (mdxContent, suggestedTitle, excerpt, seoTitle, seoDescription, tags).

## Writing Guidelines

- Lead with a strong hook — the first paragraph must earn the reader's attention.
- Back claims with data, examples, or clear reasoning. No vague platitudes.
- Write actionable content — every section should give the reader something they can use.
- Use conversational authority: confident but not arrogant, technical but accessible.
- Vary sentence length. Short sentences punch. Longer ones develop nuance and flow.
- Use subheadings (##) every 200-400 words to create scannable structure.
- Include a compelling introduction and a conclusion that drives action.
- Integrate keywords naturally — never stuff them.
- Target the specified word count. Going 10% over is fine; 20% under is not.
- Do NOT include frontmatter, import statements, or JSX components in mdxContent.`;

interface ArticleResult {
  mdxContent: string;
  suggestedTitle: string;
  excerpt: string;
  seoTitle: string;
  seoDescription: string;
  tags: string[];
}

function buildUserPrompt(args: Record<string, string>): string {
  const parts: string[] = [];

  parts.push(`## Topic\n${args.topic}`);

  if (args.research_notes) {
    parts.push(`## Research Notes\n${args.research_notes}`);
  }

  if (args.brief) {
    parts.push(`## Content Brief / Outline\n${args.brief}`);
  }

  if (args.audience) {
    parts.push(`## Target Audience\n${args.audience}`);
  }

  if (args.tone) {
    parts.push(`## Tone\n${args.tone}`);
  }

  if (args.keywords) {
    parts.push(`## Target Keywords\n${args.keywords}`);
  }

  const wordCount = args.word_count || "1500";
  parts.push(`## Target Word Count\n${wordCount} words`);

  parts.push(
    "\nWrite the full article now. Fill every schema field; mdxContent must be complete Markdown for the article body."
  );

  return parts.join("\n\n");
}

function parseResponse(raw: string): ArticleResult | null {
  try {
    return JSON.parse(raw) as ArticleResult;
  } catch {
    const match = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (match) {
      try {
        return JSON.parse(match[1]!) as ArticleResult;
      } catch {
        /* continue */
      }
    }
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1)) as ArticleResult;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizeParsed(p: ArticleResult | null): ArticleResult | null {
  if (!p || typeof p.mdxContent !== "string") return null;
  if (!Array.isArray(p.tags)) p.tags = [];
  return p;
}

async function createArticleMessage(
  client: Anthropic,
  model: string,
  structured: boolean,
  userPrompt: string
): Promise<Message> {
  const base = {
    model,
    max_tokens: MAX_TOKENS,
    system: WRITING_SYSTEM_PROMPT,
    messages: [{ role: "user" as const, content: userPrompt }],
  };
  if (structured) {
    return client.messages.create({
      ...base,
      output_config: {
        format: {
          type: "json_schema" as const,
          schema: ARTICLE_JSON_SCHEMA as unknown as Record<string, unknown>,
        },
      },
    });
  }
  return client.messages.create({
    ...base,
    messages: [
      {
        role: "user",
        content:
          userPrompt +
          "\n\nReturn a single JSON object with keys mdxContent, suggestedTitle, excerpt, seoTitle, seoDescription, tags (array of strings). No markdown fences, no text before or after the JSON.",
      },
    ],
  });
}

const tool: ToolModule = {
  metadata: {
    id: "article_builder",
    displayName: "Article Builder",
    category: "internal",
    description:
      "Generates long-form MDX articles using the Anthropic API (dedicated model). " +
      "Returns article content plus SEO metadata ready for publish_article.",
    operations: ["generate"],
    requiresApproval: false,
  },

  declaration: {
    name: "article_builder",
    description:
      "Generate a full long-form article using the Anthropic API (Claude Opus family). " +
      "Uses structured JSON when supported so the draft is reliably parsed. " +
      "Provide the topic, research notes, and content brief. Returns MDX content + SEO metadata. " +
      "After receiving the output, use publish_article to create the draft on strattegys.com. " +
      "Args: topic (required), research_notes (required — your research findings), " +
      "brief (required — outline and key points), audience (target reader), " +
      "tone (writing style), keywords (comma-separated SEO keywords), " +
      "word_count (target, default 1500).",
    parameters: {
      type: "object" as const,
      properties: {
        topic: {
          type: "string",
          description: "Article topic or working title",
        },
        research_notes: {
          type: "string",
          description:
            "Research findings, data points, quotes, and source URLs",
        },
        brief: {
          type: "string",
          description:
            "Content brief: outline, key points, angles, structure guidance",
        },
        audience: {
          type: "string",
          description:
            "Target audience (e.g., 'B2B SaaS founders, Series A-C')",
        },
        tone: {
          type: "string",
          description:
            "Writing tone (e.g., 'authoritative but conversational')",
        },
        keywords: {
          type: "string",
          description: "Comma-separated SEO target keywords",
        },
        word_count: {
          type: "string",
          description: "Target word count (default: 1500)",
        },
      },
      required: ["topic", "research_notes", "brief"],
    },
  },

  async execute(args) {
    const { topic, research_notes, brief } = args;
    if (!topic) return "Error: topic is required";
    if (!research_notes) return "Error: research_notes is required";
    if (!brief) return "Error: brief is required";

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return "Error: ANTHROPIC_API_KEY not configured";

    const client = new Anthropic({ apiKey });
    const userPrompt = buildUserPrompt(args);

    const primaryModel =
      process.env.ANTHROPIC_ARTICLE_MODEL?.trim() || DEFAULT_MODEL;
    const structuredFallback =
      process.env.ANTHROPIC_ARTICLE_STRUCTURED_FALLBACK_MODEL?.trim() ||
      DEFAULT_STRUCTURED_FALLBACK;
    const legacyFallback =
      process.env.ANTHROPIC_ARTICLE_LEGACY_FALLBACK_MODEL?.trim() ||
      DEFAULT_LEGACY_FALLBACK;

    const attempts: { model: string; structured: boolean }[] = [
      { model: primaryModel, structured: true },
      { model: structuredFallback, structured: true },
      { model: legacyFallback, structured: false },
    ];

    console.log(
      `[article_builder] Generating article: "${topic}" (target: ${args.word_count || "1500"} words)`
    );

    let response: Message | null = null;
    let lastErr: unknown = null;

    for (const { model, structured } of attempts) {
      try {
        response = await createArticleMessage(
          client,
          model,
          structured,
          userPrompt
        );
        console.log(
          `[article_builder] OK model=${model} structured=${structured} stop_reason=${response.stop_reason}`
        );
        break;
      } catch (err) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[article_builder] attempt failed model=${model}: ${msg}`);
      }
    }

    if (!response) {
      const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
      return `Error calling Anthropic API: ${msg}`;
    }

    if (response.stop_reason === "max_tokens") {
      console.warn(
        "[article_builder] stop_reason=max_tokens — output may be truncated; consider raising max_tokens or lowering word_count"
      );
    }

    const textBlocks = response.content.filter(
      (b): b is Anthropic.TextBlock => b.type === "text"
    );
    const raw = textBlocks.map((b) => b.text).join("");

    if (!raw) return "Error: Anthropic API returned empty response";

    const parsed = normalizeParsed(parseResponse(raw));

    if (parsed) {
      const wordCount = parsed.mdxContent.split(/\s+/).filter(Boolean).length;
      console.log(
        `[article_builder] Generated: "${parsed.suggestedTitle}" (~${wordCount} words)`
      );

      return [
        "=== ARTICLE GENERATED ===",
        `Title: ${parsed.suggestedTitle}`,
        `Excerpt: ${parsed.excerpt}`,
        `SEO Title: ${parsed.seoTitle}`,
        `SEO Description: ${parsed.seoDescription}`,
        `Tags: ${parsed.tags.join(", ")}`,
        `Word Count: ~${wordCount}`,
        "",
        "=== MDX CONTENT ===",
        parsed.mdxContent,
        "=== END ===",
      ].join("\n");
    }

    console.warn("[article_builder] JSON parse failed, returning raw output");
    const wordCount = raw.split(/\s+/).filter(Boolean).length;
    return [
      "=== ARTICLE GENERATED (raw — JSON parse failed) ===",
      `Word Count: ~${wordCount}`,
      "",
      "=== CONTENT ===",
      raw,
      "=== END ===",
    ].join("\n");
  },
};

export default tool;

import type { ToolModule } from "./types";

/**
 * Publish Article tool — manages articles on strattegys.com via remote API.
 *
 * The site runs on a separate server. All operations go through
 * the site's /api/articles endpoint authenticated by PUBLISH_SECRET.
 */

const SITE_API_URL =
  process.env.SITE_API_URL || "https://strattegys.com/api/articles";
const PUBLISH_SECRET = process.env.SITE_PUBLISH_SECRET || "";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function siteApi(
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const res = await fetch(SITE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-publish-secret": PUBLISH_SECRET,
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as Record<string, unknown>;

  if (!res.ok) {
    throw new Error(
      (data.error as string) || `Site API returned ${res.status}`
    );
  }

  return data;
}

const tool: ToolModule = {
  metadata: {
    id: "publish_article",
    displayName: "Article Publisher",
    category: "internal",
    description:
      "Publishes articles to strattegys.com via remote API. Creates MDX content files and database records. " +
      "Supports draft → publish workflow.",
    operations: ["create", "publish", "update", "unpublish", "list"],
    requiresApproval: true,
  },

  declaration: {
    name: "publish_article",
    description:
      "Manage articles on strattegys.com. " +
      "Commands: " +
      "create (arg1=title, arg2=slug [optional, auto-generated from title], arg3=content [MDX body], arg4=excerpt, arg5=author, arg6=tags [comma-separated], arg7=featureImage [url], arg8=seoTitle, arg9=seoDescription, arg10=contentItemId [optional]) — creates draft article, " +
      "publish (arg1=slug) — sets article live, " +
      "update (arg1=slug, arg2=field, arg3=value) — updates a field (title, excerpt, content, featured, spotlight, tags, featureImage, seoTitle, seoDescription), " +
      "unpublish (arg1=slug) — reverts to draft, " +
      "list (arg1=status [optional: draft|published|archived, defaults to all]).",
    parameters: {
      type: "object" as const,
      properties: {
        command: {
          type: "string",
          description: "Command: create, publish, update, unpublish, list",
        },
        arg1: {
          type: "string",
          description: "First arg (see command descriptions)",
        },
        arg2: { type: "string", description: "Second arg" },
        arg3: { type: "string", description: "Third arg" },
        arg4: { type: "string", description: "Fourth arg" },
        arg5: { type: "string", description: "Fifth arg" },
        arg6: { type: "string", description: "Sixth arg" },
        arg7: { type: "string", description: "Seventh arg" },
        arg8: { type: "string", description: "Eighth arg" },
        arg9: { type: "string", description: "Ninth arg" },
        arg10: { type: "string", description: "Tenth arg" },
      },
      required: ["command"],
    },
  },

  async execute(args) {
    const cmd = args.command;

    if (!PUBLISH_SECRET) {
      return "Error: SITE_PUBLISH_SECRET not configured — cannot reach strattegys.com";
    }

    try {
      // ─── create ───────────────────────────────────────────────────
      if (cmd === "create") {
        const title = args.arg1;
        if (!title) return "Error: arg1 (title) is required";

        const slug = args.arg2 || slugify(title);
        const result = await siteApi({
          command: "create",
          title,
          slug,
          content: args.arg3 || "",
          excerpt: args.arg4 || null,
          author: args.arg5 || null,
          tags: args.arg6 || "",
          featureImage: args.arg7 || null,
          seoTitle: args.arg8 || null,
          seoDescription: args.arg9 || null,
          contentItemId: args.arg10 || null,
        });

        return `Created draft article "${title}" (slug: ${result.slug}). Use publish command to make it live on strattegys.com.`;
      }

      // ─── publish ──────────────────────────────────────────────────
      if (cmd === "publish") {
        const slug = args.arg1;
        if (!slug) return "Error: arg1 (slug) is required";

        const result = await siteApi({ command: "publish", slug });
        return `Published "${result.title}" — now live at strattegys.com/blog/${slug}`;
      }

      // ─── update ───────────────────────────────────────────────────
      if (cmd === "update") {
        const slug = args.arg1;
        const field = args.arg2;
        const value = args.arg3;
        if (!slug) return "Error: arg1 (slug) is required";
        if (!field) return "Error: arg2 (field) is required";

        await siteApi({ command: "update", slug, field, value });
        return `Updated ${field} for "${slug}"`;
      }

      // ─── unpublish ────────────────────────────────────────────────
      if (cmd === "unpublish") {
        const slug = args.arg1;
        if (!slug) return "Error: arg1 (slug) is required";

        const result = await siteApi({ command: "unpublish", slug });
        return `Unpublished "${result.title}" — reverted to draft`;
      }

      // ─── list ─────────────────────────────────────────────────────
      if (cmd === "list") {
        const result = await siteApi({
          command: "list",
          status: args.arg1 || undefined,
        });

        const articles = result.articles as Record<string, unknown>[];
        if (!articles || articles.length === 0) {
          return args.arg1
            ? `No ${args.arg1} articles found.`
            : "No articles found.";
        }

        return articles
          .map((r) => {
            const flags = [];
            if (r.spotlight) flags.push("SPOTLIGHT");
            if (r.featured) flags.push("FEATURED");
            const flagStr =
              flags.length > 0 ? ` [${flags.join(", ")}]` : "";
            return `• ${r.title} (${r.slug}) — ${r.status}${flagStr}`;
          })
          .join("\n");
      }

      return `Unknown command: ${cmd}. Use: create, publish, update, unpublish, list`;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[publish_article] ${cmd} error:`, msg);
      return `Error: ${msg}`;
    }
  },
};

export default tool;

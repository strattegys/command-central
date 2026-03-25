/**
 * LinkedIn profile retrieval via Unipile REST API (same contract as scripts/linkedin_unipile.sh).
 * Used for warm-outreach RESEARCHING enrichment in the CRM app — no bash / linkedin.sh required.
 */

export function isUnipileConfigured(): boolean {
  return Boolean(
    process.env.UNIPILE_API_KEY?.trim() &&
      process.env.UNIPILE_DSN?.trim() &&
      process.env.UNIPILE_ACCOUNT_ID?.trim()
  );
}

/** Extract public slug or ACoAAA provider id from text or URL. */
export function extractLinkedInProfileIdentifier(input: string): string | null {
  const t = input.trim();
  if (!t) return null;
  const fromUrl = t.match(/linkedin\.com\/in\/([^/?#\s]+)/i);
  if (fromUrl) {
    try {
      return decodeURIComponent(fromUrl[1]);
    } catch {
      return fromUrl[1];
    }
  }
  if (/^ACoA[A-Za-z0-9_-]+/i.test(t)) return t;
  if (/^[a-z0-9\-_%]{2,200}$/i.test(t)) return t;
  return null;
}

export async function fetchUnipileLinkedInProfile(
  identifier: string
): Promise<unknown | null> {
  const key = process.env.UNIPILE_API_KEY;
  const dsn = process.env.UNIPILE_DSN;
  const accountId = process.env.UNIPILE_ACCOUNT_ID;
  if (!key?.trim() || !dsn?.trim() || !accountId?.trim()) {
    return null;
  }

  const base = `https://${dsn}/api/v1`;
  const url = `${base}/users/${encodeURIComponent(identifier)}?account_id=${encodeURIComponent(accountId)}&linkedin_sections=*`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "X-API-KEY": key,
        accept: "application/json",
      },
      cache: "no-store",
    });
    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      console.error("[unipile-profile] Non-JSON response", res.status, text.slice(0, 200));
      return { httpStatus: res.status, raw: text.slice(0, 500) };
    }
    if (!res.ok) {
      console.error("[unipile-profile] API error", res.status, data);
      return data;
    }
    return data;
  } catch (e) {
    console.error("[unipile-profile] fetch failed:", e);
    return null;
  }
}

function pickStr(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function pickNum(v: unknown): number | undefined {
  return typeof v === "number" && !Number.isNaN(v) ? v : undefined;
}

/** Turn Unipile UserProfile JSON into markdown for artifacts + LLM context. */
export function formatUnipileProfileMarkdown(data: unknown): string {
  if (!data || typeof data !== "object") {
    return "_No profile data._";
  }
  const o = data as Record<string, unknown>;
  if (o.error || o.detail || o.message) {
    return `_Unipile returned an error:_\n\n\`\`\`json\n${JSON.stringify(data, null, 2).slice(0, 2000)}\n\`\`\``;
  }

  const lines: string[] = [];
  const name = [pickStr(o.first_name), pickStr(o.last_name)].filter(Boolean).join(" ");
  if (name) lines.push(`**Name:** ${name}`);
  const headline = pickStr(o.headline);
  if (headline) lines.push(`**Headline:** ${headline}`);
  const loc = pickStr(o.location);
  if (loc) lines.push(`**Location:** ${loc}`);
  const pub = pickStr(o.public_identifier);
  if (pub) lines.push(`**Public ID:** ${pub}`);
  const pid = pickStr(o.provider_id);
  if (pid) lines.push(`**Provider ID:** ${pid}`);
  const conn = pickNum(o.connections_count);
  const fol = pickNum(o.follower_count);
  if (conn != null) lines.push(`**Connections:** ${conn}`);
  if (fol != null) lines.push(`**Followers:** ${fol}`);

  const summary = pickStr(o.summary);
  if (summary) lines.push(`\n### About\n${summary}`);

  const work = o.work_experience;
  if (Array.isArray(work) && work.length > 0) {
    lines.push("\n### Experience");
    for (const w of work.slice(0, 6)) {
      if (!w || typeof w !== "object") continue;
      const we = w as Record<string, unknown>;
      const parts = [
        pickStr(we.position || we.title),
        pickStr(we.company),
        pickStr(we.date_range || we.date),
      ].filter(Boolean);
      if (parts.length) lines.push(`- ${parts.join(" — ")}`);
    }
  }

  const edu = o.education;
  if (Array.isArray(edu) && edu.length > 0) {
    lines.push("\n### Education");
    for (const e of edu.slice(0, 4)) {
      if (!e || typeof e !== "object") continue;
      const ed = e as Record<string, unknown>;
      const parts = [pickStr(ed.school), pickStr(ed.degree), pickStr(ed.date_range)].filter(Boolean);
      if (parts.length) lines.push(`- ${parts.join(" — ")}`);
    }
  }

  const skills = o.skills;
  if (Array.isArray(skills) && skills.length > 0) {
    const names = skills
      .slice(0, 15)
      .map((s) => {
        if (typeof s === "string") return s;
        if (s && typeof s === "object" && "name" in s) return pickStr((s as { name?: string }).name);
        return undefined;
      })
      .filter(Boolean);
    if (names.length) lines.push(`\n### Skills\n${names.join(", ")}`);
  }

  if (lines.length === 0) {
    return `_Profile object received but no familiar fields parsed._\n\n\`\`\`json\n${JSON.stringify(data, null, 2).slice(0, 3500)}\n\`\`\``;
  }

  return lines.join("\n");
}

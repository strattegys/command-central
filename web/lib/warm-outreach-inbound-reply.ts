/**
 * When a LinkedIn inbound arrives, advance warm-outreach workflow items that are
 * at MESSAGED (same person) to REPLIED → REPLY_DRAFT via the same path as the human "Replied" action.
 */
import { query } from "@/lib/db";

/** Base URL for server-side fetch to this same Next app (webhook → /api/crm/human-tasks/resolve). */
function internalAppOrigin(): string {
  const raw =
    process.env.APP_INTERNAL_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  if (raw) return raw.replace(/\/$/, "");
  const port = process.env.PORT || "3001";
  // Same container / host as this process (Docker web listens on 0.0.0.0:PORT)
  return `http://127.0.0.1:${port}`;
}

/** Workflow item IDs at MESSAGED for this person in a warm-outreach workflow. */
export async function findWarmOutreachItemsAwaitingReply(personId: string): Promise<string[]> {
  const rows = await query<{ id: string; spec: unknown }>(
    `SELECT wi.id, w.spec
     FROM "_workflow_item" wi
     INNER JOIN "_workflow" w ON w.id = wi."workflowId" AND w."deletedAt" IS NULL
     WHERE wi."sourceId" = $1
       AND wi."sourceType" = 'person'
       AND wi.stage = 'MESSAGED'
       AND wi."deletedAt" IS NULL`,
    [personId]
  );
  const out: string[] = [];
  for (const r of rows) {
    try {
      const spec = typeof r.spec === "string" ? JSON.parse(r.spec) : r.spec;
      if ((spec as { workflowType?: string })?.workflowType === "warm-outreach") out.push(r.id);
    } catch {
      /* skip malformed spec */
    }
  }
  return out;
}

/**
 * Same as findWarmOutreachItemsAwaitingReply, but if the webhook CRM contact id does not match
 * `person.id` on the workflow item (Twenty/bash vs Postgres row), fall back to matching
 * `person.linkedinLinkPrimaryLinkUrl` against Unipile's provider id / slug.
 */
export async function resolveWarmOutreachItemsForInboundMessage(
  crmContactId: string,
  senderProviderId: string
): Promise<string[]> {
  const seen = new Set<string>();
  for (const id of await findWarmOutreachItemsAwaitingReply(crmContactId)) seen.add(id);

  const slug = senderProviderId?.trim();
  if (seen.size === 0 && slug) {
    const rows = await query<{ id: string }>(
      `SELECT id FROM person
       WHERE "deletedAt" IS NULL
         AND "linkedinLinkPrimaryLinkUrl" IS NOT NULL
         AND TRIM("linkedinLinkPrimaryLinkUrl") <> ''
         AND (
           "linkedinLinkPrimaryLinkUrl" ILIKE $1
           OR "linkedinLinkPrimaryLinkUrl" ILIKE $2
         )`,
      [`%${slug}%`, `%/in/${slug}%`]
    );
    for (const r of rows) {
      for (const wi of await findWarmOutreachItemsAwaitingReply(r.id)) seen.add(wi);
    }
  }

  return [...seen];
}

/**
 * Server-side call into human-tasks resolve (replied + notes on MESSAGED).
 * Requires a reachable app URL (set APP_INTERNAL_URL in production if needed).
 */
export async function applyWarmOutreachInboundViaResolve(
  itemId: string,
  notes: string
): Promise<{ ok: boolean; error?: string }> {
  const origin = internalAppOrigin();
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const internalKey = process.env.INTERNAL_API_KEY?.trim();
    if (internalKey) headers["x-internal-key"] = internalKey;
    const whSecret = process.env.UNIPILE_WEBHOOK_SECRET?.trim();
    if (whSecret) headers["Authorization"] = `Bearer ${whSecret}`;

    const res = await fetch(`${origin}/api/crm/human-tasks/resolve`, {
      method: "POST",
      headers,
      body: JSON.stringify({ itemId, action: "replied", notes }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    if (!data.ok) return { ok: false, error: data.error || `HTTP ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

import { NextResponse } from "next/server";

const PROBE_MS = 4000;

type ProbeStatus = "ok" | "down" | "skipped";

interface ProbeResult {
  id: string;
  label: string;
  status: ProbeStatus;
  ms?: number;
  detail?: string;
}

async function probeHttp(
  id: string,
  label: string,
  url: string | undefined,
  path = ""
): Promise<ProbeResult> {
  if (!url?.trim()) {
    return { id, label, status: "skipped", detail: "not configured" };
  }
  let target: string;
  try {
    const u = new URL(url);
    target = path ? `${u.origin}${path}` : u.href;
  } catch {
    return { id, label, status: "skipped", detail: "bad URL" };
  }

  const t0 = Date.now();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), PROBE_MS);
  try {
    const res = await fetch(target, {
      method: "GET",
      signal: ac.signal,
      redirect: "follow",
      headers: { Accept: "text/html,application/json,*/*" },
    });
    clearTimeout(timer);
    const ms = Date.now() - t0;
    if (res.ok || (res.status >= 300 && res.status < 400) || res.status === 401 || res.status === 403) {
      return { id, label, status: "ok", ms };
    }
    return { id, label, status: "down", ms, detail: `HTTP ${res.status}` };
  } catch (e) {
    clearTimeout(timer);
    const msg = e instanceof Error ? e.message : String(e);
    return { id, label, status: "down", detail: msg.includes("abort") ? "timeout" : msg.slice(0, 48) };
  }
}

/**
 * GET /api/system-status — lightweight reachability checks (server-side only).
 * URLs come from existing env vars; optional TTS via STATUS_TTS_URL.
 */
export async function GET() {
  const twentyBase = process.env.TWENTY_CRM_URL?.trim() || "";
  const siteArticles = process.env.SITE_API_URL?.trim() || "https://strattegys.com/api/articles";
  let siteOrigin = "https://strattegys.com";
  try {
    siteOrigin = new URL(siteArticles).origin;
  } catch {
    /* keep default */
  }
  const ttsUrl = process.env.STATUS_TTS_URL?.trim();

  const [twenty, site, tts] = await Promise.all([
    probeHttp("twenty", "Twenty CRM", twentyBase || undefined),
    probeHttp("site", "Site", siteOrigin, "/"),
    probeHttp("tts", "TTS", ttsUrl || undefined),
  ]);

  const services: ProbeResult[] = [
    { id: "web", label: "Command Central", status: "ok", ms: 0 },
    twenty,
    site,
    tts,
  ];

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    services,
  });
}

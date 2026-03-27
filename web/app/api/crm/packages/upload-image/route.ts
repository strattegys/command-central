import { NextRequest, NextResponse } from "next/server";
import { resolveArticlesUploadImageUrl } from "@/lib/site-articles-url";

/**
 * Proxy image upload to strattegys.com
 * POST { filename, data (base64) }
 * Returns { ok, url } — HTTP status matches upstream (401/500) when upload fails.
 */
export async function POST(req: NextRequest) {
  try {
    const { filename, data } = await req.json();
    if (!filename || !data) {
      return NextResponse.json({ error: "filename and data required" }, { status: 400 });
    }

    const SITE_API_URL = process.env.SITE_API_URL || "https://strattegys.com/api/articles";
    const SITE_PUBLISH_SECRET = process.env.SITE_PUBLISH_SECRET || "strattegys-publish-2026";

    const uploadUrl = resolveArticlesUploadImageUrl(SITE_API_URL);
    const res = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-publish-secret": SITE_PUBLISH_SECRET,
      },
      body: JSON.stringify({ filename, data }),
    });

    const text = await res.text();
    let result: Record<string, unknown>;
    try {
      result = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      result = {
        error: `Site returned non-JSON (HTTP ${res.status})`,
        bodyPreview: text.slice(0, 200),
      };
    }

    return NextResponse.json(result, { status: res.ok ? 200 : res.status });
  } catch (err) {
    console.error("[upload-image proxy]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}

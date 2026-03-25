import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy image upload to strattegys.com
 * POST { filename, data (base64) }
 * Returns { ok, url }
 */
export async function POST(req: NextRequest) {
  try {
    const { filename, data } = await req.json();
    if (!filename || !data) {
      return NextResponse.json({ error: "filename and data required" }, { status: 400 });
    }

    const SITE_API_URL = process.env.SITE_API_URL || "https://strattegys.com/api/articles";
    const SITE_PUBLISH_SECRET = process.env.SITE_PUBLISH_SECRET || "strattegys-publish-2026";

    // Forward to strattegys upload endpoint
    const uploadUrl = SITE_API_URL.replace("/articles", "/articles/upload-image");
    const res = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-publish-secret": SITE_PUBLISH_SECRET,
      },
      body: JSON.stringify({ filename, data }),
    });

    const result = await res.json();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[upload-image proxy]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}

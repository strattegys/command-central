import { NextResponse } from "next/server";
import { handleUnipileWebhook } from "../../../../lib/linkedin-webhook";

const WEBHOOK_SECRET = process.env.UNIPILE_WEBHOOK_SECRET || "";

export async function POST(req: Request) {
  // Validate auth header
  if (WEBHOOK_SECRET) {
    const authHeader = req.headers.get("unipile-auth") || "";
    if (authHeader !== WEBHOOK_SECRET) {
      console.warn("[webhook] Invalid Unipile-Auth header");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Parse body
  let payload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Respond immediately — Unipile retries on timeout
  const response = NextResponse.json({ received: true });

  // Process async (fire-and-forget)
  handleUnipileWebhook(payload).catch((err) =>
    console.error("[webhook] Processing error:", err)
  );

  return response;
}

export async function GET() {
  return NextResponse.json({ status: "ok" });
}

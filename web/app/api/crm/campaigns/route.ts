import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const campaigns = await query(
      `SELECT id, name, stage FROM "_campaign"
       WHERE "deletedAt" IS NULL
       ORDER BY name ASC NULLS LAST
       LIMIT 50`
    );
    return NextResponse.json({ campaigns });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to fetch campaigns";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

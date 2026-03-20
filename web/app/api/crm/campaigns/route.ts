import { NextResponse, type NextRequest } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const campaigns = await query(
      `SELECT id, name, stage, spec FROM "_campaign"
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

export async function PATCH(request: NextRequest) {
  try {
    const { id, stage } = await request.json();
    if (!id || !stage) {
      return NextResponse.json({ error: "id and stage are required" }, { status: 400 });
    }
    const validStages = ["PLANNING", "ACTIVE", "PAUSED", "COMPLETED"];
    if (!validStages.includes(stage)) {
      return NextResponse.json({ error: `Invalid stage. Must be one of: ${validStages.join(", ")}` }, { status: 400 });
    }
    await query(
      `UPDATE "_campaign" SET stage = $1, "updatedAt" = NOW() WHERE id = $2 AND "deletedAt" IS NULL`,
      [stage, id]
    );
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to update campaign";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

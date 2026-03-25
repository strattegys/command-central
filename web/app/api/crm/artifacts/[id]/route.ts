import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

/**
 * PATCH /api/crm/artifacts/[id]
 * Update an artifact's content.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { content } = await req.json();

    if (!content) {
      return NextResponse.json({ error: "content required" }, { status: 400 });
    }

    await query(
      `UPDATE "_artifact" SET content = $1, "updatedAt" = NOW() WHERE id = $2 AND "deletedAt" IS NULL`,
      [content, id]
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[artifacts/PATCH] error:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

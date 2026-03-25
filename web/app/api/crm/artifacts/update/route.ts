import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { artifactId, content } = await req.json();
    if (!artifactId || content === undefined) {
      return NextResponse.json({ error: "artifactId and content required" }, { status: 400 });
    }

    await query(
      `UPDATE "_artifact" SET content = $1, "updatedAt" = NOW() WHERE id = $2 AND "deletedAt" IS NULL`,
      [content, artifactId]
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[artifacts/update]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 500 }
    );
  }
}

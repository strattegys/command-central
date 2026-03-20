import { NextResponse, type NextRequest } from "next/server";
import { query, transaction } from "@/lib/db";

export async function GET(request: NextRequest) {
  const personId = request.nextUrl.searchParams.get("personId");
  if (!personId) {
    return NextResponse.json({ error: "personId is required" }, { status: 400 });
  }

  try {
    const notes = await query(
      `SELECT n.id, n.title, n."bodyV2Markdown" AS body, n."createdAt"
       FROM note n
       JOIN "noteTarget" nt ON nt."noteId" = n.id AND nt."deletedAt" IS NULL
       WHERE nt."targetPersonId" = $1
         AND n."deletedAt" IS NULL
       ORDER BY n."createdAt" DESC
       LIMIT 50`,
      [personId]
    );
    return NextResponse.json({ notes });
  } catch {
    return NextResponse.json({ notes: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { personId, title, body } = await request.json();
    if (!personId || !body) {
      return NextResponse.json({ error: "personId and body are required" }, { status: 400 });
    }

    const noteId = await transaction(async (run) => {
      const noteRes = await run(
        `INSERT INTO note (id, title, "bodyV2Markdown", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, NOW(), NOW())
         RETURNING id`,
        [title || "Web Note from Govind", body]
      );
      const id = noteRes.rows[0].id;

      await run(
        `INSERT INTO "noteTarget" (id, "noteId", "targetPersonId", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, NOW(), NOW())`,
        [id, personId]
      );

      return id;
    });

    return NextResponse.json({ success: true, noteId });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to create note";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

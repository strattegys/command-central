import { NextResponse, type NextRequest } from "next/server";
import { query } from "@/lib/db";
import type { Board } from "@/lib/board-types";

interface CampaignRow {
  [key: string]: unknown;
  id: string;
  name: string;
  stage: string;
  spec: string;
  boardId: string | null;
  board_id: string | null;
  board_name: string | null;
  board_description: string | null;
  board_stages: unknown;
  board_transitions: unknown;
}

export async function GET() {
  try {
    const rows = await query<CampaignRow>(
      `SELECT c.id, c.name, c.stage, c.spec, c."boardId",
              b.id AS board_id, b.name AS board_name, b.description AS board_description,
              b.stages AS board_stages, b.transitions AS board_transitions
       FROM "_campaign" c
       LEFT JOIN "_board" b ON b.id = c."boardId" AND b."deletedAt" IS NULL
       WHERE c."deletedAt" IS NULL
       ORDER BY c.name ASC NULLS LAST
       LIMIT 50`
    );
    const campaigns = rows.map((r) => ({
      id: r.id,
      name: r.name,
      stage: r.stage,
      spec: r.spec,
      boardId: r.boardId,
      board: r.board_id
        ? {
            id: r.board_id,
            name: r.board_name,
            description: r.board_description,
            stages: r.board_stages,
            transitions: r.board_transitions,
          } as Board
        : null,
    }));
    return NextResponse.json({ campaigns });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to fetch campaigns";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { id, stage, boardId } = await request.json();
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const sets: string[] = ['"updatedAt" = NOW()'];
    const params: unknown[] = [];
    let idx = 1;

    if (stage !== undefined) {
      const validStages = ["PLANNING", "ACTIVE", "PAUSED", "COMPLETED"];
      if (!validStages.includes(stage)) {
        return NextResponse.json({ error: `Invalid stage. Must be one of: ${validStages.join(", ")}` }, { status: 400 });
      }
      sets.push(`stage = $${idx++}`);
      params.push(stage);
    }

    if (boardId !== undefined) {
      sets.push(`"boardId" = $${idx++}`);
      params.push(boardId);
    }

    if (sets.length === 1) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    params.push(id);
    await query(
      `UPDATE "_campaign" SET ${sets.join(", ")} WHERE id = $${idx} AND "deletedAt" IS NULL`,
      params
    );
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to update campaign";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

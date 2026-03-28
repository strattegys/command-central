import { NextResponse, type NextRequest } from "next/server";
import { listIntake, addIntake, updateIntake, deleteIntake, type IntakeSource } from "@/lib/intake";

const SOURCES = new Set<IntakeSource>(["ui", "agent", "share", "email"]);

function parseSource(v: unknown): IntakeSource {
  const s = typeof v === "string" ? v : "";
  return SOURCES.has(s as IntakeSource) ? (s as IntakeSource) : "ui";
}

export async function GET(request: NextRequest) {
  const agentId = request.nextUrl.searchParams.get("agent") || "suzi";
  const search = request.nextUrl.searchParams.get("search") || undefined;

  try {
    const items = await listIntake(agentId, { search });
    return NextResponse.json({ items });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to fetch intake";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { command, agentId = "suzi", ...data } = body;

    if (command === "add") {
      if (!data.title || typeof data.title !== "string") {
        return NextResponse.json({ error: "Title is required" }, { status: 400 });
      }
      const item = await addIntake(agentId, {
        title: data.title.trim(),
        url: data.url != null ? String(data.url).trim() || null : undefined,
        body: data.body != null ? String(data.body) : undefined,
        source: parseSource(data.source),
        meta: data.meta && typeof data.meta === "object" ? data.meta : undefined,
      });
      return NextResponse.json({ item });
    }

    if (command === "update") {
      if (!data.id) {
        return NextResponse.json({ error: "Intake id is required" }, { status: 400 });
      }
      await updateIntake(data.id, {
        title: data.title !== undefined ? String(data.title) : undefined,
        url: data.url !== undefined ? (data.url ? String(data.url) : null) : undefined,
        body: data.body !== undefined ? (data.body != null ? String(data.body) : null) : undefined,
      });
      return NextResponse.json({ success: true });
    }

    if (command === "delete") {
      if (!data.id) {
        return NextResponse.json({ error: "Intake id is required" }, { status: 400 });
      }
      await deleteIntake(data.id);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown command" }, { status: 400 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

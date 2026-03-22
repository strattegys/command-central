import { NextResponse, type NextRequest } from "next/server";
import { listNotes, addNote, updateNote, deleteNote, listTags } from "@/lib/notes";

export async function GET(request: NextRequest) {
  const agentId = request.nextUrl.searchParams.get("agent") || "suzi";
  const tag = request.nextUrl.searchParams.get("tag") || undefined;
  const search = request.nextUrl.searchParams.get("search") || undefined;
  const tagsOnly = request.nextUrl.searchParams.get("tags") === "true";

  try {
    if (tagsOnly) {
      const tags = await listTags(agentId);
      return NextResponse.json({ tags });
    }
    const notes = await listNotes(agentId, { tag, search });
    return NextResponse.json({ notes });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to fetch notes";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { command, agentId = "suzi", ...data } = body;

    if (command === "add") {
      if (!data.title) {
        return NextResponse.json({ error: "Title is required" }, { status: 400 });
      }
      const note = await addNote(agentId, data);
      return NextResponse.json({ note });
    }

    if (command === "update") {
      if (!data.id) {
        return NextResponse.json({ error: "Note ID is required" }, { status: 400 });
      }
      await updateNote(data.id, data);
      return NextResponse.json({ success: true });
    }

    if (command === "delete") {
      if (!data.id) {
        return NextResponse.json({ error: "Note ID is required" }, { status: 400 });
      }
      await deleteNote(data.id);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown command" }, { status: 400 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextResponse, type NextRequest } from "next/server";
import {
  listPunchListItems,
  addPunchListItem,
  updatePunchListItem,
  deletePunchListItem,
} from "@/lib/punch-list";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("agentId") || "suzi";
    const status = (searchParams.get("status") as "open" | "done") || undefined;
    const search = searchParams.get("search") || undefined;

    const items = await listPunchListItems(agentId, { status, search });
    return NextResponse.json({ items });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to fetch punch list";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    const item = await addPunchListItem(body.agentId || "suzi", {
      title: body.title,
      description: body.description,
      rank: body.rank,
    });
    return NextResponse.json({ item });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to add punch list item";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    await updatePunchListItem(id, updates);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to update punch list item";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    await deletePunchListItem(body.id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to delete punch list item";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

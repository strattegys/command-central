import { NextResponse, type NextRequest } from "next/server";
import {
  listReminders,
  updateReminder,
  deleteReminder,
} from "@/lib/reminders";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("agentId") || "suzi";
    const category = searchParams.get("category") || undefined;
    const search = searchParams.get("search") || undefined;
    const upcoming = searchParams.get("upcoming") === "true";

    const reminders = await listReminders(agentId, {
      category,
      search,
      upcoming,
      includeInactive: searchParams.get("includeInactive") === "true",
    });

    return NextResponse.json({ reminders });
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Failed to fetch reminders";
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
    await updateReminder(id, updates);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Failed to update reminder";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    await deleteReminder(body.id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Failed to delete reminder";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

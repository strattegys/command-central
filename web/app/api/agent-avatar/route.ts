import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, readFile } from "fs/promises";
import path from "path";
import { getAgentSpec } from "@/lib/agent-registry";

// Single persistent directory for all agent avatars.
// Lives outside the project so deploys never wipe it.
const AVATAR_DIR = process.env.AVATAR_DIR || "/root/.agent-avatars";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const agentId = formData.get("agentId") as string | null;

    if (!file || !agentId) {
      return NextResponse.json({ error: "Missing file or agentId" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "File must be an image" }, { status: 400 });
    }

    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: "File must be under 25MB" }, { status: 400 });
    }

    const safeId = agentId.replace(/[^a-z0-9-]/gi, "");
    if (!safeId) {
      return NextResponse.json({ error: "Invalid agentId" }, { status: 400 });
    }

    await mkdir(AVATAR_DIR, { recursive: true });

    const ext = file.type === "image/svg+xml" ? "svg" : "png";
    const filename = `${safeId}-avatar.${ext}`;
    const filePath = path.join(AVATAR_DIR, filename);

    const bytes = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));

    const avatarUrl = `/api/agent-avatar?id=${safeId}&v=${Date.now()}`;
    return NextResponse.json({ avatarUrl });
  } catch (err) {
    console.error("Avatar upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const safeId = id.replace(/[^a-z0-9-]/gi, "");
    if (!safeId) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    // Check the one persistent avatar directory, then fall back to public/
    const searchDirs = [AVATAR_DIR, path.join(process.cwd(), "public")];

    for (const dir of searchDirs) {
      for (const ext of ["png", "svg"]) {
        const filePath = path.join(dir, `${safeId}-avatar.${ext}`);
        try {
          const data = await readFile(filePath);
          const contentType = ext === "svg" ? "image/svg+xml" : "image/png";
          return new NextResponse(data, {
            headers: {
              "Content-Type": contentType,
              "Cache-Control": "no-store",
            },
          });
        } catch {
          // file doesn't exist, try next
        }
      }
    }

    // No file found — return SVG with agent's initial + color
    const spec = getAgentSpec(safeId);
    const color = spec.color || "#555";
    const initial = spec.name?.[0] || safeId[0]?.toUpperCase() || "?";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
      <circle cx="64" cy="64" r="64" fill="${color}"/>
      <text x="64" y="64" text-anchor="middle" dominant-baseline="central" font-family="system-ui,sans-serif" font-size="56" font-weight="600" fill="white">${initial}</text>
    </svg>`;
    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to serve avatar" }, { status: 500 });
  }
}

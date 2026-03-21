import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, readFile } from "fs/promises";
import path from "path";
import { getAgentSpec } from "@/lib/agent-registry";

// Resolve uploads dir at request time, not module load time.
// Default to /root/.agent-avatars which persists across deploys.
function getUploadsDir() {
  return process.env.AVATAR_DIR || "/root/.agent-avatars";
}

// Resolve public dir — works in both dev and standalone builds
function getPublicDir() {
  return path.join(process.cwd(), "public");
}

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

    const uploadsDir = getUploadsDir();
    await mkdir(uploadsDir, { recursive: true });

    const ext = file.type === "image/svg+xml" ? "svg" : "png";
    const filename = `${safeId}-avatar.${ext}`;
    const filePath = path.join(uploadsDir, filename);

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

    const uploadsDir = getUploadsDir();
    const publicDir = getPublicDir();

    // Search order: uploads first (user-uploaded), then public (built-in defaults)
    const searchDirs = [uploadsDir, publicDir];

    for (const dir of searchDirs) {
      for (const ext of ["png", "svg"]) {
        const filePath = path.join(dir, `${safeId}-avatar.${ext}`);
        try {
          const data = await readFile(filePath);
          const contentType = ext === "svg" ? "image/svg+xml" : "image/png";
          return new NextResponse(data, {
            headers: {
              "Content-Type": contentType,
              "Cache-Control": "public, max-age=86400, must-revalidate",
            },
          });
        } catch {
          // file doesn't exist, try next
        }
      }
    }

    // No file found — generate an SVG with the agent's initial and color
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
        "Cache-Control": "public, max-age=3600, must-revalidate",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to serve avatar" }, { status: 500 });
  }
}

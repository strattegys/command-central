import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { DEFAULT_WARM_OUTREACH_DISCOVERY } from "@/lib/warm-outreach-discovery";

/**
 * Packages API — CRUD for service packages.
 *
 * GET  ?stage=&customerId=&operational=true&includeStats=true
 *      operational=true → stage IN (ACTIVE, PAUSED, COMPLETED) for Friday ops board
 *      includeStats=true → total workflow items across package workflows
 * POST {templateId, name, customerId?, customerType?, spec?} — Create package
 * PATCH {id, stage?, spec?, name?} — Update package
 */

function isMissingPackageNumberColumn(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /packageNumber/i.test(msg) && (/does not exist/i.test(msg) || /column/i.test(msg));
}

export async function GET(req: NextRequest) {
  try {
    const stage = req.nextUrl.searchParams.get("stage");
    const customerId = req.nextUrl.searchParams.get("customerId");
    const operational =
      req.nextUrl.searchParams.get("operational") === "true" ||
      req.nextUrl.searchParams.get("operational") === "1";
    const includeStats =
      req.nextUrl.searchParams.get("includeStats") === "true" ||
      req.nextUrl.searchParams.get("includeStats") === "1";

    const params: unknown[] = [];
    const conditions: string[] = ['p."deletedAt" IS NULL'];

    if (operational) {
      conditions.push(`UPPER(p.stage::text) IN ('ACTIVE', 'PAUSED', 'COMPLETED')`);
    } else if (stage) {
      params.push(stage.toUpperCase());
      conditions.push(`p.stage = $${params.length}`);
    }
    if (customerId) {
      params.push(customerId);
      conditions.push(`p."customerId" = $${params.length}`);
    }

    const itemCountSelect = includeStats
      ? `, (SELECT COUNT(*)::int FROM "_workflow_item" wi
          INNER JOIN "_workflow" w ON w.id = wi."workflowId" AND w."deletedAt" IS NULL
          WHERE w."packageId" = p.id AND wi."deletedAt" IS NULL) AS "itemCount"`
      : "";

    const buildSql = (includePackageNumber: boolean) =>
      `SELECT p.id, p.name, p."templateId", p.stage, p.spec,
              ${includePackageNumber ? 'p."packageNumber",' : ""}
              p."customerId", p."customerType", p."createdBy", p."createdAt",
              (SELECT COUNT(*)::int FROM "_workflow" w
               WHERE w."packageId" = p.id AND w."deletedAt" IS NULL) AS "workflowCount"
              ${itemCountSelect}
       FROM "_package" p
       WHERE ${conditions.join(" AND ")}
       ORDER BY p."updatedAt" DESC NULLS LAST, p."createdAt" DESC
       LIMIT 100`;

    let rows: Record<string, unknown>[];
    try {
      rows = (await query(buildSql(true), params)) as Record<string, unknown>[];
    } catch (error) {
      if (isMissingPackageNumberColumn(error)) {
        console.warn("[packages] GET: packageNumber column missing — retrying without it (run migrate-package-number.sql)");
        rows = (await query(buildSql(false), params)) as Record<string, unknown>[];
        rows = rows.map((r) => ({ ...r, packageNumber: null }));
      } else {
        throw error;
      }
    }

    return NextResponse.json({ packages: rows });
  } catch (error) {
    console.error("[packages] GET error:", error);
    return NextResponse.json(
      { error: "Failed to list packages" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { templateId, name: nameInput, customerId, customerType, spec } = body;

    if (!templateId) {
      return NextResponse.json(
        { error: "templateId is required" },
        { status: 400 }
      );
    }

    const { PACKAGE_TEMPLATES } = await import("@/lib/package-types");
    const template = PACKAGE_TEMPLATES[templateId];
    if (!template) {
      return NextResponse.json(
        { error: `Unknown template: ${templateId}` },
        { status: 400 }
      );
    }

    const name =
      typeof nameInput === "string" && nameInput.trim() !== ""
        ? nameInput.trim()
        : template.label;

    const baseSpec =
      spec && typeof spec === "object" && !Array.isArray(spec)
        ? { ...spec }
        : { deliverables: template.deliverables };

    let pkgSpec: Record<string, unknown> = baseSpec;
    if (templateId === "vibe-coding-outreach") {
      const briefRaw = pkgSpec.brief;
      const briefStr = typeof briefRaw === "string" ? briefRaw.trim() : "";
      if (!briefStr) {
        const { TIM_WARM_OUTREACH_PACKAGE_BRIEF } = await import(
          "@/lib/package-spec-briefs/tim-warm-outreach-package-brief"
        );
        pkgSpec = { ...pkgSpec, brief: TIM_WARM_OUTREACH_PACKAGE_BRIEF };
      }
      const existingCadence =
        pkgSpec.warmOutreachDiscovery && typeof pkgSpec.warmOutreachDiscovery === "object"
          ? (pkgSpec.warmOutreachDiscovery as Record<string, unknown>)
          : {};
      pkgSpec = {
        ...pkgSpec,
        warmOutreachDiscovery: { ...DEFAULT_WARM_OUTREACH_DISCOVERY, ...existingCadence },
      };
    }

    let rows: Record<string, unknown>[];
    try {
      rows = (await query(
        `INSERT INTO "_package" ("templateId", name, "customerId", "customerType", spec, stage, "createdBy", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5::jsonb, 'DRAFT', 'penny', NOW(), NOW()) RETURNING id, "packageNumber"`,
        [templateId, name, customerId || null, customerType || "person", JSON.stringify(pkgSpec)]
      )) as Record<string, unknown>[];
    } catch (error) {
      if (isMissingPackageNumberColumn(error)) {
        rows = (await query(
          `INSERT INTO "_package" ("templateId", name, "customerId", "customerType", spec, stage, "createdBy", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5::jsonb, 'DRAFT', 'penny', NOW(), NOW()) RETURNING id`,
          [templateId, name, customerId || null, customerType || "person", JSON.stringify(pkgSpec)]
        )) as Record<string, unknown>[];
      } else {
        throw error;
      }
    }

    const row0 = rows[0] as Record<string, unknown>;
    return NextResponse.json({ id: row0.id, packageNumber: row0.packageNumber ?? null });
  } catch (error) {
    console.error("[packages] POST error:", error);
    return NextResponse.json(
      { error: "Failed to create package" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, stage, spec, name } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const sets: string[] = ['"updatedAt" = NOW()'];
    const params: unknown[] = [];

    if (stage) {
      const validStages = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "ACTIVE", "PAUSED", "COMPLETED"];
      if (!validStages.includes(stage.toUpperCase())) {
        return NextResponse.json(
          { error: `stage must be one of: ${validStages.join(", ")}` },
          { status: 400 }
        );
      }
      params.push(stage.toUpperCase());
      sets.push(`stage = $${params.length}`);
    }
    if (spec) {
      // Merge spec fields into existing spec (preserves deliverables when updating brief, etc.)
      params.push(JSON.stringify(spec));
      sets.push(`spec = COALESCE(spec, '{}'::jsonb) || $${params.length}::jsonb`);
    }
    if (name) {
      params.push(name);
      sets.push(`name = $${params.length}`);
    }

    params.push(id);
    await query(
      `UPDATE "_package" SET ${sets.join(", ")} WHERE id = $${params.length} AND "deletedAt" IS NULL`,
      params
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[packages] PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update package" },
      { status: 500 }
    );
  }
}

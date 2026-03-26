import { query } from "./db";

const LEGACY_TEMPLATE = "influencer-package";
const EMPTY_SPEC = JSON.stringify({
  deliverables: [],
  brief: "Migrated orphan workflow — edit in Penny.",
});

export interface OrphanWorkflowRow extends Record<string, unknown> {
  id: string;
  name: string | null;
  stage: string;
}

export async function listOrphanWorkflows(): Promise<OrphanWorkflowRow[]> {
  const rows = await query<OrphanWorkflowRow>(
    `SELECT id, name, stage FROM "_workflow"
     WHERE "deletedAt" IS NULL AND "packageId" IS NULL
     ORDER BY name NULLS LAST`
  );
  return rows;
}

export interface MigratedLink {
  workflowId: string;
  packageId: string;
  packageName: string;
}

export interface MigrateOrphansResult {
  dryRun: boolean;
  migrated: number;
  links: MigratedLink[];
}

/**
 * One DRAFT package per orphan workflow (same behavior as
 * scripts/migrate-orphan-workflows-to-packages.mjs).
 */
export async function migrateOrphanWorkflowsToPackages(
  dryRun: boolean,
  excludeIds: Set<string>
): Promise<MigrateOrphansResult> {
  const orphans = await listOrphanWorkflows();
  const targets = orphans.filter((w) => !excludeIds.has(String(w.id).toLowerCase()));
  const links: MigratedLink[] = [];

  if (dryRun) {
    for (const w of targets) {
      links.push({
        workflowId: w.id,
        packageId: "(dry-run)",
        packageName:
          (w.name && String(w.name).trim()) || `Legacy workflow ${String(w.id).slice(0, 8)}`,
      });
    }
    return { dryRun: true, migrated: 0, links };
  }

  for (const w of targets) {
    const pkgName =
      (w.name && String(w.name).trim()) || `Legacy workflow ${String(w.id).slice(0, 8)}`;
    const ins = await query<{ id: string }>(
      `INSERT INTO "_package" ("templateId", name, spec, stage, "createdBy", "createdAt", "updatedAt")
       VALUES ($1, $2, $3::jsonb, 'DRAFT', 'migration', NOW(), NOW())
       RETURNING id`,
      [LEGACY_TEMPLATE, pkgName, EMPTY_SPEC]
    );
    const packageId = ins[0].id as string;
    await query(`UPDATE "_workflow" SET "packageId" = $1, "updatedAt" = NOW() WHERE id = $2`, [
      packageId,
      w.id,
    ]);
    links.push({ workflowId: w.id, packageId, packageName: pkgName });
  }

  return { dryRun: false, migrated: targets.length, links };
}

export function parsePackageMigrationExcludeIds(): Set<string> {
  const raw = process.env.PACKAGE_MIGRATION_EXCLUDE_WORKFLOW_IDS || "";
  return new Set(
    raw
      .split(/[,;\s]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function allowOrphanPackageMigrationApi(): boolean {
  const v = process.env.ALLOW_ORPHAN_PACKAGE_MIGRATION;
  return (
    process.env.NODE_ENV === "development" ||
    v === "1" ||
    v === "true"
  );
}

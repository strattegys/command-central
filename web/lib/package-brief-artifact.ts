/**
 * Seeds the first workflow-item artifact with the package outreach / campaign brief.
 * Stage is not a Kanban column — artifact-only for ArtifactViewer ordering.
 */
import { query } from "@/lib/db";

export const PACKAGE_BRIEF_STAGE = "PACKAGE_BRIEF";

const ARTIFACT_NAME = "Package outreach brief";

export function formatPackageBriefMarkdown(brief: string): string {
  const t = brief.trim();
  if (!t) return "";
  return `# Package outreach brief\n\n${t}\n\n---\n*Snapshot from package \`spec.brief\` at item creation — edit the package card to change future items.*`;
}

/**
 * If the package has a non-empty `spec.brief`, inserts one PACKAGE_BRIEF artifact for the item.
 */
export async function insertPackageBriefArtifactIfPresent(
  workflowItemId: string,
  workflowId: string,
  packageId: string | null
): Promise<void> {
  if (!packageId?.trim()) return;

  const rows = await query<{ brief: string | null }>(
    `SELECT spec->>'brief' AS brief FROM "_package" WHERE id = $1 AND "deletedAt" IS NULL`,
    [packageId]
  );
  const brief = rows[0]?.brief?.trim() || "";
  if (!brief) return;

  const content = formatPackageBriefMarkdown(brief);
  await query(
    `INSERT INTO "_artifact" ("workflowItemId", "workflowId", stage, name, type, content, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
    [workflowItemId, workflowId, PACKAGE_BRIEF_STAGE, ARTIFACT_NAME, "markdown", content]
  );
}

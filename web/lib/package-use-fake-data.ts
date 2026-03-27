import { query } from "@/lib/db";

/**
 * Penny "Fake data" / template artifacts only apply while the package is in planner testing.
 * ACTIVE (and APPROVED, PAUSED, COMPLETED) always use real LLM/APIs in human-tasks resolve.
 */
export const PACKAGE_STAGES_ALLOWING_FAKE_DATA = new Set(["DRAFT", "PENDING_APPROVAL"]);

export function packageStageDisallowsFakeData(stage: string): boolean {
  return !PACKAGE_STAGES_ALLOWING_FAKE_DATA.has((stage || "").trim().toUpperCase());
}

/** Remove spec.useFakeData so DB matches "live package" semantics. */
export async function stripUseFakeDataFromPackageSpec(packageId: string): Promise<void> {
  const rows = await query<{ spec: unknown }>(
    `SELECT spec FROM "_package" WHERE id = $1 AND "deletedAt" IS NULL`,
    [packageId]
  );
  if (rows.length === 0) return;
  const raw = rows[0].spec;
  const spec = typeof raw === "string" ? JSON.parse(raw) : { ...(raw as object) };
  if (!("useFakeData" in spec)) return;
  delete (spec as { useFakeData?: boolean }).useFakeData;
  await query(
    `UPDATE "_package" SET spec = $1::jsonb, "updatedAt" = NOW() WHERE id = $2`,
    [JSON.stringify(spec), packageId]
  );
}

export async function stripUseFakeDataWhenPackageNotInTesting(
  packageId: string,
  newStage: string
): Promise<void> {
  if (!packageStageDisallowsFakeData(newStage)) return;
  await stripUseFakeDataFromPackageSpec(packageId);
}

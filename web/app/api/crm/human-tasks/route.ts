import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { WORKFLOW_TYPES } from "@/lib/workflow-types";

/**
 * GET /api/crm/human-tasks?packageStage=ACTIVE&ownerAgent=tim&messagingOnly=true
 *
 * Optional:
 * - packageStage — filter by _package.stage (e.g. ACTIVE for Friday queue)
 * - ownerAgent — filter workflows by owner agent (e.g. tim)
 * - messagingOnly — only tasks whose item stage is messaging-related (DM / reply / connection)
 */
const MESSAGING_ITEM_STAGES = new Set([
  "INITIATED",
  "AWAITING_CONTACT",
  "MESSAGE_DRAFT",
  "MESSAGED",
  "REPLY_DRAFT",
  "REPLY_SENT",
]);

export async function GET(req: NextRequest) {
  const packageStageFilter = req.nextUrl.searchParams.get("packageStage");
  const ownerAgentFilter = req.nextUrl.searchParams.get("ownerAgent")?.trim().toLowerCase() || null;
  const messagingOnly =
    req.nextUrl.searchParams.get("messagingOnly") === "true" ||
    req.nextUrl.searchParams.get("messagingOnly") === "1";
  try {
    // Build a set of all human-required stages per workflow type
    const humanStages = new Map<string, Map<string, { humanAction: string; stageLabel: string }>>();
    for (const [typeId, spec] of Object.entries(WORKFLOW_TYPES)) {
      const stageMap = new Map<string, { humanAction: string; stageLabel: string }>();
      for (const stage of spec.defaultBoard.stages) {
        if (stage.requiresHuman && stage.humanAction) {
          stageMap.set(stage.key, { humanAction: stage.humanAction, stageLabel: stage.label });
        }
      }
      if (stageMap.size > 0) humanStages.set(typeId, stageMap);
    }

    const workflowStageClause = messagingOnly
      ? `w.stage::text IN ('ACTIVE', 'PLANNING', 'PAUSED')`
      : `w.stage::text = 'ACTIVE'`;

    const ownerClause = ownerAgentFilter ? `AND LOWER(w."ownerAgent") = $1` : "";
    const workflowParams: unknown[] = ownerAgentFilter ? [ownerAgentFilter] : [];

    const workflows = await query<{
      id: string;
      name: string;
      ownerAgent: string;
      packageId: string | null;
      stage: string;
      spec: { targetCount?: number };
      itemType: string;
    }>(
      `SELECT w.id, w.name, w."ownerAgent", w."packageId", w.stage, w.spec, w."itemType"
       FROM "_workflow" w
       WHERE w."deletedAt" IS NULL AND ${workflowStageClause}
       ${ownerClause}
       ORDER BY w."updatedAt" DESC NULLS LAST`,
      workflowParams
    );

    // For each workflow, find its workflow type by matching against WORKFLOW_TYPES
    // We need to determine which workflow type each workflow uses
    // The workflow type is embedded in the board stages — match by ownerAgent + workflowTypes registry
    // Build package name lookup
    const packageNames: Record<string, string> = {};
    const packageStages: Record<string, string> = {};
    const packageNumbers: Record<string, number | null> = {};
    const pkgIds = [...new Set(workflows.map(w => w.packageId).filter(Boolean))] as string[];
    if (pkgIds.length > 0) {
      const pkgPlaceholders = pkgIds.map((_, i) => `$${i + 1}`).join(", ");
      const pkgs = await query<{ id: string; name: string; stage: string; packageNumber: number | null }>(
        `SELECT id, name, stage, "packageNumber" FROM "_package" WHERE id IN (${pkgPlaceholders}) AND "deletedAt" IS NULL`,
        pkgIds
      );
      for (const p of pkgs) {
        packageNames[p.id] = p.name;
        packageStages[p.id] = (p.stage || "").toUpperCase();
        packageNumbers[p.id] =
          p.packageNumber != null && typeof p.packageNumber === "number"
            ? p.packageNumber
            : p.packageNumber != null
              ? parseInt(String(p.packageNumber), 10)
              : null;
      }
    }

    // Filter workflows by package stage if requested
    const filteredWorkflows = packageStageFilter
      ? workflows.filter(w => !w.packageId || packageStages[w.packageId] === packageStageFilter.toUpperCase())
      : workflows;

    const tasks: Array<{
      itemId: string;
      itemTitle: string;
      itemSubtitle: string;
      workflowId: string;
      workflowName: string;
      packageName: string;
      ownerAgent: string;
      packageId: string | null;
      packageNumber: number | null;
      packageStage: string | null;
      inActiveCampaign: boolean;
      workflowType: string;
      stage: string;
      stageLabel: string;
      humanAction: string;
      dueDate: string | null;
      itemType: string;
      createdAt: string;
    }> = [];

    for (const wf of filteredWorkflows) {
      // Determine workflow type from the spec.workflowType field
      let wfSpec: Record<string, unknown> | null = null;
      try {
        wfSpec = typeof wf.spec === "string" ? JSON.parse(wf.spec as unknown as string) : wf.spec;
      } catch {
        // spec is not valid JSON (e.g. markdown) — skip this workflow
        continue;
      }
      const matchedType = wfSpec?.workflowType as string | undefined;
      const workflowTypeId = matchedType || "";

      if (!matchedType || !humanStages.has(matchedType)) continue;
      const stageMap = humanStages.get(matchedType);
      if (!stageMap) continue;

      // Get all human-stage keys for this workflow type (optionally only messaging stages)
      let humanStageKeys = Array.from(stageMap.keys());
      if (messagingOnly) {
        humanStageKeys = humanStageKeys.filter((k) => MESSAGING_ITEM_STAGES.has(k));
      }
      if (humanStageKeys.length === 0) continue;

      // Query items in human-required stages for this workflow
      const placeholders = humanStageKeys.map((_, i) => `$${i + 2}`).join(", ");
      const items = await query<{
        id: string;
        workflowId: string;
        stage: string;
        sourceType: string;
        sourceId: string;
        dueDate: string | null;
        createdAt: string;
      }>(
        `SELECT wi.id, wi."workflowId", wi.stage, wi."sourceType", wi."sourceId", wi."dueDate", wi."createdAt"
         FROM "_workflow_item" wi
         WHERE wi."workflowId" = $1
           AND wi.stage IN (${placeholders})
           AND wi."deletedAt" IS NULL
         ORDER BY wi."dueDate" ASC NULLS FIRST, wi."createdAt" ASC`,
        [wf.id, ...humanStageKeys]
      );

      for (const item of items) {
        const stageInfo = stageMap.get(item.stage);
        if (!stageInfo) continue;

        // Get item display info
        let title = "Unknown";
        let subtitle = "";

        if (item.sourceType === "person") {
          const persons = await query<{ firstName: string; lastName: string; jobTitle: string }>(
            `SELECT "nameFirstName" AS "firstName", "nameLastName" AS "lastName", "jobTitle"
             FROM person WHERE id = $1 AND "deletedAt" IS NULL`,
            [item.sourceId]
          );
          if (persons.length > 0) {
            title = [persons[0].firstName, persons[0].lastName].filter(Boolean).join(" ") || "Unknown";
            subtitle = persons[0].jobTitle || "";
          }
          if (
            item.stage === "AWAITING_CONTACT" &&
            matchedType === "warm-outreach" &&
            title === "Next Contact"
          ) {
            title = "Next contact";
            subtitle = subtitle || "Provide details below";
          }
        } else if (item.sourceType === "content") {
          const contents = await query<{ title: string; contentType: string }>(
            `SELECT title, "contentType" FROM "_content_item" WHERE id = $1 AND "deletedAt" IS NULL`,
            [item.sourceId]
          );
          if (contents.length > 0) {
            title = contents[0].title || "Untitled";
            subtitle = contents[0].contentType || "content";
          }
        }

        const pkgStage = wf.packageId ? packageStages[wf.packageId] || null : null;
        const inActiveCampaign = Boolean(wf.packageId && pkgStage === "ACTIVE");
        const pkgNum =
          wf.packageId && packageNumbers[wf.packageId] != null && !Number.isNaN(packageNumbers[wf.packageId] as number)
            ? packageNumbers[wf.packageId]
            : null;

        tasks.push({
          itemId: item.id,
          itemTitle: title,
          itemSubtitle: subtitle,
          workflowId: wf.id,
          workflowName: wf.name,
          packageName: wf.packageId ? (packageNames[wf.packageId] || "") : "",
          ownerAgent: wf.ownerAgent,
          packageId: wf.packageId,
          packageNumber: pkgNum,
          packageStage: pkgStage,
          inActiveCampaign,
          workflowType: workflowTypeId,
          stage: item.stage,
          stageLabel: stageInfo.stageLabel,
          humanAction: stageInfo.humanAction,
          dueDate: item.dueDate || null,
          itemType: item.sourceType,
          createdAt: item.createdAt,
        });
      }
    }

    return NextResponse.json({ tasks, count: tasks.length });
  } catch (error) {
    console.error("[human-tasks] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch human tasks" }, { status: 500 });
  }
}

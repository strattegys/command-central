import { TIM_COLLABORATION_FRAMEWORK } from "@/lib/tim-work-context";

/** Selected row in Ghost’s content work queue — sent as ephemeral chat context. */
export type GhostWorkQueueSelection = {
  itemId: string;
  stage: string;
  stageLabel: string;
  itemTitle: string;
  workflowName: string;
  humanAction: string;
  focusedArtifactStage: string | null;
  focusedArtifactLabel: string | null;
};

/** Stages where the artifact is a long-form doc — merge edits, do not replace with the chat line only. */
const CONTENT_MERGE_STAGES = new Set([
  "CAMPAIGN_SPEC",
  "REVIEW",
  "DRAFT_PUBLISHED",
  "DRAFTING",
  "IDEA",
  "PACKAGE_BRIEF",
]);

/** Tim-owned messaging tabs if they ever appear on a content item — full body replace is OK. */
const MESSAGING_FULL_REPLACE_STAGES = new Set(["MESSAGE_DRAFT", "REPLY_DRAFT"]);

export function formatGhostWorkQueueContext(s: GhostWorkQueueSelection): string {
  const focusStage = s.focusedArtifactStage?.trim() || null;
  const focusLabel = s.focusedArtifactLabel?.trim() || null;
  const fs = focusStage?.toUpperCase() || "";

  const lines = [
    TIM_COLLABORATION_FRAMEWORK,
    ``,
    `The user has this **content** workflow item selected in Ghost’s work panel. Treat questions as about this piece unless they clearly mean something else.`,
    ``,
    `**Artifact updates (Ghost):** For CAMPAIGN_SPEC, REVIEW, DRAFT_PUBLISHED, DRAFTING, and similar long-form tabs, you must **preserve the existing document** unless Govind clearly asks to throw it away and start over. Use \`workflow_items\` **get-workflow-artifact** (arg1=item id below, arg2=stage key) to read the current markdown, apply his requested changes, then **update-workflow-artifact** with arg3 = the **complete** updated document. **Never** set arg3 to only his latest chat message when he meant “change X” or “add Y”.`,
    `**Tim-style exception:** If the open tab were MESSAGE_DRAFT or REPLY_DRAFT (outbound LinkedIn body), putting the **full** outbound message in arg3 is correct when he wants that exact text sent.`,
    ``,
  ];

  if (focusStage && focusLabel) {
    const mergeDoc = CONTENT_MERGE_STAGES.has(fs);
    const msgDraft = MESSAGING_FULL_REPLACE_STAGES.has(fs);
    if (msgDraft) {
      lines.push(
        `UI FOCUS: **${focusLabel}** (\`${focusStage}\`) — outbound message body. ` +
          `If Govind wants a specific send text, \`update-workflow-artifact\` arg3 = the **entire** message.`
      );
    } else if (mergeDoc) {
      lines.push(
        `UI FOCUS: **${focusLabel}** (\`${focusStage}\`) — long-form content. ` +
          `Call **get-workflow-artifact** with arg2=\`${focusStage}\` first, then **update-workflow-artifact** with the merged full markdown. ` +
          `The work panel **Submit** still controls human-task approval when applicable.`
      );
      if (fs === "CAMPAIGN_SPEC") {
        lines.push(
          `**CAMPAIGN_SPEC — expand / rework requests:** If Govind asks to **rework**, **expand**, **clarify**, **think through**, or **make the direction easier to follow**, do **not** replace the spec with a single short paragraph. ` +
            `Produce a **scannable outline**: working thesis (2–4 sentences), **4–8 H2-level section titles** each with one clarifying sentence, target reader, 3–6 key takeaways, open questions / research gaps, and an updated **Distribution plan** section if relevant. ` +
            `**Preserve** long pasted research, tables, or notes unless he explicitly asks to trim or remove them.`
        );
      }
    } else {
      lines.push(
        `UI FOCUS: **${focusLabel}** (\`${focusStage}\`). ` +
          `Prefer **get-workflow-artifact** then **update-workflow-artifact** with full updated markdown unless this stage is clearly a short single field.`
      );
    }
    lines.push(``);
  } else {
    lines.push(
      `When an artifact tab is open, read it with **get-workflow-artifact** before overwriting. Use **update-workflow-artifact** with arg1 = workflow item id, arg2 = stage key, arg3 = full markdown.`,
      ``
    );
  }

  lines.push(
    `Workflow item id: ${s.itemId}`,
    `Content title: ${s.itemTitle}`,
    `Workflow: ${s.workflowName}`,
    `Human-task stage: ${s.stageLabel} (${s.stage})`,
  );
  if (s.humanAction?.trim()) lines.push(`Human task: ${s.humanAction.trim()}`);
  return lines.join("\n");
}

/**
 * Suzi work panel — single source of truth for sub-tab ↔ tool mapping and ephemeral LLM context.
 * When tabs change, update this module and the panel UI together.
 */

export type SuziWorkSubTab = "punchlist" | "reminders" | "notes" | "intake";

export type SuziWorkPanelContextInput = {
  /** True when the right rail is showing Suzi's work panel (not Agent info). */
  workPanelOpen: boolean;
  /** Active sub-tab inside the work panel. Ignored if workPanelOpen is false. */
  subTab: SuziWorkSubTab;
};

type TabSpec = {
  uiLabel: string;
  primaryTool: "punch_list" | "reminders" | "notes" | "intake";
  purpose: string;
  commands: string;
  ids: string;
};

const TABS: Record<SuziWorkSubTab, TabSpec> = {
  punchlist: {
    uiLabel: "Punch List",
    primaryTool: "punch_list",
    purpose:
      "Engineering / ops tasks in Kanban columns (Now, Later, Next, Sometime, Backlog, Idea). Not calendar reminders, not reference notes, not Intake captures.",
    commands:
      "punch_list: list | add (NEW item only) | update (move # — item_number + rank) | done / close_out / finish (complete an item — item_number) | reopen | archive | archive_done | note. After done/close_out, reply briefly; do not dump full list unless asked.",
    ids: "Item numbers on cards (e.g. 1001). Comma-separate for batch done.",
  },
  reminders: {
    uiLabel: "Reminders",
    primaryTool: "reminders",
    purpose:
      "Time-based items: birthdays, holidays, recurring checks, one-time due tasks. Uses due dates and optional recurrence (Pacific). For arbitrary reference facts without a schedule, use the notes tool and the Notes tab — not this tool.",
    commands:
      "reminders: list | search | add | update | delete | upcoming. add requires category (birthday, holiday, recurring, one-time) and usually a date.",
    ids: "Reminder UUID from list/search output (id: …).",
  },
  notes: {
    uiLabel: "Notes",
    primaryTool: "notes",
    purpose:
      "Durable reference notes Govind browses in the Notes tab — facts, preferences, snippets. Separate from reminders, punch_list, and Intake (links/snippets inbox).",
    commands:
      "notes: list | add | update | delete | search. Use note_number (#5001-style) from list output when editing.",
    ids: "note_number (e.g. 5001) or UUID.",
  },
  intake: {
    uiLabel: "Intake",
    primaryTool: "intake",
    purpose:
      "Capture inbox in the Intake tab — links, snippets, things to triage later (may become punch list or article research later). Not structured notes (use notes) and not scheduled items (use reminders). Items can also arrive via Share (Android PWA) or inbound email webhook.",
    commands:
      "intake: list | add | update | delete | search. add needs title; optional url, body. Use id from list output for update/delete.",
    ids: "UUID from list output (id: …).",
  },
};

const GLOBAL_TOOLS =
  "Also available: web_search, memory (your long-term agent memory — not the Notes tab).";

/** When the work panel is closed, remind the model tools still apply from chat. */
const PANEL_CLOSED_HINT =
  "Suzi's work panel is closed (Agent info or another view). The user may still ask to change punch list, reminders, notes, or intake — use the correct tool from their request; open the work panel to mirror the same tabs.";

export function formatSuziWorkPanelContext(input: SuziWorkPanelContextInput): string {
  if (!input.workPanelOpen) {
    return [
      "## Suzi — UI context",
      PANEL_CLOSED_HINT,
      "",
      "### Tab ↔ tool (reference)",
      `- **${TABS.punchlist.uiLabel}** → \`punch_list\` — ${TABS.punchlist.purpose}`,
      `- **${TABS.reminders.uiLabel}** → \`reminders\` — ${TABS.reminders.purpose}`,
      `- **${TABS.notes.uiLabel}** → \`notes\` — ${TABS.notes.purpose}`,
      `- **${TABS.intake.uiLabel}** → \`intake\` — ${TABS.intake.purpose}`,
      "",
      GLOBAL_TOOLS,
    ].join("\n");
  }

  const spec = TABS[input.subTab];
  const punchMustUseTool =
    input.subTab === "punchlist"
      ? [
          "",
          "**Execution rule (Punch List tab):** When the user asks to add, move, complete, archive, or list punch-list items, you must complete a **real** `punch_list` tool call in this turn (via the API). Do not only describe or show JSON — that does not change the board.",
        ]
      : [];

  const intakeMustUseTool =
    input.subTab === "intake"
      ? [
          "",
          "**Execution rule (Intake tab):** When the user asks to add, remove, list, or search Intake captures, you must complete a **real** `intake` tool call in this turn. Do not claim you saved something without calling the tool.",
        ]
      : [];

  return [
    "## Suzi — active work panel",
    `The user has the **${spec.uiLabel}** tab open in the right work panel.`,
    "",
    `**Primary tool:** \`${spec.primaryTool}\``,
    spec.purpose,
    ...punchMustUseTool,
    ...intakeMustUseTool,
    "",
    "**Commands:**",
    spec.commands,
    "",
    "**IDs:**",
    spec.ids,
    "",
    GLOBAL_TOOLS,
  ].join("\n");
}

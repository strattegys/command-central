import {
  listPunchListItems,
  addPunchListItem,
  updatePunchListItem,
  archivePunchListItem,
  archiveDoneItems,
  addNote,
} from "../punch-list";
import {
  parsePunchListRank,
  punchListColumnLabel,
  punchListColumnsSummary,
} from "../punch-list-columns";
import type { ToolModule } from "./types";

const RANK_HELP = `Column (rank 1–6): ${punchListColumnsSummary()}. You may pass a number or a name like "now", "later", "next", "sometime", "backlog", "idea" (also "some time").`;

/** LLMs often emit action/item_id instead of command/item_number — map so tools still run. */
function normalizePunchListArgs(raw: Record<string, string>): Record<string, string> {
  const args: Record<string, string> = { ...raw };
  if (!args.command && args.action) {
    const a = args.action.toLowerCase().replace(/-/g, "_");
    const actionToCommand: Record<string, string> = {
      mark_done: "done",
      mark_as_done: "done",
      complete: "done",
      done: "done",
      reopen: "reopen",
      list: "list",
      add: "add",
      update: "update",
      move: "update",
      move_to: "update",
      move_to_column: "update",
      archive: "archive",
      archive_done: "archive_done",
      note: "note",
    };
    if (actionToCommand[a]) args.command = actionToCommand[a];
  }
  const idish = args.item_id || args.itemId;
  if (idish && !args.item_number && !args.id) {
    const s = String(idish).replace(/^#/, "").trim();
    if (/^\d+$/.test(s)) args.item_number = s;
    else args.id = s;
  }
  const rawCmd = (args.command || "")
    .toLowerCase()
    .replace(/-/g, "_")
    .replace(/\s+/g, "_")
    .trim();
  if (rawCmd === "move" || rawCmd === "move_to" || rawCmd === "move_to_column") {
    args.command = "update";
  }
  // "Close out #1043" → models often emit command close_out / close / finish
  const doneAliases = new Set([
    "close_out",
    "closeout",
    "close",
    "finish",
    "resolve",
    "complete",
    "mark_done",
    "mark_as_done",
  ]);
  if (doneAliases.has(rawCmd)) {
    args.command = "done";
  }
  return args;
}

/** Comma/space-separated #numbers from item_number and optional item_numbers. */
function itemNumberTokens(args: Record<string, string>): string[] {
  const combined = [args.item_number, args.item_numbers].filter(Boolean).join(",");
  if (!combined.trim()) return [];
  return combined
    .split(/[\s,]+/)
    .map((s) => s.replace(/^#/, "").trim())
    .filter(Boolean);
}

const tool: ToolModule = {
  metadata: {
    id: "punch_list",
    displayName: "Punch List",
    category: "internal",
    description:
      "Track application fixes and improvements for the agent team environment.",
    operations: ["list", "add", "update", "done", "reopen", "archive", "archive_done", "note"],
    requiresApproval: false,
  },

  declaration: {
    name: "punch_list",
    description: `Manage the punch list (Kanban columns). Use parameter command (not "action"): list, add, update, done, reopen, archive, archive_done, note.
CRITICAL — Moving an existing card to another column (e.g. "move #1040 to Next"): use command **update** with item_number="1040" and rank="next" (or 1–6). Do **NOT** use **add** when the user names an existing item number — add always creates a NEW # and duplicates work.
**add** only when creating a brand-new item (needs title, rank, category). **update** to change column (rank), title, description, or category on an existing #.
**done** (or synonyms **close_out**, **close**, **finish**) marks an item complete — use item_number for the # the user said (e.g. "close out 1043" → command done, item_number=1043). After marking done, do **not** paste the entire punch list unless the user asks; confirm briefly with the item #.
For item IDs use item_number with the # shown on cards. Batch mark done: command done and item_number "1032,1033". ${RANK_HELP} Category is a short tag for new items.`,
    parameters: {
      type: "object" as const,
      properties: {
        command: {
          type: "string",
          description:
            "list | add (new item only) | update (move/edit #) | done (mark complete — also: close_out, close, finish) | reopen | archive | archive_done | note",
        },
        title: {
          type: "string",
          description: "Item title (for add/update)",
        },
        description: {
          type: "string",
          description: "Optional details (for add/update)",
        },
        rank: {
          type: "string",
          description: `Kanban column for add or update: 1–6 or name (Now, Later, Next, Sometime, Backlog, Idea). Required to move an item: update + item_number + rank. ${RANK_HELP}`,
        },
        category: {
          type: "string",
          description:
            "Required for add. Short tag (e.g. ui, bug, feature). Prefer matching an existing category from the punch list UI when the user's words map clearly; otherwise ask.",
        },
        item_number: {
          type: "string",
          description:
            "Persistent item number(s) as shown on cards (e.g. '1001' or '1001,1023'). For done/reopen/archive on several items, pass comma-separated numbers in ONE call instead of many tool calls.",
        },
        item_numbers: {
          type: "string",
          description:
            "Optional extra numbers when batching (usually prefer comma-separated item_number). Same format as item_number.",
        },
        id: {
          type: "string",
          description: "Item UUID (for update/done/reopen/archive/note — use item_number instead when possible)",
        },
        content: {
          type: "string",
          description: "Note content (for note command)",
        },
      },
      required: ["command"],
    },
  },

  async execute(args0, { agentId }) {
    const args = normalizePunchListArgs(args0);
    const cmd = args.command;

    if (cmd === "list") {
      const items = await listPunchListItems(agentId, {
        status: args.status as "open" | "done" | undefined,
      });
      if (items.length === 0) return "No punch list items found.";
      return items
        .map(
          (item) => {
            const latestNote = item.notes?.[0];
            const col = punchListColumnLabel(item.rank);
            let line = `#${item.itemNumber} [${col}]${item.category ? ` [${item.category}]` : ""} ${item.status === "done" ? "DONE " : ""}${item.title}`;
            if (item.description) line += ` — ${item.description}`;
            if (latestNote) line += `\n   Latest note: "${latestNote.content}"`;
            return line;
          }
        )
        .join("\n");
    }

    if (cmd === "add") {
      const addTokens = itemNumberTokens(args);
      if (addTokens.length > 0 || (args.item_number && String(args.item_number).trim())) {
        return (
          "Error: You passed an item number with command **add**. **add** only creates NEW items. " +
          "To move or edit an existing card (e.g. #1040 to Next), use command **update** with item_number and rank (e.g. rank=next). " +
          "Do not create a duplicate item."
        );
      }
      if (!args.title) return "Error: title is required";
      if (!args.rank) {
        return `Error: Ask which column this belongs in (${punchListColumnsSummary()}).`;
      }
      if (!args.category) {
        return "Error: Every punch list item needs a category tag. Infer from context or ask.";
      }
      const rank = parsePunchListRank(String(args.rank));
      if (rank === null) {
        return `Error: Invalid column "${args.rank}". Use ${RANK_HELP}`;
      }
      const item = await addPunchListItem(agentId, {
        title: args.title,
        description: args.description,
        rank,
        category: args.category,
      });
      return `Punch list item created: #${item.itemNumber} "${item.title}" [${punchListColumnLabel(item.rank)}] [${item.category}]`;
    }

    const tokens = itemNumberTokens(args);
    if (
      tokens.length > 1 &&
      (cmd === "done" || cmd === "reopen" || cmd === "archive")
    ) {
      const items = await listPunchListItems(agentId);
      const lines: string[] = [];
      for (const t of tokens) {
        const itemNum = parseInt(t, 10);
        if (Number.isNaN(itemNum)) {
          lines.push(`Error: Invalid item number "${t}".`);
          continue;
        }
        const match = items.find((i) => i.itemNumber === itemNum);
        if (!match) {
          lines.push(`Error: Item #${t} not found.`);
          continue;
        }
        if (cmd === "done") {
          await updatePunchListItem(match.id, { status: "done" });
          lines.push(`Punch list item #${itemNum} marked done.`);
        } else if (cmd === "reopen") {
          await updatePunchListItem(match.id, { status: "open" });
          lines.push(`Punch list item #${itemNum} reopened.`);
        } else {
          await archivePunchListItem(match.id);
          lines.push(`Punch list item #${itemNum} archived.`);
        }
      }
      return lines.join("\n");
    }

    if (
      tokens.length > 1 &&
      cmd &&
      !["done", "reopen", "archive"].includes(cmd)
    ) {
      return `Error: One item per call for "${cmd}". To mark several done at once, use command "done" with item_number "1032,1033" (comma-separated).`;
    }

    // Resolve single item number to ID
    let resolvedId = args.id;
    if (tokens.length === 1 && !resolvedId) {
      const items = await listPunchListItems(agentId);
      const itemNum = parseInt(tokens[0], 10);
      const match = Number.isNaN(itemNum)
        ? undefined
        : items.find((i) => i.itemNumber === itemNum);
      if (match) {
        resolvedId = match.id;
      } else if (["update", "done", "reopen", "archive", "note"].includes(cmd || "")) {
        return `Error: Item #${tokens[0]} not found.`;
      }
    }

    if (cmd === "update") {
      if (!resolvedId) return "Error: id or item_number is required for update";
      const updates: Record<string, unknown> = {};
      if (args.title) updates.title = args.title;
      if (args.description) updates.description = args.description;
      if (args.category) updates.category = args.category;
      if (args.rank) {
        const r = parsePunchListRank(String(args.rank));
        if (r === null) return `Error: Invalid column "${args.rank}". ${RANK_HELP}`;
        updates.rank = r;
      }
      if (Object.keys(updates).length === 0) {
        return "Error: update needs at least one of: rank (column move), title, description, category";
      }
      await updatePunchListItem(resolvedId, updates);
      const after = (await listPunchListItems(agentId)).find((i) => i.id === resolvedId);
      if (after) {
        return `Punch list item #${after.itemNumber} "${after.title}" — now [${punchListColumnLabel(after.rank)}]${after.category ? ` [${after.category}]` : ""}`;
      }
      return "Punch list item updated.";
    }

    if (cmd === "done") {
      if (!resolvedId) return "Error: id or item_number is required";
      const before = (await listPunchListItems(agentId)).find((i) => i.id === resolvedId);
      await updatePunchListItem(resolvedId, { status: "done" });
      const num = before?.itemNumber ?? tokens[0] ?? "?";
      const title = before?.title ? ` "${before.title}"` : "";
      return `Punch list item #${num}${title} marked done.`;
    }

    if (cmd === "reopen") {
      if (!resolvedId) return "Error: id or item_number is required";
      const before = (await listPunchListItems(agentId)).find((i) => i.id === resolvedId);
      await updatePunchListItem(resolvedId, { status: "open" });
      const num = before?.itemNumber ?? tokens[0] ?? "?";
      return `Punch list item #${num} reopened.`;
    }

    if (cmd === "archive") {
      if (!resolvedId) return "Error: id or item_number is required";
      const before = (await listPunchListItems(agentId)).find((i) => i.id === resolvedId);
      await archivePunchListItem(resolvedId);
      const num = before?.itemNumber ?? tokens[0] ?? "?";
      return `Punch list item #${num} archived.`;
    }

    if (cmd === "archive_done") {
      const count = await archiveDoneItems(agentId);
      return `Archived ${count} completed items.`;
    }

    if (cmd === "note") {
      if (!resolvedId) return "Error: id or item_number is required";
      if (!args.content) return "Error: content is required for adding a note";
      const row = (await listPunchListItems(agentId)).find((i) => i.id === resolvedId);
      await addNote(resolvedId, args.content);
      const itemNum = row?.itemNumber ?? tokens[0] ?? "?";
      return `Note added to punch list item #${itemNum}.`;
    }

    return "Unknown punch_list command. Use: list, add, update, done, reopen, archive, archive_done, note";
  },
};

export default tool;

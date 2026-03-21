import {
  listPunchListItems,
  addPunchListItem,
  updatePunchListItem,
  deletePunchListItem,
} from "../punch-list";
import type { ToolModule } from "./types";

const tool: ToolModule = {
  metadata: {
    id: "punch_list",
    displayName: "Punch List",
    category: "internal",
    description:
      "Track application fixes and improvements for the agent team environment.",
    operations: ["list", "add", "update", "done", "reopen", "delete"],
    requiresApproval: false,
  },

  declaration: {
    name: "punch_list",
    description:
      "Manage the punch list of app fixes and improvements. Commands: 'list' (all open items), 'add' (new item), 'update' (modify), 'done' (mark complete), 'reopen' (mark open again), 'delete' (remove). Rank 1-8 where 1 = highest priority.",
    parameters: {
      type: "object" as const,
      properties: {
        command: {
          type: "string",
          description: "list, add, update, done, reopen, or delete",
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
          description: "Priority 1-8, 1 = highest (for add/update)",
        },
        id: {
          type: "string",
          description: "Item UUID (for update/done/reopen/delete)",
        },
      },
      required: ["command"],
    },
  },

  async execute(args, { agentId }) {
    const cmd = args.command;

    if (cmd === "list") {
      const items = await listPunchListItems(agentId, {
        status: args.status as "open" | "done" | undefined,
      });
      if (items.length === 0) return "No punch list items found.";
      return items
        .map(
          (item) =>
            `[R${item.rank}] ${item.status === "done" ? "DONE " : ""}${item.title}${item.description ? ` — ${item.description}` : ""} (id: ${item.id})`
        )
        .join("\n");
    }

    if (cmd === "add") {
      if (!args.title) return "Error: title is required";
      const rank = args.rank ? parseInt(args.rank) : undefined;
      if (rank !== undefined && (rank < 1 || rank > 8))
        return "Error: rank must be 1-8";
      const item = await addPunchListItem(agentId, {
        title: args.title,
        description: args.description,
        rank,
      });
      return `Punch list item created: "${item.title}" [rank ${item.rank}] (id: ${item.id})`;
    }

    if (cmd === "update") {
      if (!args.id) return "Error: id is required for update";
      const updates: Record<string, unknown> = {};
      if (args.title) updates.title = args.title;
      if (args.description) updates.description = args.description;
      if (args.rank) {
        const r = parseInt(args.rank);
        if (r < 1 || r > 8) return "Error: rank must be 1-8";
        updates.rank = r;
      }
      await updatePunchListItem(args.id, updates);
      return `Punch list item ${args.id} updated.`;
    }

    if (cmd === "done") {
      if (!args.id) return "Error: id is required";
      await updatePunchListItem(args.id, { status: "done" });
      return `Punch list item ${args.id} marked done.`;
    }

    if (cmd === "reopen") {
      if (!args.id) return "Error: id is required";
      await updatePunchListItem(args.id, { status: "open" });
      return `Punch list item ${args.id} reopened.`;
    }

    if (cmd === "delete") {
      if (!args.id) return "Error: id is required";
      await deletePunchListItem(args.id);
      return `Punch list item ${args.id} deleted.`;
    }

    return "Unknown punch_list command. Use: list, add, update, done, reopen, delete";
  },
};

export default tool;

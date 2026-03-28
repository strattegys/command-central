import { listIntake, addIntake, updateIntake, deleteIntake } from "../intake";
import type { ToolModule } from "./types";

const tool: ToolModule = {
  metadata: {
    id: "intake",
    displayName: "Intake",
    category: "internal",
    description:
      "Suzi Intake tab — capture inbox for links, snippets, and things to triage (UI, Share, email, or chat). Not notes, not punch list, not reminders.",
    operations: ["list", "add", "update", "delete", "search"],
    requiresApproval: false,
  },

  declaration: {
    name: "intake",
    description:
      "The **only** tool for items in Suzi's **Intake** work tab — a capture inbox (URLs, pasted text, things to process later). When the user says **add an intake item**, **save this to intake**, **intake:**, **put this link in intake**, or similar, you must call this tool with `command: add` (title required; url/body when known). For reference facts use **notes**. For tasks with columns use **punch_list**. For dates use **reminders**. Never claim you saved an intake item without calling this tool. Commands: list, add, update (id), delete (id), search.",
    parameters: {
      type: "object" as const,
      properties: {
        command: {
          type: "string",
          description: "list, add, update, delete, or search",
        },
        title: {
          type: "string",
          description: "Title for add/update",
        },
        url: {
          type: "string",
          description: "Optional URL for add/update",
        },
        body: {
          type: "string",
          description: "Optional text body / snippet for add/update",
        },
        id: {
          type: "string",
          description: "Intake item UUID for update/delete (from list output)",
        },
        query: {
          type: "string",
          description: "Search text for search command",
        },
      },
      required: ["command"],
    },
  },

  async execute(args, { agentId }) {
    const cmd = args.command;

    if (cmd === "list") {
      const items = await listIntake(agentId);
      if (items.length === 0) return "No intake items.";
      return items
        .map(
          (it) =>
            `• ${it.title}${it.url ? ` — ${it.url}` : ""}${it.body ? `\n  ${it.body.slice(0, 120)}${it.body.length > 120 ? "…" : ""}` : ""}\n  id: ${it.id}  source: ${it.source}`
        )
        .join("\n\n");
    }

    if (cmd === "add") {
      if (!args.title?.trim()) return "Error: title is required for add";
      const item = await addIntake(agentId, {
        title: args.title.trim(),
        url: args.url?.trim() || undefined,
        body: args.body?.trim() || undefined,
        source: "agent",
      });
      return `Intake item added: "${item.title}" (id: ${item.id})`;
    }

    if (cmd === "update") {
      if (!args.id?.trim()) return "Error: id is required for update";
      await updateIntake(args.id.trim(), {
        title: args.title !== undefined ? args.title.trim() : undefined,
        url: args.url !== undefined ? (args.url.trim() || null) : undefined,
        body: args.body !== undefined ? (args.body.trim() || null) : undefined,
      });
      return "Intake item updated.";
    }

    if (cmd === "delete") {
      if (!args.id?.trim()) return "Error: id is required for delete";
      await deleteIntake(args.id.trim());
      return "Intake item deleted.";
    }

    if (cmd === "search") {
      const q = args.query?.trim() || args.title?.trim() || "";
      if (!q) return "Error: query is required for search";
      const items = await listIntake(agentId, { search: q });
      if (items.length === 0) return "No intake items match that query.";
      return items
        .map(
          (it) =>
            `• ${it.title}${it.url ? ` — ${it.url}` : ""}\n  id: ${it.id}`
        )
        .join("\n\n");
    }

    return "Unknown intake command. Use: list, add, update, delete, search";
  },
};

export default tool;

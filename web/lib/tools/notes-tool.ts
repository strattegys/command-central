import { listNotes, addNote, updateNote, deleteNote, findByNoteNumber } from "../notes";
import type { ToolModule } from "./types";

const tool: ToolModule = {
  metadata: {
    id: "notes",
    displayName: "Notes",
    category: "internal",
    description:
      "Manage reference notes for the user. Store and retrieve personal notes, facts, preferences, and reference information.",
    operations: ["list", "add", "update", "delete", "search"],
    requiresApproval: false,
  },

  declaration: {
    name: "notes",
    description:
      "Manage reference notes for the user. These are user-facing notes that Govind can browse and search — NOT your internal memory. Each note has a persistent numeric ID (e.g. #5001, #5002). Commands: 'list' (all notes, optional tag filter), 'add' (create new note), 'update' (modify by note_number), 'delete' (remove by note_number), 'search' (find by keyword). ALWAYS use this tool — never pretend to add notes without calling it.",
    parameters: {
      type: "object" as const,
      properties: {
        command: {
          type: "string",
          description: "list, add, update, delete, or search",
        },
        title: {
          type: "string",
          description: "Note title (for add/update)",
        },
        content: {
          type: "string",
          description: "Note body/details (for add/update)",
        },
        tag: {
          type: "string",
          description:
            "Optional tag for categorization (e.g. 'personal', 'work', 'reference', 'people')",
        },
        note_number: {
          type: "string",
          description: "Persistent note number like 5001, 5002 (for update/delete)",
        },
        id: {
          type: "string",
          description: "Note UUID (for update/delete — use note_number instead when possible)",
        },
        query: {
          type: "string",
          description: "Search query (for search command)",
        },
        pinned: {
          type: "string",
          description: "Set to 'true' to pin a note to the top (for add/update)",
        },
      },
      required: ["command"],
    },
  },

  async execute(args, { agentId }) {
    const cmd = args.command;

    // Resolve note_number to UUID
    let resolvedId = args.id;
    if (args.note_number && !resolvedId) {
      const num = parseInt(args.note_number);
      if (!isNaN(num)) {
        const note = await findByNoteNumber(num);
        if (!note) return `Error: Note #${args.note_number} not found.`;
        resolvedId = note.id;
      }
    }

    if (cmd === "list") {
      const notes = await listNotes(agentId, { tag: args.tag });
      if (notes.length === 0) return "No notes found.";
      return notes
        .map(
          (n) =>
            `${n.pinned ? "📌 " : ""}#${n.noteNumber} ${n.title}${n.tag ? ` #${n.tag}` : ""}${n.content ? `\n   ${n.content.slice(0, 100)}` : ""}`
        )
        .join("\n");
    }

    if (cmd === "add") {
      if (!args.title) return "Error: title is required for add";
      const note = await addNote(agentId, {
        title: args.title,
        content: args.content,
        tag: args.tag,
        pinned: args.pinned === "true",
      });
      return `Note added: #${note.noteNumber} "${note.title}"${note.tag ? ` #${note.tag}` : ""}`;
    }

    if (cmd === "update") {
      if (!resolvedId) return "Error: note_number or id is required for update";
      await updateNote(resolvedId, {
        title: args.title,
        content: args.content,
        tag: args.tag,
        pinned: args.pinned === "true" ? true : args.pinned === "false" ? false : undefined,
      });
      return `Note #${args.note_number || ""} updated.`;
    }

    if (cmd === "delete") {
      if (!resolvedId) return "Error: note_number or id is required for delete";
      await deleteNote(resolvedId);
      return `Note #${args.note_number || ""} deleted.`;
    }

    if (cmd === "search") {
      const q = args.query || args.title || "";
      if (!q) return "Error: query is required for search";
      const notes = await listNotes(agentId, { search: q });
      if (notes.length === 0) return "No notes found matching that query.";
      return notes
        .map(
          (n) =>
            `${n.pinned ? "📌 " : ""}#${n.noteNumber} ${n.title}${n.tag ? ` #${n.tag}` : ""}${n.content ? `\n   ${n.content.slice(0, 100)}` : ""}`
        )
        .join("\n");
    }

    return "Unknown notes command. Use: list, add, update, delete, search";
  },
};

export default tool;

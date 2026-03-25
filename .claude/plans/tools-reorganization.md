# Plan: Organize Tools Library + Friday Tools Dashboard

## Problem
All 10 tools are defined as one giant `tools.ts` file (~900+ lines). Tool declarations, execution logic, shell command builders, and DB queries are all mixed together. Hard to understand, maintain, or inspect what each tool does.

## Current State
- **10 tools** in a single `web/lib/tools.ts`: `twenty_crm`, `linkedin`, `schedule_message`, `web_search`, `memory`, `reminders`, `agent_manager`, `delegate_task`, `workflow_manager`, `kanban`
- Tool assignments live in `web/lib/agent-registry.ts` (which agent gets which tools)
- Server-side scripts: `crm.sh`, `linkedin.sh`, `scheduled_messages.py`, `agent_manager.sh`
- No way to browse or inspect tools from the UI

## Plan

### Phase 1: Reorganize tools into a clean folder structure

**Create `web/lib/tools/` directory** — one file per tool, plus an index:

```
web/lib/tools/
├── index.ts              # Re-exports everything (backward compatible)
├── types.ts              # Shared types (ToolDeclaration, ToolResult, etc.)
├── executor.ts           # executeTool() dispatcher + approval logic
├── twenty-crm.ts         # declaration + execute function
├── linkedin.ts           # declaration + execute function
├── schedule-message.ts   # declaration + execute function
├── web-search.ts         # declaration + execute function
├── memory.ts             # declaration + execute function
├── reminders.ts          # declaration + execute function
├── agent-manager.ts      # declaration + execute function
├── delegate-task.ts      # declaration + execute function
└── workflow-manager.ts   # declaration + execute function
```

Each tool file exports:
- `declaration` — the Gemini function declaration (name, description, parameters)
- `execute(args)` — the handler function
- `metadata` — new object with human-readable info for the dashboard:
  ```ts
  {
    id: "twenty_crm",
    displayName: "Twenty CRM",
    category: "external",        // "external" | "internal" | "meta"
    description: "Search, create, and update contacts, companies, notes, and workflows in the CRM",
    externalSystem: "Twenty CRM (localhost:3000)",
    operations: ["search-persons", "create-person", "update-person", ...],
    requiresApproval: false,
  }
  ```

**`index.ts`** collects all declarations and executors so existing imports (`import { toolDeclarations, executeTool } from '@/lib/tools'`) keep working with zero changes to callers.

### Phase 2: API endpoint for tool registry

**Create `web/app/api/tools/route.ts`**

`GET /api/tools` returns the full tool registry:
```json
[
  {
    "id": "twenty_crm",
    "displayName": "Twenty CRM",
    "category": "external",
    "description": "...",
    "externalSystem": "Twenty CRM (localhost:3000)",
    "operations": ["search-persons", "create-person", ...],
    "requiresApproval": false,
    "assignedTo": ["tim", "scout"]
  },
  ...
]
```

Merges tool metadata with agent-registry assignments so you get the full picture.

### Phase 3: Friday Tools Dashboard panel

**Create `web/components/friday/ToolsPanel.tsx`**

A new panel in Friday's dashboard showing all tools as cards:

- **Card per tool**: icon, name, category badge, description
- **Expand to see**: list of operations, which agents use it, whether it needs approval, what external system it connects to
- **Category filters**: External (CRM, LinkedIn, Brave), Internal (memory, reminders, DB), Meta (agent_manager, delegate_task)
- **Agent filter**: "Show tools used by: Tim / Suzi / Scout / ..."

Wire it into Friday's existing dashboard alongside the workflow Kanban.

### Phase 4: Delete old `tools.ts`

Once `web/lib/tools/index.ts` is verified working, delete the old monolith `web/lib/tools.ts`.

## Files Changed

| Action | File | What |
|--------|------|------|
| Create | `web/lib/tools/types.ts` | Shared types |
| Create | `web/lib/tools/executor.ts` | Dispatcher + approval logic |
| Create | `web/lib/tools/twenty-crm.ts` | CRM tool |
| Create | `web/lib/tools/linkedin.ts` | LinkedIn tool |
| Create | `web/lib/tools/schedule-message.ts` | Scheduled messages tool |
| Create | `web/lib/tools/web-search.ts` | Brave search tool |
| Create | `web/lib/tools/memory.ts` | Agent memory tool |
| Create | `web/lib/tools/reminders.ts` | Reminders tool |
| Create | `web/lib/tools/agent-manager.ts` | Agent management tool |
| Create | `web/lib/tools/delegate-task.ts` | Inter-agent delegation tool |
| Create | `web/lib/tools/workflow-manager.ts` | Workflow management tool |
| Create | `web/lib/tools/index.ts` | Barrel export (backward compat) |
| Create | `web/app/api/tools/route.ts` | Tools registry API |
| Create | `web/components/friday/ToolsPanel.tsx` | Tools dashboard UI |
| Modify | `web/components/friday/FridayDashboardPanel.tsx` | Add tools tab/section |
| Delete | `web/lib/tools.ts` | Old monolith (replaced by folder) |

## What Does NOT Change
- `agent-registry.ts` — stays as-is, tools panel reads from it
- `gemini.ts` — still imports from `@/lib/tools`, barrel export handles it
- Server-side shell scripts — untouched
- Chat API routes — untouched

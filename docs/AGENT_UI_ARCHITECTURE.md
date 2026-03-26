# Agent UI architecture (Command Central)

This document describes the **consistent UX model** for every agent in the main chat layout (`CommandCentralClient`). Follow it when adding or extending agent surfaces so behavior stays predictable and easy to copy.

## Three layers

Each agent uses the same structural stack:

1. **Agent header** (top of the right column)  
2. **Information panel** (optional entry via header)  
3. **Work panel** (primary operational UI; may contain **multiple work tabs**)

### 1. Agent header

**Always includes:**

- **Avatar** (click to upload where supported)
- **Name** (agent display name, tinted with agent color)
- **Role line** — short description of what the agent does (from agent registry `role`)
- **Status light** — online / activity signal (e.g. pending work may tint Friday’s dot amber)

**Optional header controls** (icons to the right of the text):

- Shortcuts that **open a specific work surface** (e.g. board / pipeline icon, Penny’s package dashboard icon).
- **Agent info** (ⓘ) — opens the information panel.

**Principle:** The header is **navigation chrome**, not the main workspace. Prefer putting **secondary or related tools** inside the **work panel as tabs** instead of adding many single-purpose header icons. That keeps “one work area, multiple tabs” obvious.

### 2. Information panel

Opened with the **Agent info** control. Renders `AgentInfoPanel`: longer description, capabilities, connections, avatar, etc. This is the **profile / settings / context** surface, separate from day-to-day operations.

### 3. Work panel

The **default or primary right-hand content** when the user is not on Agent info. This is where **tasks, boards, planners, queues**, and similar UI live.

**Work tabs (sub-navigation inside the work panel):**

- When an agent has **more than one** operational view, implement **tabs inside the work panel** (a slim tab bar under the main agent header), **not** a growing list of unrelated header icons.
- Examples:
  - **Penny** — `PennyDashboardPanel`: Package Planner | Package Templates | Workflow Templates
  - **Friday** — `FridayDashboardPanel`: Packages | Human tasks | Tools
  - **Tim** — `TimAgentPanel`: Message Queue | Pipeline
  - **Suzi** — `SuziRemindersPanel`: Punch List | Reminders | Notes (and related sub-views as implemented there)

**Adding a new capability for an agent**

1. If it belongs with existing work, add a **new work tab** inside that agent’s work panel component.
2. If it is a **new primary surface**, add a `RightPanel` value (or a dedicated work panel wrapper) in `CommandCentralClient.tsx` and wire routing in the main `rightPanel` / `activeAgent` switch.
3. Only add a **new header icon** when it is a **distinct top-level entry** (e.g. opening the whole work area from Agent info), not for every sub-screen.

## Reference table (current patterns)

| Agent  | Default work entry (header shortcut) | Work panel component        | Work tabs (examples)                                      |
|--------|--------------------------------------|-----------------------------|-----------------------------------------------------------|
| Friday | Packages dashboard (grid icon)      | `FridayDashboardPanel`      | Packages, Human tasks, Tools                              |
| Penny  | Packages dashboard (grid icon)      | `PennyDashboardPanel`       | Package Planner, Package Templates, Workflow Templates      |
| Tim    | Board / work icon → Message Queue   | `TimAgentPanel`             | Message Queue, Pipeline                                   |
| Suzi   | Reminders (calendar icon)           | `SuziRemindersPanel`        | Punch List, Reminders, Notes (per implementation)         |
| Others | Kanban where `agentHasKanban`       | `KanbanInlinePanel` or info | As needed                                                 |

## Key files

- **Routing and header chrome:** `web/app/CommandCentralClient.tsx` (`RightPanel`, header buttons, which component mounts for each agent).
- **Agent metadata (name, role, color, capabilities):** `web/lib/agent-registry.ts` and `web/lib/agent-frontend.ts` (`agentHasKanban`, etc.).
- **Example multi-tab work panels:**  
  `web/components/penny/PennyDashboardPanel.tsx`  
  `web/components/friday/FridayDashboardPanel.tsx`  
  `web/components/tim/TimAgentPanel.tsx`  
  `web/components/suzi/SuziRemindersPanel.tsx` (or equivalent Suzi panel path in repo)

## Deep links

Query params such as `?agent=friday&panel=…` map to `RightPanel` where supported. For example, `panel=tasks` for Friday is interpreted as **dashboard + Human tasks tab** so bookmarks and links keep working without a separate top-level `tasks` panel.

---

*Keep this document aligned with `CommandCentralClient` when you change defaults or add agents.*

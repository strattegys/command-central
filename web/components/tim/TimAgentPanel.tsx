"use client";

import KanbanInlinePanel from "@/components/kanban/KanbanInlinePanel";
import TimMessagesPanel from "./TimMessagesPanel";

export type TimWorkTab = "messages" | "kanban";

interface TimAgentPanelProps {
  tab: TimWorkTab;
  onTab: (t: TimWorkTab) => void;
}

/**
 * Suzi-style sub-tabs below the main agent header: Message Queue | Pipeline.
 */
export default function TimAgentPanel({ tab, onTab }: TimAgentPanelProps) {
  return (
    <div className="flex-1 bg-[var(--bg-primary)] flex flex-col overflow-hidden min-w-0">
      <div className="h-10 shrink-0 border-b border-[var(--border-color)] bg-[var(--bg-secondary)] flex items-center px-3 gap-2">
        {(["messages", "kanban"] as const).map((key) => {
          const label = key === "messages" ? "Message Queue" : "Pipeline";
          const isActive = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onTab(key)}
              className={`text-xs px-2 py-1 rounded cursor-pointer transition-colors ${
                isActive
                  ? "font-semibold text-[var(--text-primary)]"
                  : "font-medium text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {tab === "messages" ? (
          <TimMessagesPanel embedded />
        ) : (
          <KanbanInlinePanel
            onClose={() => onTab("messages")}
            agentId="tim"
            readOnly
            embeddedInTimTabs
          />
        )}
      </div>
    </div>
  );
}

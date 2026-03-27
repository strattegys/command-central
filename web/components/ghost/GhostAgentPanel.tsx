"use client";

import type { GhostWorkQueueSelection } from "@/lib/ghost-work-context";
import GhostMessagesPanel from "./GhostMessagesPanel";

interface GhostAgentPanelProps {
  contentQueueCount?: number;
  onGhostWorkSelectionChange?: (selection: GhostWorkQueueSelection | null) => void;
}

/**
 * Ghost’s work panel: content queue on the left, artifact workspace on the right (mirrors Tim’s layout).
 */
export default function GhostAgentPanel({
  contentQueueCount = 0,
  onGhostWorkSelectionChange,
}: GhostAgentPanelProps) {
  return (
    <div className="flex-1 bg-[var(--bg-primary)] flex flex-col overflow-hidden min-w-0">
      <div className="h-10 shrink-0 border-b border-[var(--border-color)] bg-[var(--bg-secondary)] flex items-center px-2 gap-2">
        <span className="text-xs font-semibold text-[var(--text-primary)]">Content Work Queue</span>
        {contentQueueCount > 0 ? (
          <span
            className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold tabular-nums flex items-center justify-center bg-[#4A90D9]/25 text-sky-200 border border-[#4A90D9]/35"
            title={`${contentQueueCount} item${contentQueueCount !== 1 ? "s" : ""}`}
          >
            {contentQueueCount > 99 ? "99+" : contentQueueCount}
          </span>
        ) : null}
      </div>
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <GhostMessagesPanel embedded onWorkSelectionChange={onGhostWorkSelectionChange} />
      </div>
    </div>
  );
}

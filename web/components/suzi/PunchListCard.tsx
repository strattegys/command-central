"use client";

import { useState, type ReactNode } from "react";
import { PUNCH_LIST_RANK_COLORS } from "@/lib/punch-list-columns";

export interface PunchListNote {
  id: string;
  itemId: string;
  content: string;
  createdAt: string;
}

export interface PunchListItem {
  id: string;
  itemNumber: number;
  agentId: string;
  title: string;
  description: string | null;
  category: string | null;
  rank: number;
  status: "open" | "done";
  notes: PunchListNote[];
  createdAt: string;
  updatedAt: string;
}

interface PunchListCardProps {
  item: PunchListItem;
  /** Rendered inside the bordered card, top-right (e.g. drag grip). */
  dragHandle?: ReactNode;
}

export default function PunchListCard({
  item,
  dragHandle,
}: PunchListCardProps) {
  const [expanded, setExpanded] = useState(false);
  const rankColor = PUNCH_LIST_RANK_COLORS[item.rank] || "#9CA3AF";
  const isDone = item.status === "done";
  const latestNote = item.notes?.[0];
  const noteCount = item.notes?.length || 0;

  const body = (
    <>
      {/* Item number */}
      <span
        className="text-[11px] font-semibold mb-1 inline-block opacity-80"
        style={{ color: rankColor }}
      >
        {item.itemNumber}
      </span>

      {/* Title */}
      <p
        className={`text-[11px] font-medium text-[var(--text-chat-body)] leading-tight ${
          isDone ? "line-through text-[var(--text-tertiary)]" : ""
        }`}
      >
        {item.title}
      </p>

      {/* Description */}
      {item.description && (
        <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5 line-clamp-2 leading-tight">
          {item.description}
        </p>
      )}

      {/* Latest note preview */}
      {latestNote && !expanded && (
        <div className="mt-2 mb-1 pl-1.5 border-l-2 border-[var(--border-color)]">
          <p className="text-[10px] text-[var(--text-tertiary)] line-clamp-1 italic py-0.5">
            {latestNote.content}
          </p>
        </div>
      )}

      {/* Expanded notes */}
      {expanded && noteCount > 0 && (
        <div className="mt-2 mb-1 space-y-2">
          {item.notes.map((note) => (
            <div key={note.id} className="pl-1.5 border-l-2 border-[var(--border-color)]">
              <p className="text-[10px] text-[var(--text-tertiary)] italic py-0.5">
                {note.content}
              </p>
              <span className="text-[8px] text-[var(--text-tertiary)]">
                {new Date(note.createdAt).toLocaleDateString("en-US", {
                  timeZone: "America/Los_Angeles",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Meta row */}
      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        {item.category && (
          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-[var(--bg-secondary)] text-[var(--text-tertiary)] border border-[var(--border-color)]">
            {item.category}
          </span>
        )}
        {noteCount > 0 && (
          <button
            type="button"
            draggable={false}
            onClick={() => setExpanded(!expanded)}
            className="text-[8px] text-[var(--text-secondary)] hover:text-[var(--accent-green)] underline-offset-2 hover:underline cursor-pointer ml-auto"
          >
            {expanded ? "hide" : `${noteCount}`}
          </button>
        )}
      </div>
    </>
  );

  return (
    <div className="rounded border px-2.5 py-2 transition-colors border-[var(--border-color)] bg-[var(--bg-primary)] min-w-0">
      {dragHandle ? (
        /* Flex keeps the grip in-flow on the top-right; avoids broken absolute containing blocks */
        <div className="flex items-start gap-2 min-w-0">
          <div className={`flex-1 min-w-0 ${isDone ? "opacity-50" : ""}`}>{body}</div>
          <div className="shrink-0 self-start">{dragHandle}</div>
        </div>
      ) : (
        <div className={isDone ? "opacity-50" : ""}>{body}</div>
      )}
    </div>
  );
}

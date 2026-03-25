"use client";

import { useState } from "react";

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

const RANK_COLORS: Record<number, string> = {
  1: "#EF4444",
  2: "#F97316",
  3: "#F59E0B",
  4: "#84CC16",
  5: "#6366F1",
  6: "#9CA3AF",
};

interface PunchListCardProps {
  item: PunchListItem;
}

export default function PunchListCard({
  item,
}: PunchListCardProps) {
  const [expanded, setExpanded] = useState(false);
  const rankColor = RANK_COLORS[item.rank] || "#9CA3AF";
  const isDone = item.status === "done";
  const latestNote = item.notes?.[0];
  const noteCount = item.notes?.length || 0;

  return (
    <div
      className={`rounded border px-2.5 py-2 transition-colors ${
        isDone
          ? "border-[var(--border-color)] bg-[var(--bg-primary)] opacity-50"
          : "border-[var(--border-color)] bg-[var(--bg-primary)]"
      }`}
    >
      {/* Item number */}
      <span
        className="text-[11px] font-bold mb-1 inline-block"
        style={{ color: rankColor }}
      >
        {item.itemNumber}
      </span>

      {/* Title */}
      <p
        className={`text-[11px] font-medium text-[var(--text-primary)] leading-tight ${
          isDone ? "line-through" : ""
        }`}
      >
        {item.title}
      </p>

      {/* Description */}
      {item.description && (
        <p className="text-[10px] text-[var(--text-secondary)] mt-0.5 line-clamp-2 leading-tight">
          {item.description}
        </p>
      )}

      {/* Latest note preview */}
      {latestNote && !expanded && (
        <div className="mt-2 mb-1 pl-1.5 border-l-2 border-[var(--border-color)]">
          <p className="text-[10px] text-[var(--text-secondary)] line-clamp-1 italic py-0.5">
            {latestNote.content}
          </p>
        </div>
      )}

      {/* Expanded notes */}
      {expanded && noteCount > 0 && (
        <div className="mt-2 mb-1 space-y-2">
          {item.notes.map((note) => (
            <div key={note.id} className="pl-1.5 border-l-2 border-[var(--border-color)]">
              <p className="text-[10px] text-[var(--text-secondary)] italic py-0.5">
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
            onClick={() => setExpanded(!expanded)}
            className="text-[8px] text-[var(--accent-green)] hover:underline cursor-pointer ml-auto"
          >
            {expanded ? "hide" : `${noteCount}`}
          </button>
        )}
      </div>
    </div>
  );
}

"use client";

export interface PunchListItem {
  id: string;
  agentId: string;
  title: string;
  description: string | null;
  rank: number;
  status: "open" | "done";
  createdAt: string;
  updatedAt: string;
}

const RANK_COLORS: Record<number, string> = {
  1: "#EF4444",
  2: "#F97316",
  3: "#F59E0B",
  4: "#EAB308",
  5: "#84CC16",
  6: "#22C55E",
  7: "#6366F1",
  8: "#9CA3AF",
};

interface PunchListCardProps {
  item: PunchListItem;
  onToggleStatus: (id: string, status: "open" | "done") => void;
  onDelete: (id: string) => void;
  onEdit: (item: PunchListItem) => void;
}

export default function PunchListCard({
  item,
  onToggleStatus,
  onDelete,
  onEdit,
}: PunchListCardProps) {
  const rankColor = RANK_COLORS[item.rank] || "#9CA3AF";
  const isDone = item.status === "done";

  return (
    <div
      className={`rounded-lg border p-3 transition-colors ${
        isDone
          ? "border-[var(--border-color)] bg-[var(--bg-primary)] opacity-50"
          : "border-[var(--border-color)] bg-[var(--bg-secondary)]"
      }`}
    >
      <div className="flex items-start gap-2">
        {/* Rank badge */}
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: `${rankColor}22`, color: rankColor }}
        >
          <span className="text-[10px] font-bold">{item.rank}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <span
            className={`text-xs font-semibold text-[var(--text-primary)] ${
              isDone ? "line-through" : ""
            }`}
          >
            {item.title}
          </span>

          {item.description && (
            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 line-clamp-2">
              {item.description}
            </p>
          )}

          <div className="flex items-center gap-3 mt-1.5">
            <span
              className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
              style={{ background: `${rankColor}22`, color: rankColor }}
            >
              rank {item.rank}
            </span>
            <span className="text-[10px] text-[var(--text-tertiary)]">
              {new Date(item.createdAt).toLocaleDateString("en-US", {
                timeZone: "America/Los_Angeles",
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Edit */}
          <button
            onClick={() => onEdit(item)}
            className="p-1 rounded cursor-pointer hover:bg-[var(--bg-primary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            title="Edit"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          {/* Toggle status */}
          <button
            onClick={() =>
              onToggleStatus(item.id, isDone ? "open" : "done")
            }
            className={`p-1 rounded cursor-pointer hover:bg-[var(--bg-primary)] ${
              isDone
                ? "text-[var(--text-tertiary)] hover:text-[var(--accent-green)]"
                : "text-[var(--text-tertiary)] hover:text-[var(--accent-green)]"
            }`}
            title={isDone ? "Reopen" : "Mark done"}
          >
            {isDone ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>
          {/* Delete */}
          <button
            onClick={() => onDelete(item.id)}
            className="p-1 rounded cursor-pointer hover:bg-red-500/10 text-[var(--text-tertiary)] hover:text-red-400"
            title="Delete"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
              <path d="M9 6V4h6v2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

/** Mirrors API / DB shape; keep free of `@/lib/intake` so the client bundle does not pull `db`. */
export interface IntakeCardItem {
  id: string;
  title: string;
  url: string | null;
  body: string | null;
  source: string;
  updatedAt: string;
}

const SOURCE_LABEL: Record<string, string> = {
  ui: "Manual",
  agent: "Suzi",
  share: "Share",
  email: "Email",
};

const SOURCE_COLOR: Record<string, string> = {
  ui: "#5B8DEF",
  agent: "#D85A30",
  share: "#1D9E75",
  email: "#A78BFA",
};

interface IntakeCardProps {
  item: IntakeCardItem;
  onDelete?: (id: string) => void;
}

export default function IntakeCard({ item, onDelete }: IntakeCardProps) {
  const src = item.source || "ui";
  const label = SOURCE_LABEL[src] || src;
  const color = SOURCE_COLOR[src] || "#8b9199";

  return (
    <div className="aspect-square rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] p-2.5 flex flex-col min-h-0 transition-colors group overflow-hidden">
      <div className="flex items-start justify-between gap-1 min-h-0">
        <h3 className="text-[11px] font-semibold text-[var(--text-primary)] line-clamp-3 leading-snug flex-1 min-w-0">
          {item.title}
        </h3>
        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            className="opacity-0 group-hover:opacity-100 text-[var(--text-tertiary)] hover:text-red-400 transition-all shrink-0 p-0.5"
            title="Delete"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {item.url && (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-[#5B8DEF] hover:underline truncate shrink-0 mt-1"
        >
          {item.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
        </a>
      )}

      {item.body && (
        <p className="text-[10px] text-[var(--text-secondary)] mt-1 line-clamp-4 whitespace-pre-wrap flex-1 min-h-0 overflow-hidden">
          {item.body}
        </p>
      )}

      <div className="flex items-center gap-2 mt-auto pt-1.5 shrink-0 flex-wrap">
        <span
          className="text-[8px] px-1.5 py-0.5 rounded-full font-medium"
          style={{ background: `${color}22`, color }}
        >
          {label}
        </span>
        <span className="text-[8px] text-[var(--text-tertiary)]">
          {new Date(item.updatedAt).toLocaleDateString("en-US", {
            timeZone: "America/Los_Angeles",
            month: "short",
            day: "numeric",
          })}
        </span>
      </div>
    </div>
  );
}

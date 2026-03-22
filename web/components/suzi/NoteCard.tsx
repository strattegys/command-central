"use client";

export interface Note {
  id: string;
  noteNumber: number;
  agentId: string;
  title: string;
  content: string | null;
  tag: string | null;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

const TAG_COLORS: Record<string, string> = {
  personal: "#E879A8",
  work: "#5B8DEF",
  reference: "#1D9E75",
  people: "#F97316",
};

interface NoteCardProps {
  note: Note;
}

export default function NoteCard({ note }: NoteCardProps) {
  const tagColor = TAG_COLORS[note.tag || ""] || "#A78BFA";

  return (
    <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] p-3 transition-colors">
      <div className="flex items-start gap-2">
        {/* Pin indicator */}
        {note.pinned && (
          <span className="text-xs mt-0.5 shrink-0" title="Pinned">
            📌
          </span>
        )}

        <div className="flex-1 min-w-0">
          {/* Title with note number */}
          <span className="text-xs font-semibold text-[var(--text-primary)]">
            <span className="text-[var(--text-tertiary)] font-mono mr-1">#{note.noteNumber}</span>
            {note.title}
          </span>

          {/* Content preview */}
          {note.content && (
            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 line-clamp-3 whitespace-pre-wrap">
              {note.content}
            </p>
          )}

          {/* Meta row */}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {note.tag && (
              <span
                className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                style={{ background: `${tagColor}22`, color: tagColor }}
              >
                {note.tag}
              </span>
            )}
            <span className="text-[9px] text-[var(--text-tertiary)]">
              {new Date(note.updatedAt).toLocaleDateString("en-US", {
                timeZone: "America/Los_Angeles",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

import type { WorkflowItem } from "@/lib/board-types";

export interface ItemAlert {
  type: "linkedin_reply" | "linkedin_accepted";
  title: string;
  createdAt: string;
}

interface KanbanCardProps {
  item: WorkflowItem;
  alert?: ItemAlert;
  isSelected: boolean;
  onClick: () => void;
}

export default function KanbanCard({ item, alert, isSelected, onClick }: KanbanCardProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full h-full text-left p-3 rounded-lg border transition-colors cursor-pointer flex flex-col overflow-hidden ${
        isSelected
          ? "bg-[var(--bg-tertiary)] border-[var(--accent-blue)]"
          : "bg-[var(--bg-secondary)] border-[var(--border-color)] hover:border-[var(--text-tertiary)]"
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-medium text-[var(--text-primary)] truncate flex-1">{item.title}</span>
        {alert && (
          <span
            className={`shrink-0 w-2 h-2 rounded-full ${
              alert.type === "linkedin_reply" ? "bg-orange-400 animate-pulse" : "bg-green-400"
            }`}
            title={
              alert.type === "linkedin_reply"
                ? "LinkedIn message needs reply"
                : "LinkedIn connection accepted"
            }
          />
        )}
      </div>
      {item.extra && (
        <div className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">
          {item.extra}
        </div>
      )}
      {item.subtitle && (
        <div className="text-xs text-[var(--text-tertiary)] mt-0.5 truncate">
          {item.subtitle}
        </div>
      )}

      {/* Person-specific: LinkedIn link */}
      {item.sourceType === "person" && item.linkedinUrl && (
        <a
          href={item.linkedinUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-[10px] text-[var(--accent-blue)] hover:underline mt-1 inline-flex items-center gap-1 truncate"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
          LinkedIn
        </a>
      )}

      {/* Content-specific: URL link */}
      {item.sourceType === "content" && item.extra && (
        <a
          href={item.extra}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-[10px] text-[var(--accent-blue)] hover:underline mt-1 inline-flex items-center gap-1 truncate"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          Link
        </a>
      )}

      {/* Person alert badge */}
      {alert && (
        <div className={`text-[10px] mt-1 px-1.5 py-0.5 rounded-full inline-flex items-center gap-1 ${
          alert.type === "linkedin_reply"
            ? "bg-orange-400/15 text-orange-400"
            : "bg-green-400/15 text-green-400"
        }`}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
          {alert.type === "linkedin_reply" ? "Needs reply" : "Accepted"}
        </div>
      )}
    </button>
  );
}

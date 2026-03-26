"use client";

export interface FridayPackageRow {
  id: string;
  name: string;
  templateId: string;
  stage: string;
  /** Human-friendly id for chat */
  packageNumber?: number | null;
  workflowCount: number;
  itemCount?: number;
  createdAt: string;
}

interface FridayPackageCardProps {
  pkg: FridayPackageRow;
}

export default function FridayPackageCard({ pkg }: FridayPackageCardProps) {
  const items = pkg.itemCount ?? 0;
  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-2.5 space-y-1.5">
      <div className="flex items-center gap-1.5 min-w-0">
        {pkg.packageNumber != null && !Number.isNaN(pkg.packageNumber) && (
          <span className="text-[10px] font-bold tabular-nums text-[var(--text-tertiary)] shrink-0">
            #{pkg.packageNumber}
          </span>
        )}
        <span className="text-xs font-semibold text-[var(--text-primary)] truncate flex-1">{pkg.name}</span>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap text-[9px] text-[var(--text-tertiary)]">
        <span className="px-1.5 py-0.5 rounded bg-[var(--bg-primary)] font-medium">{pkg.templateId}</span>
        <span>
          {pkg.workflowCount} workflow{pkg.workflowCount !== 1 ? "s" : ""}
          {pkg.itemCount != null ? ` · ${items} item${items !== 1 ? "s" : ""}` : ""}
        </span>
      </div>
    </div>
  );
}

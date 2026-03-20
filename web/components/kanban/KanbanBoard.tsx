import KanbanColumn from "./KanbanColumn";
import type { ItemAlert } from "./KanbanCard";
import type { StageConfig, WorkflowItem } from "@/lib/board-types";

interface KanbanBoardProps {
  stages: StageConfig[];
  transitions?: Record<string, string[]>;
  items: WorkflowItem[];
  alerts: Record<string, ItemAlert>;
  selectedItemId: string | null;
  onSelectItem: (item: WorkflowItem) => void;
}

export default function KanbanBoard({
  stages,
  transitions,
  items,
  alerts,
  selectedItemId,
  onSelectItem,
}: KanbanBoardProps) {
  // Group items by stage
  const grouped = new Map<string, WorkflowItem[]>();
  for (const stage of stages) {
    grouped.set(stage.key, []);
  }
  for (const item of items) {
    const key = item.stage || stages[0]?.key || "TARGET";
    const list = grouped.get(key);
    if (list) {
      list.push(item);
    } else {
      // Unknown stage — put in first column
      grouped.get(stages[0]?.key || "TARGET")?.push(item);
    }
  }

  return (
    <div className="flex gap-3 overflow-x-auto flex-1 min-h-0 p-3">
      {stages.map((stage) => (
        <KanbanColumn
          key={stage.key}
          stage={stage}
          items={grouped.get(stage.key) || []}
          alerts={alerts}
          selectedItemId={selectedItemId}
          onSelectItem={onSelectItem}
        />
      ))}
    </div>
  );
}

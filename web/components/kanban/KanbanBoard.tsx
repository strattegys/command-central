import KanbanColumn from "./KanbanColumn";
import type { Person, PersonAlert } from "./KanbanCard";
import { DEFAULT_STAGES, type StageConfig } from "@/lib/board-types";

interface KanbanBoardProps {
  stages?: StageConfig[];
  transitions?: Record<string, string[]>;
  people: Person[];
  alerts: Record<string, PersonAlert>;
  selectedPersonId: string | null;
  onSelectPerson: (person: Person) => void;
}

export default function KanbanBoard({
  stages = DEFAULT_STAGES,
  transitions,
  people,
  alerts,
  selectedPersonId,
  onSelectPerson,
}: KanbanBoardProps) {
  // Group people by stage
  const grouped = new Map<string, Person[]>();
  for (const stage of stages) {
    grouped.set(stage.key, []);
  }
  for (const person of people) {
    const key = person.stage || stages[0]?.key || "TARGET";
    const list = grouped.get(key);
    if (list) {
      list.push(person);
    } else {
      // Unknown stage — put in first column
      grouped.get(stages[0]?.key || "TARGET")?.push(person);
    }
  }

  return (
    <div className="flex gap-3 overflow-x-auto flex-1 min-h-0 p-3">
      {stages.map((stage) => (
        <KanbanColumn
          key={stage.key}
          stage={stage}
          people={grouped.get(stage.key) || []}
          alerts={alerts}
          selectedPersonId={selectedPersonId}
          onSelectPerson={onSelectPerson}
        />
      ))}
    </div>
  );
}

import KanbanColumn, { type StageConfig } from "./KanbanColumn";
import type { Person, PersonAlert } from "./KanbanCard";

export const STAGES: StageConfig[] = [
  { key: "TARGET", label: "Target", color: "#6b8a9e" },
  { key: "INITIATED", label: "Initiated", color: "#2b5278" },
  { key: "ACCEPTED", label: "Accepted", color: "#534AB7" },
  { key: "MESSAGED", label: "Messaged", color: "#7c5bbf" },
  { key: "ENGAGED", label: "Engaged", color: "#1D9E75" },
  { key: "PROSPECT", label: "Prospect", color: "#D85A30" },
  { key: "CONVERTED", label: "Converted", color: "#22c55e" },
];

interface KanbanBoardProps {
  people: Person[];
  alerts: Record<string, PersonAlert>;
  selectedPersonId: string | null;
  onSelectPerson: (person: Person) => void;
}

export default function KanbanBoard({
  people,
  alerts,
  selectedPersonId,
  onSelectPerson,
}: KanbanBoardProps) {
  // Group people by stage
  const grouped = new Map<string, Person[]>();
  for (const stage of STAGES) {
    grouped.set(stage.key, []);
  }
  for (const person of people) {
    const key = person.stage || "TARGET";
    const list = grouped.get(key);
    if (list) {
      list.push(person);
    } else {
      // Unknown stage — put in TARGET
      grouped.get("TARGET")!.push(person);
    }
  }

  return (
    <div className="flex gap-3 overflow-x-auto flex-1 min-h-0 p-3">
      {STAGES.map((stage) => (
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

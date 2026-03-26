/** Kanban columns: `rank` 1–6 in DB maps to these labels (UI + Suzi tool). */
export const PUNCH_LIST_RANK_LABELS: Record<number, string> = {
  1: "Now",
  2: "Later",
  3: "Next",
  4: "Some time",
  5: "Backlog",
  6: "Idea",
};

export const PUNCH_LIST_RANK_COLORS: Record<number, string> = {
  1: "#a67070",
  2: "#a68970",
  3: "#a6a066",
  4: "#7fa67a",
  5: "#8888a8",
  6: "#8a9099",
};

const MIN_RANK = 1;
const MAX_RANK = 6;

/** Parse rank from "3", "next", "some time", etc. Returns null if invalid. */
export function parsePunchListRank(input: string): number | null {
  const t = input.trim().toLowerCase().replace(/_/g, " ");
  const n = parseInt(t, 10);
  if (!Number.isNaN(n) && n >= MIN_RANK && n <= MAX_RANK) return n;

  const map: Record<string, number> = {
    now: 1,
    later: 2,
    next: 3,
    "some time": 4,
    sometime: 4,
    "some-time": 4,
    backlog: 5,
    idea: 6,
  };
  const mapped = map[t];
  return mapped !== undefined ? mapped : null;
}

export function punchListColumnLabel(rank: number): string {
  return PUNCH_LIST_RANK_LABELS[rank] ?? `Column ${rank}`;
}

export function punchListColumnsSummary(): string {
  return Object.entries(PUNCH_LIST_RANK_LABELS)
    .map(([r, label]) => `${r}=${label}`)
    .join(", ");
}

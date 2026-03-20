export interface StageConfig {
  key: string;
  label: string;
  color: string;
}

export interface Board {
  id: string;
  name: string;
  description: string | null;
  stages: StageConfig[];
  transitions: Record<string, string[]>;
}

export interface CampaignWithBoard {
  id: string;
  name: string;
  stage: string;
  spec: string;
  boardId: string | null;
  board: Board | null;
}

/** Fallback stages when a campaign has no board assigned */
export const DEFAULT_STAGES: StageConfig[] = [
  { key: "TARGET", label: "Target", color: "#6b8a9e" },
  { key: "INITIATED", label: "Initiated", color: "#2b5278" },
  { key: "ACCEPTED", label: "Accepted", color: "#534AB7" },
  { key: "MESSAGED", label: "Messaged", color: "#7c5bbf" },
  { key: "ENGAGED", label: "Engaged", color: "#1D9E75" },
  { key: "PROSPECT", label: "Prospect", color: "#D85A30" },
  { key: "CONVERTED", label: "Converted", color: "#22c55e" },
];

export const DEFAULT_TRANSITIONS: Record<string, string[]> = {
  TARGET: ["INITIATED"],
  INITIATED: ["ACCEPTED", "TARGET"],
  ACCEPTED: ["MESSAGED", "TARGET"],
  MESSAGED: ["ENGAGED", "ACCEPTED"],
  ENGAGED: ["PROSPECT", "MESSAGED"],
  PROSPECT: ["CONVERTED", "ENGAGED"],
  CONVERTED: [],
};

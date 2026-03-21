/**
 * Workflow Type Registry
 *
 * Defines reusable workflow templates that agents reference via workflowTypes[].
 * Each type specifies the item kind (person/content) and a default board
 * with stages and transitions used when creating new workflows.
 */

export interface WorkflowTypeSpec {
  /** Unique slug for this workflow type */
  id: string;
  /** Human-readable label */
  label: string;
  /** What kind of items this workflow tracks */
  itemType: "person" | "content";
  /** Description for humans */
  description: string;
  /**
   * Default board template used when creating a new workflow of this type.
   * Active workflows use their stored board as source of truth.
   */
  defaultBoard: {
    stages: Array<{ key: string; label: string; color: string }>;
    transitions: Record<string, string[]>;
  };
}

export const WORKFLOW_TYPES: Record<string, WorkflowTypeSpec> = {
  "linkedin-outreach": {
    id: "linkedin-outreach",
    label: "LinkedIn Outreach",
    itemType: "person",
    description:
      "Track prospects through connection, engagement, and conversion stages via LinkedIn",
    defaultBoard: {
      stages: [
        { key: "TARGET", label: "Target", color: "#6b8a9e" },
        { key: "INITIATED", label: "Initiated", color: "#2563EB" },
        { key: "ACCEPTED", label: "Accepted", color: "#16A34A" },
        { key: "MESSAGED", label: "Messaged", color: "#D85A30" },
        { key: "ENGAGED", label: "Engaged", color: "#9B59B6" },
        { key: "PROSPECT", label: "Prospect", color: "#D4A017" },
        { key: "CONVERTED", label: "Converted", color: "#1D9E75" },
      ],
      transitions: {
        TARGET: ["INITIATED"],
        INITIATED: ["ACCEPTED"],
        ACCEPTED: ["MESSAGED"],
        MESSAGED: ["ENGAGED"],
        ENGAGED: ["PROSPECT", "CONVERTED"],
        PROSPECT: ["CONVERTED"],
        CONVERTED: [],
      },
    },
  },

  "candidate-sourcing": {
    id: "candidate-sourcing",
    label: "Candidate Sourcing",
    itemType: "person",
    description:
      "Find and qualify candidates through sourcing, screening, and interview stages",
    defaultBoard: {
      stages: [
        { key: "SOURCED", label: "Sourced", color: "#6b8a9e" },
        { key: "SCREENED", label: "Screened", color: "#2563EB" },
        { key: "QUALIFIED", label: "Qualified", color: "#D85A30" },
        { key: "INTERVIEW", label: "Interview", color: "#9B59B6" },
        { key: "OFFER", label: "Offer", color: "#D4A017" },
        { key: "HIRED", label: "Hired", color: "#1D9E75" },
      ],
      transitions: {
        SOURCED: ["SCREENED"],
        SCREENED: ["QUALIFIED"],
        QUALIFIED: ["INTERVIEW"],
        INTERVIEW: ["OFFER"],
        OFFER: ["HIRED"],
        HIRED: [],
      },
    },
  },

  "content-pipeline": {
    id: "content-pipeline",
    label: "Content Pipeline",
    itemType: "content",
    description:
      "Manage content from ideation through drafting, review, and publication",
    defaultBoard: {
      stages: [
        { key: "IDEA", label: "Idea", color: "#6b8a9e" },
        { key: "DRAFTING", label: "Drafting", color: "#2563EB" },
        { key: "REVIEW", label: "Review", color: "#D85A30" },
        { key: "PUBLISHED", label: "Published", color: "#1D9E75" },
        { key: "DISTRIBUTED", label: "Distributed", color: "#9B59B6" },
      ],
      transitions: {
        IDEA: ["DRAFTING"],
        DRAFTING: ["REVIEW"],
        REVIEW: ["PUBLISHED", "DRAFTING"],
        PUBLISHED: ["DISTRIBUTED"],
        DISTRIBUTED: [],
      },
    },
  },

  "email-campaign": {
    id: "email-campaign",
    label: "Email Campaign",
    itemType: "person",
    description:
      "Track email outreach from list building through sending, replies, and conversion",
    defaultBoard: {
      stages: [
        { key: "LIST", label: "List", color: "#6b8a9e" },
        { key: "DRAFTED", label: "Drafted", color: "#2563EB" },
        { key: "SENT", label: "Sent", color: "#D85A30" },
        { key: "REPLIED", label: "Replied", color: "#9B59B6" },
        { key: "CONVERTED", label: "Converted", color: "#1D9E75" },
      ],
      transitions: {
        LIST: ["DRAFTED"],
        DRAFTED: ["SENT"],
        SENT: ["REPLIED", "CONVERTED"],
        REPLIED: ["CONVERTED"],
        CONVERTED: [],
      },
    },
  },
};

/** Look up a workflow type by ID. Returns undefined if not found. */
export function getWorkflowType(id: string): WorkflowTypeSpec | undefined {
  return WORKFLOW_TYPES[id];
}

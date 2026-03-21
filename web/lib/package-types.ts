/**
 * Package Template Registry
 *
 * Defines reusable service package templates. Each package bundles multiple
 * workflow deliverables across agents. When a package is approved, the system
 * auto-creates the corresponding workflows for each deliverable.
 */

export interface PackageDeliverable {
  /** References a key in WORKFLOW_TYPES */
  workflowType: string;
  /** Agent ID that owns this workflow */
  ownerAgent: string;
  /** Default target item count for this deliverable */
  targetCount: number;
  /** Human-readable label */
  label: string;
}

export interface PackageTemplateSpec {
  /** Unique slug for this package type */
  id: string;
  /** Human-readable label */
  label: string;
  /** Description for humans */
  description: string;
  /** Workflows that make up this package */
  deliverables: PackageDeliverable[];
}

export const PACKAGE_TEMPLATES: Record<string, PackageTemplateSpec> = {
  "influencer-package": {
    id: "influencer-package",
    label: "Influencer Package",
    description:
      "Full influencer outreach with target research, LinkedIn engagement, " +
      "article creation, and multi-channel content distribution",
    deliverables: [
      {
        workflowType: "research-pipeline",
        ownerAgent: "scout",
        targetCount: 20,
        label: "Target Research",
      },
      {
        workflowType: "linkedin-outreach",
        ownerAgent: "tim",
        targetCount: 20,
        label: "LinkedIn Outreach",
      },
      {
        workflowType: "content-pipeline",
        ownerAgent: "ghost",
        targetCount: 1,
        label: "Article Creation",
      },
      {
        workflowType: "content-distribution",
        ownerAgent: "marni",
        targetCount: 3,
        label: "LinkedIn Posts",
      },
    ],
  },
};

/** Look up a package template by ID. Returns undefined if not found. */
export function getPackageTemplate(
  id: string
): PackageTemplateSpec | undefined {
  return PACKAGE_TEMPLATES[id];
}

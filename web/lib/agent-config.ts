/**
 * Backend Agent Config — Thin adapter over the Agent Registry.
 *
 * Existing callers (gemini.ts, heartbeat.ts, API routes) continue to use
 * getAgentConfig() and get the same AgentBackendConfig shape.
 */

import { AGENT_REGISTRY, getAgentSpec } from "./agent-registry";

export interface Routine {
  name: string;
  schedule: string;
  description: string;
  logFile?: string;
}

export interface AgentBackendConfig {
  id: string;
  modelName?: string;
  hasKanban?: boolean;
  sessionFile: string;
  systemPromptFile: string;
  memoryDir: string;
  tools: string[];
  routines: Routine[];
}

export function getAgentConfig(agentId: string): AgentBackendConfig {
  const spec = getAgentSpec(agentId);
  return {
    id: spec.id,
    modelName: spec.modelName,
    hasKanban: spec.workflowTypes.length > 0,
    sessionFile: spec.sessionFile,
    systemPromptFile: spec.systemPromptFile,
    memoryDir: spec.memoryDir,
    tools: spec.tools,
    routines: spec.routines.map((r) => ({
      name: r.name,
      schedule: r.schedule,
      description: r.description,
      logFile: r.logFile,
    })),
  };
}

export function agentHasKanban(agentId: string): boolean {
  const spec = AGENT_REGISTRY[agentId];
  return spec ? spec.workflowTypes.length > 0 : false;
}

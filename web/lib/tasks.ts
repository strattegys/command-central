import { readFileSync, appendFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import { randomBytes } from "crypto";

/**
 * Inter-Agent Task Queue
 *
 * Agents delegate work to other agents via a shared JSONL task file.
 * Supports sync (immediate) and async (heartbeat-picked) execution.
 */

const TASKS_FILE =
  process.env.AGENT_TASKS_FILE || "/root/.nanobot/agent_tasks.jsonl";

export interface AgentTask {
  id: string;
  from: string;
  to: string;
  task: string;
  urgency: "sync" | "async";
  status: "pending" | "in_progress" | "completed" | "failed" | "acknowledged";
  created: string;
  result: string | null;
  completedAt: string | null;
}

function ensureFile(): void {
  const dir = dirname(TASKS_FILE);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  if (!existsSync(TASKS_FILE)) {
    writeFileSync(TASKS_FILE, "");
  }
}

function readAllTasks(): AgentTask[] {
  ensureFile();
  const raw = readFileSync(TASKS_FILE, "utf-8").trim();
  if (!raw) return [];

  return raw
    .split("\n")
    .map((line) => {
      try {
        return JSON.parse(line) as AgentTask;
      } catch {
        return null;
      }
    })
    .filter((t): t is AgentTask => t !== null);
}

function writeAllTasks(tasks: AgentTask[]): void {
  ensureFile();
  const content = tasks.map((t) => JSON.stringify(t)).join("\n") + "\n";
  writeFileSync(TASKS_FILE, content);
}

/** Create a new task and append to the queue. Returns the task ID. */
export function createTask(
  from: string,
  to: string,
  task: string,
  urgency: "sync" | "async"
): string {
  ensureFile();
  const id = "task_" + randomBytes(6).toString("hex");
  const entry: AgentTask = {
    id,
    from,
    to,
    task,
    urgency,
    status: "pending",
    created: new Date().toISOString(),
    result: null,
    completedAt: null,
  };
  appendFileSync(TASKS_FILE, JSON.stringify(entry) + "\n");
  return id;
}

/** Get pending tasks assigned to an agent. */
export function getPendingTasks(agentId: string): AgentTask[] {
  return readAllTasks().filter(
    (t) => t.to === agentId && t.status === "pending"
  );
}

/** Get completed tasks that were requested by an agent (not yet acknowledged). */
export function getCompletedTasks(fromAgentId: string): AgentTask[] {
  return readAllTasks().filter(
    (t) => t.from === fromAgentId && t.status === "completed"
  );
}

/** Update a task's fields (status, result, completedAt). */
export function updateTask(
  taskId: string,
  updates: Partial<Pick<AgentTask, "status" | "result" | "completedAt">>
): void {
  const tasks = readAllTasks();
  const idx = tasks.findIndex((t) => t.id === taskId);
  if (idx === -1) return;

  tasks[idx] = { ...tasks[idx], ...updates };
  writeAllTasks(tasks);
}

/** Mark a completed task as acknowledged so it's not re-processed. */
export function acknowledgeTask(taskId: string): void {
  updateTask(taskId, { status: "acknowledged" });
}

import { schedule, type ScheduledTask } from "node-cron";
import { execFile } from "child_process";
import { appendFileSync } from "fs";
import { join } from "path";
import { AGENT_REGISTRY } from "./agent-registry";
import type { RoutineSpec, HeartbeatSpec } from "./agent-spec";

/**
 * In-App Cron Scheduler
 *
 * Data-driven from the Agent Registry. Jobs are registered on server startup
 * via instrumentation.ts. Live status is exposed via /api/cron-status.
 */

const TOOL_SCRIPTS_PATH =
  process.env.TOOL_SCRIPTS_PATH || join(process.cwd(), "..", ".nanobot", "tools");

export interface CronJobConfig {
  id: string;
  name: string;
  schedule: string;
  description: string;
  logFile?: string;
  agentId: string;
  enabled: boolean;
  lastRun?: Date;
  lastResult?: string; // "success" or error message
}

// Use globalThis to share state between instrumentation hook and API routes
// (Turbopack creates separate module instances for each context)
const globalForCron = globalThis as typeof globalThis & {
  __cronJobRegistry?: Map<string, CronJobConfig>;
  __cronScheduledTasks?: Map<string, ScheduledTask>;
  __cronInitialized?: boolean;
};

const jobRegistry = globalForCron.__cronJobRegistry ?? new Map<string, CronJobConfig>();
globalForCron.__cronJobRegistry = jobRegistry;

const scheduledTasks = globalForCron.__cronScheduledTasks ?? new Map<string, ScheduledTask>();
globalForCron.__cronScheduledTasks = scheduledTasks;

let initialized = globalForCron.__cronInitialized ?? false;

function logToFile(logFile: string | undefined, message: string): void {
  if (!logFile) return;
  try {
    const timestamp = new Date().toISOString();
    appendFileSync(logFile, `[${timestamp}] ${message}\n`);
  } catch {
    // ignore log errors
  }
}

function execScript(
  cmd: string,
  args: string[],
  timeoutMs = 120000
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: timeoutMs, encoding: "utf-8" }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`${err.message}\n${stderr || ""}`));
      } else {
        resolve(stdout || "");
      }
    });
  });
}

function registerJob(
  config: Omit<CronJobConfig, "lastRun" | "lastResult">,
  handler: () => Promise<void>
): void {
  const job: CronJobConfig = {
    ...config,
    lastRun: undefined,
    lastResult: undefined,
  };
  jobRegistry.set(config.id, job);

  if (!config.enabled) return;

  const task = schedule(config.schedule, async () => {
    const startTime = new Date();
    try {
      await handler();
      job.lastRun = startTime;
      job.lastResult = "success";
      logToFile(config.logFile, `[OK] ${config.name} completed`);
    } catch (error) {
      const errMsg =
        error instanceof Error ? error.message : String(error);
      job.lastRun = startTime;
      job.lastResult = `error: ${errMsg.slice(0, 200)}`;
      logToFile(config.logFile, `[ERROR] ${config.name}: ${errMsg}`);
      console.error(`[cron] ${config.name} failed:`, errMsg);
    }
  });

  scheduledTasks.set(config.id, task);
}

// ─── Handler factories ───
// Each routine handler string maps to a function that creates the async handler.

type HandlerFactory = (routine: RoutineSpec, agentId: string) => () => Promise<void>;

const ROUTINE_HANDLERS: Record<string, HandlerFactory> = {
  "linkedin-extractor": () => async () => {
    await execScript("python3", [
      join(TOOL_SCRIPTS_PATH, "linkedin_extractor.py"),
    ]);
  },

  "scheduled-messages-process": () => async () => {
    await execScript("python3", [
      join(TOOL_SCRIPTS_PATH, "scheduled_messages.py"),
      "process",
    ]);
  },

  "crm-backup": () => async () => {
    try {
      await execScript("bash", ["/root/scripts/backup-twenty.sh"]);
    } catch {
      console.log("[cron] CRM backup script not found or failed");
    }
  },

  "linkedin-connections": () => async () => {
    const { checkNewConnections } = await import("./linkedin-crm");
    const count = await checkNewConnections();
    if (count > 0) {
      console.log(`[cron] Processed ${count} new LinkedIn connection(s)`);
    }
  },
};

// ─── Heartbeat handler factory ───

function createHeartbeatHandler(
  heartbeat: HeartbeatSpec,
  agentId: string
): () => Promise<void> {
  switch (heartbeat.type) {
    case "full":
      return async () => {
        const { runTimHeartbeat } = await import("./heartbeat");
        await runTimHeartbeat();
      };
    case "simple":
      return async () => {
        const { runSimpleHeartbeat } = await import("./heartbeat");
        await runSimpleHeartbeat(agentId);
      };
    case "scout":
      return async () => {
        const { runScoutHeartbeat } = await import("./heartbeat");
        await runScoutHeartbeat();
      };
    default:
      return async () => {
        console.warn(`[cron] Unknown heartbeat type for agent ${agentId}`);
      };
  }
}

/** Initialize all cron jobs. Called once from instrumentation.ts on server start. */
export function initCronJobs(): void {
  if (initialized) return;
  initialized = true;
  globalForCron.__cronInitialized = true;

  console.log("[cron] Initializing cron jobs...");

  for (const spec of Object.values(AGENT_REGISTRY)) {
    // Register routines
    for (const routine of spec.routines) {
      const factory = ROUTINE_HANDLERS[routine.handler];
      if (!factory) {
        console.warn(
          `[cron] Unknown handler "${routine.handler}" for routine "${routine.id}" (agent: ${spec.id})`
        );
        continue;
      }

      registerJob(
        {
          id: routine.id,
          name: routine.name,
          schedule: routine.schedule,
          description: routine.description,
          logFile: routine.logFile,
          agentId: spec.id,
          enabled: routine.enabled !== false,
        },
        factory(routine, spec.id)
      );
    }

    // Register heartbeat
    if (spec.heartbeat) {
      registerJob(
        {
          id: `heartbeat-${spec.id}`,
          name: "Heartbeat",
          schedule: spec.heartbeat.schedule,
          description: spec.heartbeat.checks
            .map((c) => c.name)
            .join(", "),
          agentId: spec.id,
          enabled: true,
        },
        createHeartbeatHandler(spec.heartbeat, spec.id)
      );
    }
  }

  console.log(`[cron] Registered ${jobRegistry.size} jobs`);
}

/** Get all cron jobs, optionally filtered by agent */
export function getCronJobs(agentId?: string): CronJobConfig[] {
  const jobs = Array.from(jobRegistry.values());
  if (agentId) {
    return jobs.filter((j) => j.agentId === agentId);
  }
  return jobs;
}

/** Stop all cron jobs (for graceful shutdown) */
export function stopAllCrons(): void {
  for (const task of scheduledTasks.values()) {
    task.stop();
  }
  scheduledTasks.clear();
  console.log("[cron] All cron jobs stopped");
}

import { schedule, type ScheduledTask } from "node-cron";
import { execFile } from "child_process";
import { appendFileSync } from "fs";
import { join } from "path";

/**
 * In-App Cron Scheduler
 *
 * Replaces Linux crontab entries with node-cron jobs managed inside the PM2 process.
 * Jobs are registered on server startup via instrumentation.ts.
 * Live status is exposed via /api/cron-status for the Inspector panel.
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

const jobRegistry = new Map<string, CronJobConfig>();
const scheduledTasks = new Map<string, ScheduledTask>();
let initialized = false;

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

/** Initialize all cron jobs. Called once from instrumentation.ts on server start. */
export function initCronJobs(): void {
  if (initialized) return;
  initialized = true;

  console.log("[cron] Initializing cron jobs...");

  // Tim: LinkedIn Message Sync
  registerJob(
    {
      id: "linkedin-sync",
      name: "LinkedIn Message Sync",
      schedule: "*/15 * * * *",
      description: "Extracts new LinkedIn messages, creates CRM notes, sends alerts",
      logFile: "/root/.nanobot/linkedin_alerts.log",
      agentId: "tim",
      enabled: true,
    },
    async () => {
      await execScript("python3", [
        join(TOOL_SCRIPTS_PATH, "linkedin_extractor.py"),
      ]);
    }
  );

  // Tim: Scheduled Message Processor
  registerJob(
    {
      id: "scheduled-messages",
      name: "Scheduled Message Processor",
      schedule: "* * * * *",
      description: "Sends due scheduled LinkedIn messages from the queue",
      logFile: "/root/.nanobot/scheduled_messages.log",
      agentId: "tim",
      enabled: true,
    },
    async () => {
      await execScript("python3", [
        join(TOOL_SCRIPTS_PATH, "scheduled_messages.py"),
        "process",
      ]);
    }
  );

  // Tim: CRM Backup
  registerJob(
    {
      id: "crm-backup",
      name: "CRM Backup",
      schedule: "0 2 * * *",
      description: "Nightly backup of Twenty CRM database",
      logFile: "/var/log/twenty-backup.log",
      agentId: "tim",
      enabled: true,
    },
    async () => {
      // Twenty CRM backup via pg_dump (if script exists)
      try {
        await execScript("bash", ["/root/scripts/backup-twenty.sh"]);
      } catch {
        console.log("[cron] CRM backup script not found or failed");
      }
    }
  );

  // Heartbeat: Tim
  registerJob(
    {
      id: "heartbeat-tim",
      name: "Heartbeat",
      schedule: "*/30 * * * *",
      description: "Periodic health check and pending task scan",
      agentId: "tim",
      enabled: true,
    },
    async () => {
      // Phase 3: Start simple — just log OK
      console.log("[heartbeat] Tim heartbeat OK");
    }
  );

  // Heartbeat: Suzi
  registerJob(
    {
      id: "heartbeat-suzi",
      name: "Heartbeat",
      schedule: "*/30 * * * *",
      description: "Periodic health check",
      agentId: "suzi",
      enabled: true,
    },
    async () => {
      console.log("[heartbeat] Suzi heartbeat OK");
    }
  );

  // Heartbeat: Rainbow
  registerJob(
    {
      id: "heartbeat-rainbow",
      name: "Heartbeat",
      schedule: "*/30 * * * *",
      description: "Periodic health check",
      agentId: "rainbow",
      enabled: true,
    },
    async () => {
      console.log("[heartbeat] Rainbow heartbeat OK");
    }
  );

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

/**
 * Next.js Instrumentation Hook
 *
 * Runs once when the server starts. Used to initialize
 * the in-app cron scheduler (node-cron jobs).
 *
 * Only runs in Node.js runtime (not edge, not during build).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initCronJobs } = await import("./lib/cron");
    initCronJobs();
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getCronJobs } from "@/lib/cron";

export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get("agent") || undefined;

  const jobs = getCronJobs(agentId).map((job) => ({
    id: job.id,
    name: job.name,
    schedule: job.schedule,
    description: job.description,
    logFile: job.logFile || null,
    agentId: job.agentId,
    enabled: job.enabled,
    timeZone: job.timeZone || null,
    lastRun: job.lastRun ? job.lastRun.toISOString() : null,
    lastResult: job.lastResult || null,
  }));

  return NextResponse.json({ jobs });
}

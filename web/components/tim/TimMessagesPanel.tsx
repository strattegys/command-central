"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { panelBus } from "@/lib/events";
import ArtifactViewer from "../shared/ArtifactViewer";

const NO_REJECT_STAGES = new Set([
  "IDEA",
  "AWAITING_CONTACT",
  "CAMPAIGN_SPEC",
  "REVIEW",
  "DRAFT_PUBLISHED",
  "MESSAGE_DRAFT",
  "MESSAGED",
  "REPLY_DRAFT",
]);

interface MessagingTask {
  itemId: string;
  itemTitle: string;
  itemSubtitle: string;
  workflowId: string;
  workflowName: string;
  packageName: string;
  ownerAgent: string;
  packageId: string | null;
  packageNumber?: number | null;
  packageStage: string | null;
  inActiveCampaign: boolean;
  workflowType: string;
  stage: string;
  stageLabel: string;
  humanAction: string;
  dueDate: string | null;
  itemType: string;
  createdAt: string;
}

/** Dev-only preview row when the API queue is empty */
const TIM_QUEUE_DEMO_ID = "__tim_queue_demo__";

const TIM_QUEUE_DEMO_TASK: MessagingTask = {
  itemId: TIM_QUEUE_DEMO_ID,
  itemTitle: "Alex Morgan",
  itemSubtitle: "VP Product · ExampleCo",
  workflowId: "00000000-0000-0000-0000-000000000000",
  workflowName: "Warm Outreach",
  packageName: "Vibe Coding with Tim",
  ownerAgent: "tim",
  packageId: "00000000-0000-0000-0000-000000000001",
  packageNumber: 12,
  packageStage: "ACTIVE",
  inActiveCampaign: true,
  workflowType: "warm-outreach",
  stage: "MESSAGE_DRAFT",
  stageLabel: "Review Message Draft",
  humanAction:
    "Sample task: Tim drafted a short LinkedIn DM for review. Open artifacts to see the draft, then Submit when it looks right.",
  dueDate: null,
  itemType: "person",
  createdAt: new Date().toISOString(),
};

/** One line: package + workflow, or general / unscoped. */
function messageAffiliationLine(t: MessagingTask): string {
  if (!t.packageId) {
    if (t.workflowName?.trim()) return `General message · ${t.workflowName.trim()}`;
    return "General message";
  }
  const num =
    t.packageNumber != null && !Number.isNaN(t.packageNumber) ? `#${t.packageNumber} ` : "";
  const pkg = `${num}${(t.packageName && t.packageName.trim()) || "Package"}`.trim();
  const wf = t.workflowName?.trim() || "Workflow";
  return `${pkg} · ${wf}`;
}

const POLL_INTERVAL = 5000;

export default function TimMessagesPanel({ embedded = false }: { embedded?: boolean }) {
  const [tasks, setTasks] = useState<MessagingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [artifactView, setArtifactView] = useState<{
    workflowItemId: string;
    workflowName?: string;
    agentId?: string;
    taskItemId?: string;
  } | null>(null);
  const mountedRef = useRef(true);

  const fetchTasks = useCallback(() => {
    fetch("/api/crm/human-tasks?ownerAgent=tim&messagingOnly=true")
      .then((r) => r.json())
      .then((data) => {
        if (mountedRef.current) setTasks(data.tasks || []);
      })
      .catch(() => {
        if (mountedRef.current) setTasks([]);
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false);
      });
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchTasks();
    const interval = setInterval(fetchTasks, POLL_INTERVAL);
    const u1 = panelBus.on("workflow_items", fetchTasks);
    const u2 = panelBus.on("package_manager", fetchTasks);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
      u1();
      u2();
    };
  }, [fetchTasks]);

  const handleResolve = useCallback(
    async (itemId: string, action: "approve" | "reject" | "replied" | "ended") => {
      if (resolving) return;
      setResolving(itemId);
      try {
        const res = await fetch("/api/crm/human-tasks/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId, action }),
        });
        const data = await res.json();
        const taskRow = tasks.find((t) => t.itemId === itemId);
        const resolvedPackageId =
          (data as { packageId?: string | null }).packageId ?? taskRow?.packageId ?? null;
        const pushLogs = (logs: string[]) => {
          if (!logs?.length || !resolvedPackageId) return;
          try {
            const key = `simLog-${resolvedPackageId}`;
            const existing = JSON.parse(sessionStorage.getItem(key) || "[]");
            sessionStorage.setItem(key, JSON.stringify([...[...logs].reverse(), ...existing]));
            panelBus.emit("sim_log");
          } catch {
            /* ignore */
          }
        };
        if (data.ok) {
          if (data.logs?.length) pushLogs(data.logs);
          setTasks((prev) => prev.filter((t) => t.itemId !== itemId));
          setTimeout(fetchTasks, 400);
        } else {
          pushLogs([
            `[${new Date().toISOString()}] Resolve failed: ${data.error || res.status}`,
            ...(data.logs || []),
          ]);
        }
      } catch {
        /* ignore */
      }
      setResolving(null);
    },
    [fetchTasks, resolving, tasks]
  );

  const queue = useMemo(
    () => [...tasks].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
    [tasks]
  );

  const displayQueue = useMemo(() => {
    if (loading) return [];
    const base = [...queue];
    if (process.env.NODE_ENV === "development" && base.length === 0) {
      return [TIM_QUEUE_DEMO_TASK];
    }
    return base;
  }, [queue, loading]);

  const renderTask = (task: MessagingTask) => {
    const isDemo = task.itemId === TIM_QUEUE_DEMO_ID;
    return (
    <div
      key={task.itemId}
      className={`rounded-lg p-3 border space-y-2 ${
        isDemo
          ? "border-amber-500/35 bg-[var(--bg-secondary)] border-dashed"
          : "border-[var(--border-color)] bg-[var(--bg-secondary)]"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            {isDemo && (
              <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600/90 shrink-0">
                Demo
              </span>
            )}
            <div className="text-xs font-semibold text-[var(--text-primary)] truncate">
              {task.itemTitle}
            </div>
          </div>
          <div className="text-[10px] text-[var(--text-tertiary)]">
            {task.stageLabel}
            {task.packageStage ? ` · ${task.packageStage}` : ""}
          </div>
          <div className="text-[10px] text-[var(--text-secondary)] mt-0.5 leading-snug">
            {messageAffiliationLine(task)}
          </div>
        </div>
      </div>
      <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">{task.humanAction}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {!isDemo && (
        <button
          type="button"
          onClick={() =>
            setArtifactView({
              workflowItemId: task.itemId,
              workflowName: task.workflowName,
              agentId: task.ownerAgent,
              taskItemId: task.itemId,
            })
          }
          className="text-[10px] px-2.5 py-1 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-secondary)]"
        >
          View Artifacts
        </button>
        )}
        {isDemo && (
          <span className="text-[10px] text-[var(--text-tertiary)] italic">
            Preview only — not a real CRM task. Add a real item to hide this sample.
          </span>
        )}
        <div className="flex flex-wrap gap-1.5 ml-auto">
          {!isDemo && task.stage === "MESSAGED" && task.workflowType === "warm-outreach" && (
            <button
              type="button"
              onClick={() => handleResolve(task.itemId, "replied")}
              disabled={resolving === task.itemId}
              className="text-[10px] px-2.5 py-1 rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] disabled:opacity-50"
            >
              Replied
            </button>
          )}
          {!isDemo && task.stage === "REPLY_DRAFT" && task.workflowType === "warm-outreach" && (
            <button
              type="button"
              onClick={() => handleResolve(task.itemId, "ended")}
              disabled={resolving === task.itemId}
              className="text-[10px] px-2.5 py-1 rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] disabled:opacity-50"
            >
              End Sequence
            </button>
          )}
          {!isDemo && !NO_REJECT_STAGES.has(task.stage) && (
            <button
              type="button"
              onClick={() => handleResolve(task.itemId, "reject")}
              disabled={resolving === task.itemId}
              className="text-[10px] px-2.5 py-1 rounded-md border border-red-500/20 bg-red-500/5 text-red-400/90 disabled:opacity-50"
            >
              Reject
            </button>
          )}
          {!isDemo && (
          <button
            type="button"
            onClick={() => handleResolve(task.itemId, "approve")}
            disabled={resolving === task.itemId}
            className="text-[10px] px-2.5 py-1 rounded-md border border-[var(--accent-green)]/30 bg-[var(--accent-green)]/10 disabled:opacity-50"
          >
            {task.stage === "MESSAGED" && task.workflowType === "warm-outreach" ? "Continue" : "Submit"}
          </button>
          )}
        </div>
      </div>
    </div>
  );
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-[var(--text-tertiary)]">Loading messages…</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {!embedded && (
        <div className="shrink-0 px-3 py-2 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
          <span className="text-xs font-semibold text-[var(--text-primary)]">Message queue</span>
          <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5 leading-snug">
            One row per message task — drafts from workflows, sends to review, or replies. Each shows which package and workflow it belongs to, or{" "}
            <span className="text-[var(--text-secondary)]">General message</span> when there is no package.
          </p>
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2 pb-4">
        {!loading && displayQueue.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)] text-center py-8">Queue is empty</p>
        ) : (
          displayQueue.map(renderTask)
        )}
      </div>

      {artifactView && typeof document !== "undefined" &&
        createPortal(
          <ArtifactViewer
            workflowItemId={artifactView.workflowItemId}
            title={artifactView.workflowName}
            agentId={artifactView.agentId}
            onSubmitTask={
              artifactView.taskItemId
                ? () => handleResolve(artifactView.taskItemId!, "approve")
                : undefined
            }
            onClose={() => setArtifactView(null)}
          />,
          document.body
        )}
    </div>
  );
}

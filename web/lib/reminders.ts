import { query } from "./db";

export interface Reminder {
  id: string;
  agentId: string;
  category: "birthday" | "holiday" | "recurring" | "one-time" | "note";
  title: string;
  description: string | null;
  nextDueAt: string | null;
  recurrence: "yearly" | "monthly" | "weekly" | "daily" | null;
  recurrenceAnchor: Record<string, number> | null;
  advanceNoticeDays: number;
  lastDeliveredAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ListOpts {
  category?: string;
  search?: string;
  upcoming?: boolean;
  includeInactive?: boolean;
}

export async function listReminders(
  agentId: string,
  opts: ListOpts = {}
): Promise<Reminder[]> {
  const conditions = [
    `"agentId" = $1`,
    `"deletedAt" IS NULL`,
  ];
  const params: unknown[] = [agentId];
  let idx = 2;

  if (!opts.includeInactive) {
    conditions.push(`"isActive" = TRUE`);
  }
  if (opts.category) {
    conditions.push(`category = $${idx++}`);
    params.push(opts.category);
  }
  if (opts.search) {
    conditions.push(`(title ILIKE $${idx} OR description ILIKE $${idx})`);
    params.push(`%${opts.search}%`);
    idx++;
  }

  const orderBy = opts.upcoming
    ? `ORDER BY "nextDueAt" ASC NULLS LAST`
    : `ORDER BY category, title`;

  const where = conditions.join(" AND ");
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM "_reminder" WHERE ${where} ${orderBy} LIMIT 200`,
    params
  );
  return rows.map(rowToReminder);
}

export async function getUpcomingReminders(
  agentId: string,
  limit = 10
): Promise<Reminder[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM "_reminder"
     WHERE "agentId" = $1
       AND "deletedAt" IS NULL
       AND "isActive" = TRUE
       AND "nextDueAt" IS NOT NULL
       AND "nextDueAt" >= NOW() - INTERVAL '1 day'
     ORDER BY "nextDueAt" ASC
     LIMIT $2`,
    [agentId, limit]
  );
  return rows.map(rowToReminder);
}

export async function addReminder(
  agentId: string,
  data: {
    category: string;
    title: string;
    description?: string;
    nextDueAt?: string;
    recurrence?: string;
    recurrenceAnchor?: Record<string, number>;
    advanceNoticeDays?: number;
  }
): Promise<Reminder> {
  const rows = await query<Record<string, unknown>>(
    `INSERT INTO "_reminder" ("agentId", category, title, description, "nextDueAt", recurrence, "recurrenceAnchor", "advanceNoticeDays")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      agentId,
      data.category,
      data.title,
      data.description || null,
      data.nextDueAt || null,
      data.recurrence || null,
      data.recurrenceAnchor ? JSON.stringify(data.recurrenceAnchor) : null,
      data.advanceNoticeDays ?? 0,
    ]
  );
  return rowToReminder(rows[0]);
}

export async function updateReminder(
  id: string,
  data: Partial<{
    title: string;
    description: string;
    category: string;
    nextDueAt: string;
    recurrence: string;
    recurrenceAnchor: Record<string, number>;
    advanceNoticeDays: number;
    isActive: boolean;
  }>
): Promise<void> {
  const sets: string[] = [`"updatedAt" = NOW()`];
  const params: unknown[] = [];
  let idx = 1;

  if (data.title !== undefined) {
    sets.push(`title = $${idx++}`);
    params.push(data.title);
  }
  if (data.description !== undefined) {
    sets.push(`description = $${idx++}`);
    params.push(data.description);
  }
  if (data.category !== undefined) {
    sets.push(`category = $${idx++}`);
    params.push(data.category);
  }
  if (data.nextDueAt !== undefined) {
    sets.push(`"nextDueAt" = $${idx++}`);
    params.push(data.nextDueAt);
  }
  if (data.recurrence !== undefined) {
    sets.push(`recurrence = $${idx++}`);
    params.push(data.recurrence);
  }
  if (data.recurrenceAnchor !== undefined) {
    sets.push(`"recurrenceAnchor" = $${idx++}`);
    params.push(JSON.stringify(data.recurrenceAnchor));
  }
  if (data.advanceNoticeDays !== undefined) {
    sets.push(`"advanceNoticeDays" = $${idx++}`);
    params.push(data.advanceNoticeDays);
  }
  if (data.isActive !== undefined) {
    sets.push(`"isActive" = $${idx++}`);
    params.push(data.isActive);
  }

  params.push(id);
  await query(
    `UPDATE "_reminder" SET ${sets.join(", ")} WHERE id = $${idx} AND "deletedAt" IS NULL`,
    params
  );
}

export async function deleteReminder(id: string): Promise<void> {
  await query(
    `UPDATE "_reminder" SET "deletedAt" = NOW(), "updatedAt" = NOW() WHERE id = $1`,
    [id]
  );
}

/**
 * Get reminders that are due now (considering advanceNoticeDays).
 * A reminder is due when: nextDueAt - advanceNoticeDays <= NOW()
 * and it hasn't been delivered for this occurrence yet.
 */
export async function getDueReminders(agentId: string): Promise<Reminder[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM "_reminder"
     WHERE "agentId" = $1
       AND "deletedAt" IS NULL
       AND "isActive" = TRUE
       AND "nextDueAt" IS NOT NULL
       AND ("nextDueAt" - ("advanceNoticeDays" || ' days')::INTERVAL) <= NOW()
       AND ("lastDeliveredAt" IS NULL OR "lastDeliveredAt" < "nextDueAt" - ("advanceNoticeDays" || ' days')::INTERVAL)
     ORDER BY "nextDueAt" ASC`,
    [agentId]
  );
  return rows.map(rowToReminder);
}

/**
 * Mark a reminder as delivered and advance to next occurrence if recurring.
 */
export async function markDeliveredAndAdvance(id: string): Promise<void> {
  // First get the reminder
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM "_reminder" WHERE id = $1`,
    [id]
  );
  if (rows.length === 0) return;

  const reminder = rowToReminder(rows[0]);

  if (reminder.recurrence && reminder.recurrenceAnchor && reminder.nextDueAt) {
    // Compute next occurrence
    const next = computeNextOccurrence(
      new Date(reminder.nextDueAt),
      reminder.recurrence,
      reminder.recurrenceAnchor
    );
    await query(
      `UPDATE "_reminder" SET "lastDeliveredAt" = NOW(), "nextDueAt" = $1, "updatedAt" = NOW() WHERE id = $2`,
      [next.toISOString(), id]
    );
  } else {
    // One-time reminder: mark delivered and deactivate
    await query(
      `UPDATE "_reminder" SET "lastDeliveredAt" = NOW(), "isActive" = FALSE, "updatedAt" = NOW() WHERE id = $1`,
      [id]
    );
  }
}

function computeNextOccurrence(
  current: Date,
  recurrence: string,
  anchor: Record<string, number>
): Date {
  const next = new Date(current);

  switch (recurrence) {
    case "yearly": {
      // Move to next year, same month/day
      next.setFullYear(next.getFullYear() + 1);
      if (anchor.month !== undefined) next.setMonth(anchor.month - 1);
      if (anchor.day !== undefined) next.setDate(anchor.day);
      break;
    }
    case "monthly": {
      next.setMonth(next.getMonth() + 1);
      if (anchor.dayOfMonth !== undefined) next.setDate(anchor.dayOfMonth);
      break;
    }
    case "weekly": {
      next.setDate(next.getDate() + 7);
      break;
    }
    case "daily": {
      next.setDate(next.getDate() + 1);
      break;
    }
  }

  return next;
}

function rowToReminder(row: Record<string, unknown>): Reminder {
  return {
    id: row.id as string,
    agentId: row.agentId as string,
    category: row.category as Reminder["category"],
    title: row.title as string,
    description: (row.description as string) || null,
    nextDueAt: row.nextDueAt ? (row.nextDueAt as Date).toISOString() : null,
    recurrence: (row.recurrence as Reminder["recurrence"]) || null,
    recurrenceAnchor: row.recurrenceAnchor as Record<string, number> | null,
    advanceNoticeDays: (row.advanceNoticeDays as number) ?? 0,
    lastDeliveredAt: row.lastDeliveredAt
      ? (row.lastDeliveredAt as Date).toISOString()
      : null,
    isActive: row.isActive as boolean,
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  };
}

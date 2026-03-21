import { query } from "./db";

export interface PunchListItem {
  id: string;
  agentId: string;
  title: string;
  description: string | null;
  rank: number;
  status: "open" | "done";
  createdAt: string;
  updatedAt: string;
}

interface ListOpts {
  status?: "open" | "done";
  search?: string;
}

export async function listPunchListItems(
  agentId: string,
  opts: ListOpts = {}
): Promise<PunchListItem[]> {
  const conditions = [`"agentId" = $1`, `"deletedAt" IS NULL`];
  const params: unknown[] = [agentId];
  let idx = 2;

  if (opts.status) {
    conditions.push(`status = $${idx++}`);
    params.push(opts.status);
  }
  if (opts.search) {
    conditions.push(`(title ILIKE $${idx} OR description ILIKE $${idx})`);
    params.push(`%${opts.search}%`);
    idx++;
  }

  const where = conditions.join(" AND ");
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM "_punch_list" WHERE ${where} ORDER BY CASE WHEN status = 'open' THEN 0 ELSE 1 END, rank ASC, "createdAt" ASC LIMIT 200`,
    params
  );
  return rows.map(rowToItem);
}

export async function addPunchListItem(
  agentId: string,
  data: { title: string; description?: string; rank?: number }
): Promise<PunchListItem> {
  const rows = await query<Record<string, unknown>>(
    `INSERT INTO "_punch_list" ("agentId", title, description, rank)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [agentId, data.title, data.description || null, data.rank ?? 4]
  );
  return rowToItem(rows[0]);
}

export async function updatePunchListItem(
  id: string,
  data: Partial<{ title: string; description: string; rank: number; status: string }>
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
  if (data.rank !== undefined) {
    sets.push(`rank = $${idx++}`);
    params.push(data.rank);
  }
  if (data.status !== undefined) {
    sets.push(`status = $${idx++}`);
    params.push(data.status);
  }

  params.push(id);
  await query(
    `UPDATE "_punch_list" SET ${sets.join(", ")} WHERE id = $${idx} AND "deletedAt" IS NULL`,
    params
  );
}

export async function deletePunchListItem(id: string): Promise<void> {
  await query(
    `UPDATE "_punch_list" SET "deletedAt" = NOW(), "updatedAt" = NOW() WHERE id = $1`,
    [id]
  );
}

function rowToItem(row: Record<string, unknown>): PunchListItem {
  return {
    id: row.id as string,
    agentId: row.agentId as string,
    title: row.title as string,
    description: (row.description as string) || null,
    rank: row.rank as number,
    status: row.status as PunchListItem["status"],
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  };
}

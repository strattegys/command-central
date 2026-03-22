import { Pool } from "pg";

const SCHEMA = "workspace_9rc10n79wgdr0r3z6mzti24f6";

const pool = new Pool({
  host: process.env.CRM_DB_HOST || "127.0.0.1",
  port: parseInt(process.env.CRM_DB_PORT || "5432"),
  database: process.env.CRM_DB_NAME || "default",
  user: process.env.CRM_DB_USER || "postgres",
  password: process.env.CRM_DB_PASSWORD,
  max: 5,
});

export async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO "${SCHEMA}", public`);
    const result = await client.query(sql, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

/** Run multiple statements in a transaction. Returns the result of the callback. */
export async function transaction<T>(
  fn: (run: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO "${SCHEMA}", public`);
    await client.query("BEGIN");
    const result = await fn((sql, params) => client.query(sql, params));
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

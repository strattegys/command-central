/**
 * Verify CRM Postgres is reachable from YOUR machine (same path as the SSH tunnel).
 * Run:  cd web && npm run check-crm-db
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env.local");

function parseEnvLocal(file) {
  if (!fs.existsSync(file)) {
    console.error("Missing web/.env.local — copy web/.env.local.example");
    process.exit(1);
  }
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    const v = m[2].trim().replace(/^["']|["']$/g, "");
    out[m[1]] = v;
  }
  return out;
}

const env = parseEnvLocal(envPath);
const password = env.CRM_DB_PASSWORD?.trim();
const port = parseInt(env.CRM_DB_PORT || "5433", 10);
const database = env.CRM_DB_NAME || "default";
const user = env.CRM_DB_USER || "postgres";
const configuredHost = (env.CRM_DB_HOST || "").trim();

if (!password) {
  console.error("CRM_DB_PASSWORD is missing in web/.env.local");
  process.exit(1);
}

if (
  configuredHost &&
  configuredHost !== "127.0.0.1" &&
  configuredHost !== "localhost"
) {
  console.warn(
    `Note: CRM_DB_HOST=${configuredHost} — this check always probes 127.0.0.1 (SSH tunnel). For local npm run dev with a tunnel, set CRM_DB_HOST=127.0.0.1 in .env.local.`
  );
}

const client = new pg.Client({
  host: "127.0.0.1",
  port,
  database,
  user,
  password,
  connectionTimeoutMillis: 5000,
});

try {
  await client.connect();
  await client.query("SELECT 1");
  await client.end();
  console.log(
    `OK — CRM Postgres at 127.0.0.1:${port}. Docker dev uses host.docker.internal:${port}.`
  );
  process.exit(0);
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error("CRM DB check failed:", msg);
  console.error(
    "\nStart tunnel (from COMMAND-CENTRAL): .\\scripts\\crm-db-tunnel.ps1 or bash scripts/crm-db-tunnel.sh"
  );
  try { await client.end(); } catch { /* ignore */ }
  process.exit(1);
}

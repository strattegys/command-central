#!/usr/bin/env node
/**
 * One-time: attach orphan _workflow rows (packageId IS NULL) to new DRAFT _package rows.
 * Does NOT modify _workflow_item, person, _artifact, or notes.
 *
 * Exclude Agent Army (or any workflow) via env:
 *   PACKAGE_MIGRATION_EXCLUDE_WORKFLOW_IDS=uuid1,uuid2
 *
 * Dry run (no writes):
 *   node scripts/migrate-orphan-workflows-to-packages.mjs --dry-run
 *
 * From web/:
 *   node scripts/migrate-orphan-workflows-to-packages.mjs
 *
 * Requires CRM_DB_* in web/.env.local (same as db-exec).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { Pool } = require("pg");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.join(__dirname, "..");
const SCHEMA = process.env.CRM_DB_SEARCH_PATH || "workspace_9rc10n79wgdr0r3z6mzti24f6";

function loadEnvLocal() {
  const envPath = path.join(WEB_ROOT, ".env.local");
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined || process.env[key] === "") process.env[key] = val;
  }
}

loadEnvLocal();

const dryRun = process.argv.includes("--dry-run");
const excludeRaw = process.env.PACKAGE_MIGRATION_EXCLUDE_WORKFLOW_IDS || "";
const excludeSet = new Set(
  excludeRaw
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
);

const password = process.env.CRM_DB_PASSWORD?.trim();
if (!password) {
  console.error("CRM_DB_PASSWORD missing — set in web/.env.local");
  process.exit(1);
}

const pool = new Pool({
  host: process.env.CRM_DB_HOST || "127.0.0.1",
  port: parseInt(process.env.CRM_DB_PORT || "5432", 10),
  database: process.env.CRM_DB_NAME || "default",
  user: process.env.CRM_DB_USER || "postgres",
  password,
  max: 2,
});

const LEGACY_TEMPLATE = "influencer-package";
const EMPTY_SPEC = JSON.stringify({ deliverables: [], brief: "Migrated orphan workflow — edit in Penny." });

async function main() {
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO "${SCHEMA}", public`);

    const { rows: orphans } = await client.query(
      `SELECT id, name, stage FROM "_workflow"
       WHERE "deletedAt" IS NULL AND "packageId" IS NULL
       ORDER BY name NULLS LAST`
    );

    const targets = orphans.filter((w) => !excludeSet.has(String(w.id).toLowerCase()));

    console.log(`Orphan workflows (no package): ${orphans.length}`);
    console.log(`Excluded by PACKAGE_MIGRATION_EXCLUDE_WORKFLOW_IDS: ${orphans.length - targets.length}`);
    console.log(`To migrate: ${targets.length}`);
    if (excludeSet.size > 0) {
      console.log(`Exclude set size: ${excludeSet.size}`);
    }

    if (dryRun) {
      for (const w of targets) {
        console.log(`  [dry-run] would create DRAFT package + link workflow ${w.id} (${w.name})`);
      }
      return;
    }

    let done = 0;
    for (const w of targets) {
      const pkgName = (w.name && String(w.name).trim()) || `Legacy workflow ${String(w.id).slice(0, 8)}`;
      const ins = await client.query(
        `INSERT INTO "_package" ("templateId", name, spec, stage, "createdBy", "createdAt", "updatedAt")
         VALUES ($1, $2, $3::jsonb, 'DRAFT', 'migration', NOW(), NOW())
         RETURNING id`,
        [LEGACY_TEMPLATE, pkgName, EMPTY_SPEC]
      );
      const packageId = ins.rows[0].id;
      await client.query(`UPDATE "_workflow" SET "packageId" = $1, "updatedAt" = NOW() WHERE id = $2`, [
        packageId,
        w.id,
      ]);
      console.log(`Linked workflow ${w.id} → package ${packageId} (${pkgName})`);
      done++;
    }
    console.log(`Done. Migrated ${done} workflow(s).`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

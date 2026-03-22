/**
 * One-time migration: seed existing MEMORY.md facts into the vector _memory table.
 *
 * Usage: npx tsx scripts/seed-vector-memory.ts
 */

import { readFileSync, existsSync } from "fs";

// Load env
const envPath = require("path").join(__dirname, "../.env.local");
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const match = line.match(/^([A-Z_]+)=(.+)$/);
    if (match) process.env[match[1]] = match[2];
  }
}

import { insertMemory } from "../lib/vector-memory";

const MEMORY_FILE = "/root/.suzibot/memory/MEMORY.md";
const AGENT_ID = "suzi";

function inferCategory(fact: string): string {
  const lower = fact.toLowerCase();
  if (/\bprefer|like|dislike|favorite|love|hate|want\b/.test(lower))
    return "preference";
  if (/\bname is|birthday|wife|husband|daughter|son|friend|boss|susan|elle\b/.test(lower))
    return "person";
  if (/\bproject|app|build|deploy|launch|website|repo\b/.test(lower))
    return "project";
  if (/\bdecide|chose|pick|went with|agreed|approved\b/.test(lower))
    return "decision";
  return "fact";
}

async function main() {
  if (!existsSync(MEMORY_FILE)) {
    console.log(`No MEMORY.md found at ${MEMORY_FILE}, nothing to migrate.`);
    return;
  }

  const content = readFileSync(MEMORY_FILE, "utf-8");
  const lines = content
    .split("\n")
    .map((l) => l.replace(/^[-*]\s*/, "").trim())
    .filter((l) => l.length > 5);

  console.log(`Migrating ${lines.length} facts from MEMORY.md...`);

  for (let i = 0; i < lines.length; i++) {
    const fact = lines[i];
    const category = inferCategory(fact);
    console.log(
      `  [${i + 1}/${lines.length}] [${category}] ${fact.substring(0, 70)}${fact.length > 70 ? "..." : ""}`
    );
    try {
      await insertMemory(AGENT_ID, fact, {
        source: "migration",
        category,
      });
    } catch (err) {
      console.error(`  ERROR: ${err}`);
    }
    // Small delay every 10 facts to avoid rate-limiting
    if (i % 10 === 9) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  console.log("\nMigration complete!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});

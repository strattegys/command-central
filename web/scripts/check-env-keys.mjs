import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.join(__dirname, "..");

function keySet(file) {
  const text = fs.readFileSync(file, "utf8");
  const keys = new Set();
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    if (m) keys.add(m[1]);
  }
  return keys;
}

function checkValues(envPath) {
  const text = fs.readFileSync(envPath, "utf8");
  const issues = [];
  const skipPlaceholder = new Set([
    "TOOL_SCRIPTS_PATH",
    "NEXTAUTH_URL",
    "TWENTY_CRM_URL",
    "CRM_DB_HOST",
    "SITE_API_URL",
  ]);
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    const k = m[1];
    const v = m[2].trim().replace(/^["']|["']$/g, "");
    if (!v) issues.push(`${k} (empty)`);
    else if (
      !skipPlaceholder.has(k) &&
      !/_PORT$/.test(k) &&
      (/your_|^change|^replace/i.test(v) || v.length < 6)
    ) {
      issues.push(`${k} (looks placeholder)`);
    }
  }
  return issues;
}

const example = path.join(webDir, ".env.local.example");
const local = path.join(webDir, ".env.local");
const ex = keySet(example);
const ac = keySet(local);

console.log("Keys in .env.local:", [...ac].sort().join(", "));
const missing = [...ex].filter((k) => !ac.has(k));
console.log(
  "Example keys missing from .env.local:",
  missing.length ? missing.join(", ") : "(none)"
);
const issues = checkValues(local);
console.log("Issues:", issues.length ? issues.join("; ") : "(none)");

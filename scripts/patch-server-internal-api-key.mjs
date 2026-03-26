#!/usr/bin/env node
/**
 * Set INTERNAL_API_KEY on Command Central droplet (warm-outreach webhook → resolve).
 *
 * Usage:
 *   # Use existing key from your local web/.env.local (recommended — keep local + server identical):
 *   node COMMAND-CENTRAL/scripts/patch-server-internal-api-key.mjs
 *
 *   # Or pass explicitly:
 *   $env:INTERNAL_API_KEY='...'; node COMMAND-CENTRAL/scripts/patch-server-internal-api-key.mjs
 *
 *   # Or generate a new random key (prints full value once — save it, then add to local .env.local):
 *   node COMMAND-CENTRAL/scripts/patch-server-internal-api-key.mjs --generate
 *
 * Requires: ssh in PATH, key at ~/.ssh/hetzner_ed25519 (override SSH_KEY)
 */
import { spawnSync } from "child_process";
import { randomBytes } from "crypto";
import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const localEnv = join(repoRoot, "web", ".env.local");

const generate = process.argv.includes("--generate");

let key = process.env.INTERNAL_API_KEY?.trim();
if (!key && !generate && existsSync(localEnv)) {
  const text = readFileSync(localEnv, "utf8");
  const m = text.match(/^INTERNAL_API_KEY=(.+)$/m);
  if (m) key = m[1].trim().replace(/^["']|["']$/g, "");
}
if (!key && generate) {
  key = randomBytes(24).toString("hex");
  console.error("Generated INTERNAL_API_KEY (add this line to web/.env.local on this machine):");
  console.error(`INTERNAL_API_KEY=${key}`);
  console.error("");
}
if (!key) {
  console.error(
    "No INTERNAL_API_KEY: set env var, use --generate, or add INTERNAL_API_KEY to web/.env.local"
  );
  process.exit(1);
}

const host = process.env.CC_DEPLOY_HOST || "root@137.184.187.233";
const keyPath = process.env.SSH_KEY || join(homedir(), ".ssh", "hetzner_ed25519");
const remotePath = process.env.CC_ENV_PATH || "/opt/agent-tim/web/.env.local";

const pyOneLiner =
  "import re;" +
  "p=" +
  JSON.stringify(remotePath) +
  ";" +
  "k=" +
  JSON.stringify(key) +
  ";" +
  "c=open(p).read();" +
  "c=re.sub(r'^INTERNAL_API_KEY=.*$','INTERNAL_API_KEY='+k,c,flags=re.M) if re.search(r'^INTERNAL_API_KEY=',c,re.M) else c.rstrip()+'\\nINTERNAL_API_KEY='+k+'\\n';" +
  "open(p,'w').write(c);" +
  "print('INTERNAL_API_KEY updated');";

const remoteCmd =
  "python3 -c " + JSON.stringify(pyOneLiner) + " && cd /opt/agent-tim && docker compose restart web";

const r = spawnSync(
  "ssh",
  ["-i", keyPath, "-o", "BatchMode=yes", "-o", "ConnectTimeout=25", host, remoteCmd],
  { encoding: "utf-8", shell: false }
);

console.log(r.stdout || "");
console.error(r.stderr || "");
process.exit(r.status ?? 1);

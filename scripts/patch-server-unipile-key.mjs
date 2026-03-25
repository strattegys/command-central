#!/usr/bin/env node
/**
 * Update UNIPILE_API_KEY on Command Central droplet and restart web.
 * Usage:
 *   $env:UNIPILE_API_KEY='...'; node COMMAND-CENTRAL/scripts/patch-server-unipile-key.mjs
 *
 * Requires: ssh in PATH, key at ~/.ssh/hetzner_ed25519 (override SSH_KEY)
 */
import { spawnSync } from "child_process";
import { homedir } from "os";
import { join } from "path";

const newKey = process.env.UNIPILE_API_KEY?.trim();
if (!newKey) {
  console.error("Set UNIPILE_API_KEY in the environment to the new token.");
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
  JSON.stringify(newKey) +
  ";" +
  "c=open(p).read();" +
  "c=re.sub(r'^UNIPILE_API_KEY=.*$','UNIPILE_API_KEY='+k,c,flags=re.M) if re.search(r'^UNIPILE_API_KEY=',c,re.M) else c.rstrip()+'\\nUNIPILE_API_KEY='+k+'\\n';" +
  "open(p,'w').write(c);" +
  "print('UNIPILE_API_KEY updated');";

const remoteCmd = "python3 -c " + JSON.stringify(pyOneLiner) + " && cd /opt/agent-tim && docker compose restart web";

const r = spawnSync(
  "ssh",
  ["-i", keyPath, "-o", "BatchMode=yes", "-o", "ConnectTimeout=25", host, remoteCmd],
  { encoding: "utf-8", shell: false }
);

console.log(r.stdout || "");
console.error(r.stderr || "");
process.exit(r.status ?? 1);

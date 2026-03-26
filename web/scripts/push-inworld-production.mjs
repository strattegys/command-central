#!/usr/bin/env node
/**
 * Set INWORLD_TTS_KEY on the Command Central droplet from local Rainbow .env,
 * then git pull master and docker compose rebuild/restart web (same idea as CI).
 *
 * Requires: SSH key (default Windows path below), rainbow/.env with INWORLD_TTS_KEY.
 *
 *   npm run push:inworld:prod
 *
 * Env overrides:
 *   SSH_IDENTITY — path to private key (default: C:/Users/USER1/.ssh/hetzner_ed25519)
 *   DEPLOY_HOST  — default: 137.184.187.233
 *   RAINBOW_ENV_PATH — full path to rainbow/.env if not default layout
 */

import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..", "..");
const RAINBOW_ENV =
  process.env.RAINBOW_ENV_PATH ||
  path.join(REPO_ROOT, "..", "PROJECT-SERVER", "rainbow", ".env");
const SSH_IDENTITY = process.env.SSH_IDENTITY || "C:/Users/USER1/.ssh/hetzner_ed25519";
const DEPLOY_HOST = process.env.DEPLOY_HOST || "137.184.187.233";

function main() {
  if (!fs.existsSync(RAINBOW_ENV)) {
    console.error(`[push-inworld:prod] Missing ${RAINBOW_ENV}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(RAINBOW_ENV, "utf8");
  const m = raw.match(/^INWORLD_TTS_KEY=(.+)$/m);
  if (!m) {
    console.error("[push-inworld:prod] INWORLD_TTS_KEY not found in Rainbow .env");
    process.exit(1);
  }
  const line = `INWORLD_TTS_KEY=${m[1].trim()}`;
  const b64 = Buffer.from(line, "utf8").toString("base64");

  const remoteBash = `set -euo pipefail
ENV=/opt/agent-tim/web/.env.local
mkdir -p "$(dirname "$ENV")"
touch "$ENV"
LINE=$(echo '${b64}' | base64 -d)
grep -v '^INWORLD_TTS_KEY=' "$ENV" > "$ENV.tmp" && mv "$ENV.tmp" "$ENV"
printf '%s\\n' "$LINE" >> "$ENV"
cd /opt/agent-tim
git fetch origin master
git reset --hard origin/master
if docker network inspect crm_shared >/dev/null 2>&1; then CF="-f docker-compose.yml -f docker-compose.crm-network.yml"; else CF="-f docker-compose.yml"; fi
docker compose $CF build --no-cache web
docker compose $CF up -d
echo "[push-inworld:prod] Server: INWORLD_TTS_KEY merged; compose up complete."
`;

  const r = spawnSync(
    "ssh",
    [
      "-i",
      SSH_IDENTITY,
      "-o",
      "StrictHostKeyChecking=accept-new",
      `root@${DEPLOY_HOST}`,
      "bash",
      "-s",
    ],
    { input: remoteBash, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 }
  );

  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.error) {
    console.error(r.error.message);
    process.exit(1);
  }
  process.exit(r.status === null ? 1 : r.status);
}

main();

#!/usr/bin/env node
/**
 * Copy INWORLD_TTS_KEY from PROJECT-SERVER/rainbow/.env into web/.env.local
 * (same Basic auth key Rainbow uses for Inworld TTS).
 *
 * Does not change INWORLD_VOICE_ID in .env.local — Command Central uses per-agent
 * voices (Suzi=Olivia, Tim=Timothy); optional INWORLD_VOICE_ID stays as you set it.
 *
 * From web/:
 *   npm run sync:inworld
 *
 * Layout: DEV-MASTER/COMMAND-CENTRAL/web and DEV-MASTER/PROJECT-SERVER/rainbow
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.join(__dirname, "..");
const LOCAL_ENV = path.join(WEB_ROOT, ".env.local");
const RAINBOW_ENV =
  process.env.RAINBOW_ENV_PATH ||
  path.join(WEB_ROOT, "..", "..", "PROJECT-SERVER", "rainbow", ".env");

function parseKey(content, key) {
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m && m[1] === key) return m[2].trim().replace(/^["']|["']$/g, "");
  }
  return null;
}

function setOrAppendEnvKey(body, key, value) {
  const lines = body.split(/\r?\n/);
  const re = new RegExp(`^\\s*${key}=`, "m");
  const newLine = `${key}=${value}`;
  if (re.test(body)) {
    return lines
      .map((line) => {
        const t = line.trim();
        if (!t || t.startsWith("#")) return line;
        if (new RegExp(`^${key}=`).test(t)) return newLine;
        return line;
      })
      .join("\n");
  }
  const sep = body.endsWith("\n") || body.length === 0 ? "" : "\n";
  const header =
    body.trim().length === 0
      ? ""
      : `${sep}\n# Inworld TTS — synced from PROJECT-SERVER/rainbow/.env\n`;
  return `${body.trimEnd()}${header}${newLine}\n`;
}

function main() {
  if (!fs.existsSync(RAINBOW_ENV)) {
    console.error(
      `[sync-inworld] Rainbow env not found: ${RAINBOW_ENV}\n` +
        "Set RAINBOW_ENV_PATH to the full path of rainbow/.env, or keep DEV-MASTER layout."
    );
    process.exit(1);
  }

  const rainbowRaw = fs.readFileSync(RAINBOW_ENV, "utf8");
  const key = parseKey(rainbowRaw, "INWORLD_TTS_KEY");
  if (!key) {
    console.error("[sync-inworld] INWORLD_TTS_KEY missing in Rainbow .env");
    process.exit(1);
  }

  let local = "";
  if (fs.existsSync(LOCAL_ENV)) {
    local = fs.readFileSync(LOCAL_ENV, "utf8");
  }

  const prev = parseKey(local, "INWORLD_TTS_KEY");
  const next = setOrAppendEnvKey(local, "INWORLD_TTS_KEY", key);
  fs.writeFileSync(LOCAL_ENV, next, "utf8");

  if (prev === key) {
    console.log(`[sync-inworld] web/.env.local already has same INWORLD_TTS_KEY (${key.length} chars).`);
  } else {
    console.log(
      `[sync-inworld] Wrote INWORLD_TTS_KEY to web/.env.local (${key.length} chars). Restart dev server or Docker if running.`
    );
  }
}

main();

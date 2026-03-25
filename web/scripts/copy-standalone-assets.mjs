/**
 * Cross-platform replacement for: cp -r .next/static .next/standalone/.next/static && cp -r public .next/standalone/public
 * (Windows cmd has no `cp`.)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const nextDir = path.join(root, ".next");
const standalone = path.join(nextDir, "standalone");

if (!fs.existsSync(standalone)) {
  console.warn(
    "[copy-standalone-assets] .next/standalone missing — skipping (expected when output is not standalone)"
  );
  process.exit(0);
}

const destNext = path.join(standalone, ".next");
fs.mkdirSync(destNext, { recursive: true });

const srcStatic = path.join(nextDir, "static");
const destStatic = path.join(destNext, "static");
if (fs.existsSync(srcStatic)) {
  fs.cpSync(srcStatic, destStatic, { recursive: true });
  console.log("[copy-standalone-assets] synced .next/static → standalone/.next/static");
}

const srcPublic = path.join(root, "public");
const destPublic = path.join(standalone, "public");
if (fs.existsSync(srcPublic)) {
  fs.cpSync(srcPublic, destPublic, { recursive: true });
  console.log("[copy-standalone-assets] synced public → standalone/public");
}

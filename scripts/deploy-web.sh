#!/bin/bash
set -e

# =============================================================================
# Deploy Command Central to production
# Usage: bash scripts/deploy-web.sh
#
# What this does:
#   1. Validates TypeScript compiles locally (catches errors before touching server)
#   2. Pushes code to GitHub (only ~4MB of source)
#   3. SSHs to server: pulls code, builds, restarts PM2
#   4. Runs health check and shows logs
# =============================================================================

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_DIR="$REPO_ROOT/web"
SERVER="root@137.184.187.233"
SERVER_REPO="/opt/agent-tim"
SERVER_WEB="/opt/agent-tim/web"
DEPLOY_KEY="C:/Users/USER1/.ssh/hetzner_ed25519"

# Required env vars to check on server
REQUIRED_VARS="GEMINI_API_KEY NEXTAUTH_SECRET NEXTAUTH_URL ALLOWED_EMAIL"

# Use ssh-agent socket
export SSH_AUTH_SOCK=/tmp/tim-agent.sock

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo "========================================"
echo "  Deploy Command Central"
echo "========================================"
echo ""

# ─── Step 1: Local Validation ───────────────────────────────────────────────

echo -e "${YELLOW}[1/5] Validating locally...${NC}"

# Check we're on master
BRANCH=$(cd "$REPO_ROOT" && git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "master" ]; then
  echo -e "${RED}ERROR: Not on master branch (on '$BRANCH'). Switch to master first.${NC}"
  exit 1
fi

# Check for uncommitted changes (warn, don't block)
if ! (cd "$REPO_ROOT" && git diff --quiet && git diff --cached --quiet); then
  echo -e "${YELLOW}WARNING: You have uncommitted changes. They won't be deployed.${NC}"
  echo "  Run 'git add' and 'git commit' first if you want them included."
  echo ""
  read -p "Continue anyway? [y/N] " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# TypeScript check
echo "  Running TypeScript check..."
(cd "$WEB_DIR" && npx tsc --noEmit 2>&1) || {
  echo -e "${RED}ERROR: TypeScript errors found. Fix them before deploying.${NC}"
  exit 1
}
echo -e "  ${GREEN}TypeScript OK${NC}"

# ─── Step 2: Push to GitHub ─────────────────────────────────────────────────

echo ""
echo -e "${YELLOW}[2/5] Pushing to GitHub...${NC}"
(cd "$REPO_ROOT" && git push origin master 2>&1) || {
  echo -e "${RED}ERROR: Git push failed.${NC}"
  exit 1
}
echo -e "  ${GREEN}Pushed to origin/master${NC}"

# ─── Step 3: Validate Server Environment ────────────────────────────────────

echo ""
echo -e "${YELLOW}[3/5] Checking server environment...${NC}"

# Check SSH connectivity
ssh -o ConnectTimeout=10 -o BatchMode=yes "$SERVER" "echo ok" > /dev/null 2>&1 || {
  echo -e "${RED}ERROR: Cannot connect to server. Is ssh-agent running?${NC}"
  echo "  Run in Git Bash:"
  echo "    export SSH_AUTH_SOCK=/tmp/tim-agent.sock"
  echo "    ssh-add C:/Users/USER1/.ssh/hetzner_ed25519"
  exit 1
}

# Check required env vars on server
MISSING=$(ssh "$SERVER" "
  cd $SERVER_WEB 2>/dev/null || exit 1
  for var in $REQUIRED_VARS; do
    grep -q \"^\${var}=\" .env.local 2>/dev/null || echo \"\$var\"
  done
")

if [ -n "$MISSING" ]; then
  echo -e "${RED}ERROR: Missing env vars in server .env.local:${NC}"
  echo "$MISSING" | while read var; do echo "  - $var"; done
  exit 1
fi
echo -e "  ${GREEN}Server environment OK${NC}"

# ─── Step 4: Build on Server ────────────────────────────────────────────────

echo ""
echo -e "${YELLOW}[4/5] Building on server (this takes ~30-60s)...${NC}"

ssh "$SERVER" bash -s <<'REMOTE_SCRIPT'
set -e

cd /opt/agent-tim

# Pull latest code
echo "  Pulling latest code..."
BEFORE_LOCK=$(md5sum web/package-lock.json 2>/dev/null | cut -d' ' -f1)
git fetch origin master
git reset --hard origin/master
AFTER_LOCK=$(md5sum web/package-lock.json 2>/dev/null | cut -d' ' -f1)

cd web

# Always run npm ci — git reset --hard can corrupt node_modules
echo "  Installing dependencies..."
npm ci

# Clear stale build lock if present
rm -f .next/lock

# Build
echo "  Building Next.js (standalone)..."
npm run build

# Copy static assets into standalone folder (required by standalone mode)
echo "  Copying static assets..."
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static

# Copy env file into standalone (standalone server reads from its own dir)
cp .env.local .next/standalone/.env.local 2>/dev/null || true

# Restart PM2 — delete and re-create to ensure correct cwd and script
echo "  Restarting PM2..."
pm2 delete command-central 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save

echo "  Waiting for server to start..."
sleep 5

# Health check
if curl -sf http://localhost:3001 > /dev/null 2>&1; then
  echo "  ✓ Health check passed"
else
  echo "  ✗ Health check FAILED"
  echo ""
  echo "  Recent logs:"
  pm2 logs command-central --lines 20 --nostream
  exit 1
fi
REMOTE_SCRIPT

# ─── Step 5: Done ───────────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}[5/5] Deploy complete!${NC}"
echo ""
echo "  Site: https://stratt-central.b2bcontentartist.com"
echo ""

# Show recent logs
echo "Recent server logs:"
ssh "$SERVER" "pm2 logs command-central --lines 5 --nostream" 2>/dev/null || true
echo ""

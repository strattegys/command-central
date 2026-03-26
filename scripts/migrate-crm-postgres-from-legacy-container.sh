#!/usr/bin/env bash
# One-time cutover: copy the CRM database from a legacy Postgres container (e.g. old Twenty
# stack: twenty-db-1) into Command Central's compose service `crm-db`.
#
# Run on the Command Central droplet as root from the repo:
#   cd /opt/agent-tim && git pull && bash scripts/migrate-crm-postgres-from-legacy-container.sh
#
# Optional: pass the source container name (default: twenty-db-1):
#   bash scripts/migrate-crm-postgres-from-legacy-container.sh my-old-postgres
#
# Before first production deploy of embedded crm-db, or right after if the new volume is still empty:
#   1) Prefer stopping web briefly to avoid dual-writes:  docker compose --env-file web/.env.local -f docker-compose.yml stop web
#   2) Run this script.
#   3) Full stack:  docker compose --env-file web/.env.local -f docker-compose.yml up -d
#
# Requires: web/.env.local with CRM_DB_PASSWORD (and matching CRM_DB_NAME default "default").

set -euo pipefail

LEGACY="${1:-twenty-db-1}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [[ ! -f web/.env.local ]]; then
  echo "ERROR: web/.env.local missing."
  exit 1
fi

if ! docker ps -q -f "name=${LEGACY}" | grep -q .; then
  echo "ERROR: No running container matching name '${LEGACY}'."
  echo "Start the legacy Postgres container or pass its exact name as the first argument."
  exit 1
fi

# Resolve exact container id (docker ps name filter is substring — take first match).
SRC="$(docker ps -q -f "name=${LEGACY}" | head -1)"
echo "Source container: $SRC ($LEGACY)"

DUMP="$(mktemp /tmp/crm-migrate-XXXXXX.dump)"
cleanup() { rm -f "$DUMP"; }
trap cleanup EXIT

echo "Dumping database 'default' (custom format)..."
docker exec "$SRC" pg_dump -U postgres -Fc default >"$DUMP"
echo "Dump size: $(du -h "$DUMP" | cut -f1)"

echo "Starting crm-db (if needed)..."
docker compose --env-file web/.env.local -f docker-compose.yml up -d crm-db

echo "Waiting for Postgres to accept connections..."
for _ in $(seq 1 60); do
  if docker compose --env-file web/.env.local -f docker-compose.yml exec -T crm-db \
    pg_isready -U postgres -d default >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! docker compose --env-file web/.env.local -f docker-compose.yml exec -T crm-db \
  pg_isready -U postgres -d default >/dev/null 2>&1; then
  echo "ERROR: crm-db did not become ready in time."
  exit 1
fi

echo "Restoring into crm-db (this may print harmless errors for objects that do not exist)..."
docker compose --env-file web/.env.local -f docker-compose.yml exec -T crm-db \
  pg_restore -U postgres -d default --clean --if-exists --no-owner --role=postgres <"$DUMP" || {
  echo "WARN: pg_restore exited non-zero — check output above. If the DB was empty, a second run may be needed."
}

echo ""
echo "Done. Bring the app up if it was stopped:"
echo "  docker compose --env-file web/.env.local -f docker-compose.yml up -d"
echo "Status rail Data platform should show OK once web is healthy."

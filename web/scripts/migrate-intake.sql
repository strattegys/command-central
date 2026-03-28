-- Migration: _intake table for Suzi Intake tab (captures from UI, chat, share, email webhook)
-- Run (from COMMAND-CENTRAL): cat web/scripts/migrate-intake.sql | docker compose --env-file web/.env.local -f docker-compose.yml exec -T crm-db psql -U postgres -d default

SET search_path TO "workspace_9rc10n79wgdr0r3z6mzti24f6";

CREATE TABLE IF NOT EXISTS "_intake" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "agentId" TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT,
  body TEXT,
  source TEXT NOT NULL CHECK (source IN ('ui', 'agent', 'share', 'email')),
  meta JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_intake_agent
  ON "_intake" ("agentId")
  WHERE "deletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS idx_intake_agent_updated
  ON "_intake" ("agentId", "updatedAt" DESC)
  WHERE "deletedAt" IS NULL;

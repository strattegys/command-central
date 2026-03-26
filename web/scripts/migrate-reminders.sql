-- Migration: Create _reminder table for structured reminders system
-- Run (repo root): cat web/scripts/migrate-reminders.sql | docker compose --env-file web/.env.local -f docker-compose.yml exec -T crm-db psql -U postgres -d default

SET search_path TO "workspace_9rc10n79wgdr0r3z6mzti24f6";

CREATE TABLE IF NOT EXISTS "_reminder" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "agentId" TEXT NOT NULL DEFAULT 'suzi',
  category TEXT NOT NULL CHECK (category IN ('birthday', 'holiday', 'recurring', 'one-time', 'fact')),
  title TEXT NOT NULL,
  description TEXT,
  "nextDueAt" TIMESTAMPTZ,
  recurrence TEXT CHECK (recurrence IS NULL OR recurrence IN ('yearly', 'monthly', 'weekly', 'daily')),
  "recurrenceAnchor" JSONB,
  "advanceNoticeDays" INT NOT NULL DEFAULT 0,
  "lastDeliveredAt" TIMESTAMPTZ,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_reminder_next_due
  ON "_reminder" ("nextDueAt")
  WHERE "deletedAt" IS NULL AND "isActive" = TRUE;

CREATE INDEX IF NOT EXISTS idx_reminder_category
  ON "_reminder" (category)
  WHERE "deletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS idx_reminder_agent
  ON "_reminder" ("agentId")
  WHERE "deletedAt" IS NULL;

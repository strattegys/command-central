-- Migration: Create _note table for standalone Notes feature
-- Run: cat migrate-notes.sql | docker exec -i twenty-db-1 psql -U postgres -d default

SET search_path TO "workspace_9rc10n79wgdr0r3z6mzti24f6";

-- Sequential note numbers (starting at 5001 to avoid overlap with punch list)
CREATE SEQUENCE IF NOT EXISTS note_number_seq START WITH 5001;

CREATE TABLE IF NOT EXISTS "_note" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "noteNumber" INTEGER UNIQUE DEFAULT nextval('note_number_seq'),
  "agentId" TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  tag TEXT,
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_note_agent
  ON "_note" ("agentId")
  WHERE "deletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS idx_note_agent_tag
  ON "_note" ("agentId", tag)
  WHERE "deletedAt" IS NULL;

-- Migrate existing "note" category reminders into the new table
INSERT INTO "_note" ("agentId", title, content, "createdAt", "updatedAt")
SELECT "agentId", title, description, "createdAt", "updatedAt"
FROM "_reminder"
WHERE category = 'note' AND "deletedAt" IS NULL;

-- Soft-delete migrated reminders
UPDATE "_reminder" SET "deletedAt" = NOW()
WHERE category = 'note' AND "deletedAt" IS NULL;

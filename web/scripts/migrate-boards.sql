-- Migration: Create _board table and link campaigns to boards
-- Run (repo root): docker compose --env-file web/.env.local -f docker-compose.yml exec -T crm-db psql -U postgres -d default -f - < web/scripts/migrate-boards.sql

SET search_path TO "workspace_9rc10n79wgdr0r3z6mzti24f6";

-- 1. Create _board table
CREATE TABLE IF NOT EXISTS "_board" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"        text NOT NULL,
  "description" text,
  "stages"      jsonb NOT NULL,
  "transitions" jsonb NOT NULL,
  "createdAt"   timestamp with time zone NOT NULL DEFAULT now(),
  "updatedAt"   timestamp with time zone NOT NULL DEFAULT now(),
  "deletedAt"   timestamp with time zone
);

-- 2. Seed default LinkedIn Outreach Pipeline board (idempotent)
INSERT INTO "_board" ("id", "name", "description", "stages", "transitions")
SELECT
  'b0000000-0000-4000-a000-000000000001',
  'LinkedIn Outreach Pipeline',
  'Standard LinkedIn outreach funnel: target, initiate, accept, message, engage, prospect, convert.',
  '[
    {"key": "TARGET",    "label": "Target",    "color": "#6b8a9e"},
    {"key": "INITIATED", "label": "Initiated", "color": "#2b5278"},
    {"key": "ACCEPTED",  "label": "Accepted",  "color": "#534AB7"},
    {"key": "MESSAGED",  "label": "Messaged",  "color": "#7c5bbf"},
    {"key": "ENGAGED",   "label": "Engaged",   "color": "#1D9E75"},
    {"key": "PROSPECT",  "label": "Prospect",  "color": "#D85A30"},
    {"key": "CONVERTED", "label": "Converted", "color": "#22c55e"}
  ]'::jsonb,
  '{
    "TARGET":    ["INITIATED"],
    "INITIATED": ["ACCEPTED", "TARGET"],
    "ACCEPTED":  ["MESSAGED", "TARGET"],
    "MESSAGED":  ["ENGAGED", "ACCEPTED"],
    "ENGAGED":   ["PROSPECT", "MESSAGED"],
    "PROSPECT":  ["CONVERTED", "ENGAGED"],
    "CONVERTED": []
  }'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM "_board" WHERE "id" = 'b0000000-0000-4000-a000-000000000001'
);

-- 3. Add boardId column to _campaign (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'workspace_9rc10n79wgdr0r3z6mzti24f6'
      AND table_name = '_campaign'
      AND column_name = 'boardId'
  ) THEN
    ALTER TABLE "_campaign" ADD COLUMN "boardId" uuid REFERENCES "_board"("id");
  END IF;
END $$;

-- 4. Set all existing campaigns to the default board (if not already set)
UPDATE "_campaign"
SET "boardId" = 'b0000000-0000-4000-a000-000000000001'
WHERE "boardId" IS NULL AND "deletedAt" IS NULL;

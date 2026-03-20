-- Migration: Campaign → Workflow + Polymorphic Workflow Items
-- Run: docker exec -i twenty-db-1 psql -U postgres -d default < web/scripts/migrate-workflows.sql

SET search_path TO "workspace_9rc10n79wgdr0r3z6mzti24f6";

-- 1. Rename _campaign → _workflow
ALTER TABLE IF EXISTS "_campaign" RENAME TO "_workflow";

-- 2. Add itemType column to _workflow
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'workspace_9rc10n79wgdr0r3z6mzti24f6'
      AND table_name = '_workflow'
      AND column_name = 'itemType'
  ) THEN
    ALTER TABLE "_workflow" ADD COLUMN "itemType" text NOT NULL DEFAULT 'person';
  END IF;
END $$;

-- 3. Create _workflow_item join table
CREATE TABLE IF NOT EXISTS "_workflow_item" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workflowId"  uuid NOT NULL REFERENCES "_workflow"("id"),
  "stage"       text NOT NULL,
  "sourceType"  text NOT NULL,
  "sourceId"    uuid NOT NULL,
  "position"    int DEFAULT 0,
  "createdAt"   timestamp with time zone NOT NULL DEFAULT now(),
  "updatedAt"   timestamp with time zone NOT NULL DEFAULT now(),
  "deletedAt"   timestamp with time zone,
  UNIQUE("workflowId", "sourceType", "sourceId")
);

CREATE INDEX IF NOT EXISTS idx_workflow_item_workflow
  ON "_workflow_item"("workflowId") WHERE "deletedAt" IS NULL;
CREATE INDEX IF NOT EXISTS idx_workflow_item_source
  ON "_workflow_item"("sourceType", "sourceId") WHERE "deletedAt" IS NULL;

-- 4. Create _content_item table (for content workflows)
CREATE TABLE IF NOT EXISTS "_content_item" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "title"       text NOT NULL,
  "description" text,
  "url"         text,
  "contentType" text DEFAULT 'article',
  "publishDate" timestamp with time zone,
  "metadata"    jsonb DEFAULT '{}',
  "createdAt"   timestamp with time zone NOT NULL DEFAULT now(),
  "updatedAt"   timestamp with time zone NOT NULL DEFAULT now(),
  "deletedAt"   timestamp with time zone
);

-- 5. Migrate existing person→campaign data into _workflow_item
INSERT INTO "_workflow_item" ("workflowId", "stage", "sourceType", "sourceId")
SELECT p."activeCampaignId", COALESCE(p.stage::text, 'TARGET'), 'person', p.id
FROM person p
WHERE p."activeCampaignId" IS NOT NULL
  AND p."deletedAt" IS NULL
ON CONFLICT ("workflowId", "sourceType", "sourceId") DO NOTHING;

-- 6. Drop old person columns (no longer needed — stage lives in _workflow_item)
ALTER TABLE person DROP COLUMN IF EXISTS "activeCampaignId";
ALTER TABLE person DROP COLUMN IF EXISTS "stage";

SET search_path TO "workspace_9rc10n79wgdr0r3z6mzti24f6";

-- Package table
CREATE TABLE IF NOT EXISTS "_package" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "templateId"   text NOT NULL,
  "name"         text NOT NULL,
  "customerId"   uuid,
  "customerType" text DEFAULT 'person',
  "spec"         jsonb NOT NULL DEFAULT '{}',
  "stage"        text NOT NULL DEFAULT 'DRAFT',
  "createdBy"    text DEFAULT 'penny',
  "createdAt"    timestamp with time zone NOT NULL DEFAULT now(),
  "updatedAt"    timestamp with time zone NOT NULL DEFAULT now(),
  "deletedAt"    timestamp with time zone
);

CREATE INDEX IF NOT EXISTS idx_package_stage
  ON "_package"("stage") WHERE "deletedAt" IS NULL;
CREATE INDEX IF NOT EXISTS idx_package_customer
  ON "_package"("customerId") WHERE "deletedAt" IS NULL;

-- Add packageId column to _workflow (nullable, backward compatible)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '_workflow'
      AND column_name = 'packageId'
  ) THEN
    ALTER TABLE "_workflow" ADD COLUMN "packageId" uuid;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_workflow_package
  ON "_workflow"("packageId") WHERE "packageId" IS NOT NULL AND "deletedAt" IS NULL;

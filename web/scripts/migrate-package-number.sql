-- Human-friendly numeric id per package (e.g. "package #42" in chat).
-- Run from web/: npm run db:exec -- scripts/migrate-package-number.sql
-- Uses CRM_DB_SEARCH_PATH (see db-exec.mjs).

SET search_path TO "workspace_9rc10n79wgdr0r3z6mzti24f6";

ALTER TABLE "_package" ADD COLUMN IF NOT EXISTS "packageNumber" integer;

UPDATE "_package" p
SET "packageNumber" = n.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt" ASC) AS rn
  FROM "_package"
  WHERE "deletedAt" IS NULL
) n
WHERE p.id = n.id AND (p."packageNumber" IS NULL OR p."packageNumber" = 0);

CREATE SEQUENCE IF NOT EXISTS "_package_packageNumber_seq" AS integer;

SELECT setval(
  '"_package_packageNumber_seq"',
  GREATEST((SELECT COALESCE(MAX("packageNumber"), 0) FROM "_package"), 0),
  true
);

ALTER TABLE "_package"
  ALTER COLUMN "packageNumber" SET DEFAULT nextval('"_package_packageNumber_seq"');

ALTER SEQUENCE "_package_packageNumber_seq" OWNED BY "_package"."packageNumber";

CREATE UNIQUE INDEX IF NOT EXISTS idx_package_number_unique
  ON "_package" ("packageNumber")
  WHERE "deletedAt" IS NULL;

-- Add sortOrder column for drag-and-drop reordering within rank columns
ALTER TABLE "_punch_list" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER DEFAULT 0;

-- Initialize sortOrder based on current createdAt ordering within each rank
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY rank ORDER BY "createdAt" ASC) as rn
  FROM "_punch_list"
  WHERE "deletedAt" IS NULL
)
UPDATE "_punch_list" SET "sortOrder" = ranked.rn
FROM ranked WHERE "_punch_list".id = ranked.id;

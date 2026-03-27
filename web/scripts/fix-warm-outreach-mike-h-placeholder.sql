-- One-off: clear warm-outreach discovery placeholder job title on a specific contact.
-- If the problem is a **duplicate person** (CSV garbage names + same LinkedIn as the real Mike H.),
-- use **`fix-mike-h-warm-outreach-dup.sql`** instead (repoint `_workflow_item` + soft-delete dup).
-- Run against the **Twenty / CRM** Postgres (same DB as Command Central `DATABASE_URL` / `person` table).
--
-- 1) Inspect candidates (adjust ILIKE patterns if your row differs):
-- SELECT id, "nameFirstName", "nameLastName", "jobTitle", "companyId", "linkedinLinkPrimaryLinkUrl"
-- FROM person
-- WHERE "deletedAt" IS NULL
--   AND TRIM(COALESCE("jobTitle", '')) = 'Warm outreach — awaiting contact details'
--   AND TRIM(COALESCE("nameFirstName", '')) ILIKE 'Mike'
--   AND TRIM(COALESCE("nameLastName", '')) ILIKE 'H';

-- 2) Clear the placeholder title so the Tim header shows "—" until you set a real title in Twenty or re-run RESEARCHING with Unipile.
UPDATE person
SET
  "jobTitle" = NULL,
  "updatedAt" = NOW()
WHERE "deletedAt" IS NULL
  AND TRIM(COALESCE("jobTitle", '')) = 'Warm outreach — awaiting contact details'
  AND TRIM(COALESCE("nameFirstName", '')) ILIKE 'Mike'
  AND TRIM(COALESCE("nameLastName", '')) ILIKE 'H';

-- 3) Optional: link a company if you know the UUID:
-- UPDATE person SET "companyId" = 'YOUR-COMPANY-UUID'::uuid, "updatedAt" = NOW()
-- WHERE id = 'YOUR-PERSON-UUID'::uuid AND "deletedAt" IS NULL;

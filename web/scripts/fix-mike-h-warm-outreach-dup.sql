-- Mike H / micahgtm: workflow pointed at a duplicate person row created from a bad CSV
-- (garbage first/last names + placeholder jobTitle). Canonical person keeps correct title + LinkedIn.
--
-- 1) Repoint warm-outreach workflow item to canonical person.
-- 2) Soft-delete the duplicate person row.
-- 3) Match LinkedIn display name: last name "H." not "H".

BEGIN;

UPDATE "_workflow_item"
SET
  "sourceId" = '2e9a0129-98b2-412c-91cf-866b3739a60e'::uuid,
  "updatedAt" = NOW()
WHERE id = '6520247a-876b-4be1-91d0-fbc01ee02048'
  AND "deletedAt" IS NULL
  AND "sourceId" = '19c6e606-a85f-47f5-a18e-e3991b5f93f1'::uuid;

UPDATE person
SET
  "deletedAt" = NOW(),
  "updatedAt" = NOW()
WHERE id = '19c6e606-a85f-47f5-a18e-e3991b5f93f1'::uuid
  AND "deletedAt" IS NULL;

UPDATE person
SET
  "nameLastName" = 'H.',
  "updatedAt" = NOW()
WHERE id = '2e9a0129-98b2-412c-91cf-866b3739a60e'::uuid
  AND "deletedAt" IS NULL
  AND TRIM(COALESCE("nameFirstName", '')) ILIKE 'mike'
  AND TRIM(COALESCE("nameLastName", '')) = 'H';

COMMIT;

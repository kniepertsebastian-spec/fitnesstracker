-- Move waterTargetMlOverride from Profile to User: a custom water target should be settable
-- without first creating a full nutrition profile (see ROADMAP.md Phase 18).
ALTER TABLE "User" ADD COLUMN "waterTargetMlOverride" INTEGER;

-- Carry over any existing overrides before dropping the old column.
UPDATE "User" u
SET "waterTargetMlOverride" = p."waterTargetMlOverride"
FROM "Profile" p
WHERE p."userId" = u.id
  AND p."waterTargetMlOverride" IS NOT NULL;

ALTER TABLE "Profile" DROP COLUMN "waterTargetMlOverride";

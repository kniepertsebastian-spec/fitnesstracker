-- Per-reminder-type push opt-out (roadmap2.md P1.4). Default true preserves existing
-- subscribers' current behavior (get every reminder kind) until they explicitly opt out.
ALTER TABLE "User" ADD COLUMN "remindPhaseChange" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "remindSupplements" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "remindProgressPhoto" BOOLEAN NOT NULL DEFAULT true;

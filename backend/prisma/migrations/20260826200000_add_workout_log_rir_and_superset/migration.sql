-- RIR tracking (Phase 20) and superset/drop-set grouping (Phase 20).
ALTER TABLE "WorkoutLog" ADD COLUMN "rir" INTEGER;
ALTER TABLE "WorkoutLog" ADD COLUMN "supersetGroupId" TEXT;

CREATE INDEX "WorkoutLog_userId_supersetGroupId_idx" ON "WorkoutLog"("userId", "supersetGroupId");

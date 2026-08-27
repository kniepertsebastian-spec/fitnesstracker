-- The AI plan generator now produces a proper multi-day split (Push/Pull/Legs etc.) instead of
-- one flat list, so PlanExercise needs to record which split day an entry belongs to.
ALTER TABLE "PlanExercise" ADD COLUMN "dayLabel" TEXT;

DROP INDEX "PlanExercise_userId_phase_exerciseId_key";

-- Same exercise can now appear on different days within one phase (e.g. an accessory lift on
-- both a Push and a Pull day), just not twice on the same day.
CREATE UNIQUE INDEX "PlanExercise_userId_phase_exerciseId_dayLabel_key" ON "PlanExercise"("userId", "phase", "exerciseId", "dayLabel");

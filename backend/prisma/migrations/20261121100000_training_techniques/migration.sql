-- Intensity techniques, set schemes and per-set prescriptions on plan entries (plain text columns: the
-- allowed values live in packages/shared/src/trainingTechniques.ts).
ALTER TABLE "PlanExercise" ADD COLUMN "technique" TEXT;
ALTER TABLE "PlanExercise" ADD COLUMN "techniqueGroup" TEXT;
ALTER TABLE "PlanExercise" ADD COLUMN "setScheme" TEXT;
ALTER TABLE "PlanExercise" ADD COLUMN "setPlan" JSONB;

-- How a set was done, so records and the strength estimate can leave out partial reps and timed holds.
ALTER TABLE "WorkoutLog" ADD COLUMN "technique" TEXT;
ALTER TABLE "WorkoutLog" ADD COLUMN "durationSeconds" INTEGER;

-- Week-to-week pattern the AI chose for a drafted phase (LINEAR or WAVE).
ALTER TABLE "PlanSnapshot" ADD COLUMN "periodization" TEXT;

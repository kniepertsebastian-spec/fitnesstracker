-- Pausing the 8-week rotation clock and explicitly restarting the current phase.
ALTER TABLE "TrainingPlan" ADD COLUMN "pausedAt" TIMESTAMP(3);

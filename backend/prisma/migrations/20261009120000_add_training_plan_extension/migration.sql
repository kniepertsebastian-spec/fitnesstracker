-- "+1 Woche": extend the current phase beyond its 8 weeks; resets on rotation/restart.
ALTER TABLE "TrainingPlan" ADD COLUMN "extensionWeeks" INTEGER NOT NULL DEFAULT 0;

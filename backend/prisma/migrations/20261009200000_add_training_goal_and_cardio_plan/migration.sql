-- F9: training goal on the plan, per-day cardio plan overrides, idempotent offline cardio logs.
CREATE TYPE "TrainingGoal" AS ENUM ('MUSCLE_GAIN', 'STRENGTH', 'ENDURANCE', 'FAT_LOSS', 'GENERAL_FITNESS');

ALTER TABLE "TrainingPlan" ADD COLUMN "trainingGoal" "TrainingGoal";

ALTER TABLE "CardioLog" ADD COLUMN "clientId" TEXT;
CREATE UNIQUE INDEX "CardioLog_clientId_key" ON "CardioLog"("clientId");

CREATE TABLE "CardioPlanDay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phase" "TrainingPhase" NOT NULL,
    "dayLabel" TEXT NOT NULL DEFAULT '',
    "items" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardioPlanDay_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CardioPlanDay_userId_phase_dayLabel_key" ON "CardioPlanDay"("userId", "phase", "dayLabel");

ALTER TABLE "CardioPlanDay" ADD CONSTRAINT "CardioPlanDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

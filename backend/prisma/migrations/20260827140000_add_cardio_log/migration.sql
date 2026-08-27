-- Optional cardio tracking (Laufband/Fahrrad/Stepper/Stairmaster) alongside the strength plan.
CREATE TYPE "CardioMachine" AS ENUM ('TREADMILL', 'BIKE', 'STEPPER', 'STAIRMASTER');

CREATE TABLE "CardioLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "machine" "CardioMachine" NOT NULL,
    "level" INTEGER,
    "intensity" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CardioLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CardioLog_userId_performedAt_idx" ON "CardioLog"("userId", "performedAt");

ALTER TABLE "CardioLog" ADD CONSTRAINT "CardioLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

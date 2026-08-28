-- Session lifecycle (Start/Pause/Fortsetzen/Abbrechen/Abschließen) alongside WorkoutLog.
CREATE TYPE "WorkoutSessionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'ABORTED');

CREATE TABLE "WorkoutSession" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "WorkoutSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkoutSession_clientId_key" ON "WorkoutSession"("clientId");
CREATE INDEX "WorkoutSession_userId_status_idx" ON "WorkoutSession"("userId", "status");

ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

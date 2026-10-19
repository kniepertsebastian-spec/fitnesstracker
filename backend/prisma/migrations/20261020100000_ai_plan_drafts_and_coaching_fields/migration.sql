-- CreateEnum
CREATE TYPE "PlanSnapshotKind" AS ENUM ('DRAFT', 'BACKUP');

-- AlterTable
ALTER TABLE "PlanExercise" ADD COLUMN     "alternativeExerciseId" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "repRangeMax" INTEGER,
ADD COLUMN     "repRangeMin" INTEGER,
ADD COLUMN     "restSeconds" INTEGER,
ADD COLUMN     "startWeightKg" DECIMAL(6,2),
ADD COLUMN     "targetRir" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "aiPlanPreferences" JSONB;

-- CreateTable
CREATE TABLE "PlanSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phase" "TrainingPhase" NOT NULL,
    "kind" "PlanSnapshotKind" NOT NULL,
    "days" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "items" JSONB NOT NULL,
    "rationale" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanSnapshot_userId_phase_kind_key" ON "PlanSnapshot"("userId", "phase", "kind");

-- AddForeignKey
ALTER TABLE "PlanExercise" ADD CONSTRAINT "PlanExercise_alternativeExerciseId_fkey" FOREIGN KEY ("alternativeExerciseId") REFERENCES "Exercise"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanSnapshot" ADD CONSTRAINT "PlanSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

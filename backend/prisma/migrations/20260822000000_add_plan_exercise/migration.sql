-- CreateTable
CREATE TABLE "PlanExercise" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phase" "TrainingPhase" NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "targetSets" INTEGER,
    "targetReps" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanExercise_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanExercise_userId_phase_order_idx" ON "PlanExercise"("userId", "phase", "order");

-- CreateIndex
CREATE UNIQUE INDEX "PlanExercise_userId_phase_exerciseId_key" ON "PlanExercise"("userId", "phase", "exerciseId");

-- AddForeignKey
ALTER TABLE "PlanExercise" ADD CONSTRAINT "PlanExercise_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanExercise" ADD CONSTRAINT "PlanExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

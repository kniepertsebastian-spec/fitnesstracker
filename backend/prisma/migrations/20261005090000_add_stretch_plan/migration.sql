CREATE TABLE "StretchPlanItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phase" "TrainingPhase" NOT NULL,
    "dayLabel" TEXT NOT NULL DEFAULT '',
    "exerciseId" TEXT NOT NULL,
    "holdSeconds" INTEGER NOT NULL DEFAULT 30,
    "sets" INTEGER NOT NULL DEFAULT 1,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StretchPlanItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StretchPlanItem_userId_phase_order_idx" ON "StretchPlanItem"("userId", "phase", "order");

CREATE UNIQUE INDEX "StretchPlanItem_userId_phase_dayLabel_exerciseId_key" ON "StretchPlanItem"("userId", "phase", "dayLabel", "exerciseId");

ALTER TABLE "StretchPlanItem" ADD CONSTRAINT "StretchPlanItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StretchPlanItem" ADD CONSTRAINT "StretchPlanItem_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

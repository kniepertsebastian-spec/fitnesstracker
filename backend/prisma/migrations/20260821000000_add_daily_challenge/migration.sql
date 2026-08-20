-- CreateTable
CREATE TABLE "DailyChallengeItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "targetReps" INTEGER NOT NULL,
    "completedReps" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DailyChallengeItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyChallengeItem_userId_date_exerciseId_key" ON "DailyChallengeItem"("userId", "date", "exerciseId");

-- AddForeignKey
ALTER TABLE "DailyChallengeItem" ADD CONSTRAINT "DailyChallengeItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyChallengeItem" ADD CONSTRAINT "DailyChallengeItem_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

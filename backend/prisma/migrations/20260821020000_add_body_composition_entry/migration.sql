-- CreateTable
CREATE TABLE "BodyCompositionEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "weightKg" DECIMAL(5,2) NOT NULL,
    "bodyFatPercent" DECIMAL(4,1),
    "muscleMassKg" DECIMAL(5,2),
    "bodyWaterPercent" DECIMAL(4,1),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BodyCompositionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BodyCompositionEntry_userId_measuredAt_idx" ON "BodyCompositionEntry"("userId", "measuredAt");

-- AddForeignKey
ALTER TABLE "BodyCompositionEntry" ADD CONSTRAINT "BodyCompositionEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "BodyFatCalibration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "measuredOn" DATE NOT NULL,
    "referencePercent" DECIMAL(4,1) NOT NULL,
    "estimatePercent" DECIMAL(4,1) NOT NULL,
    "offsetPercent" DECIMAL(4,1) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BodyFatCalibration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BodyFatCalibration_userId_measuredOn_idx" ON "BodyFatCalibration"("userId", "measuredOn");

-- AddForeignKey
ALTER TABLE "BodyFatCalibration" ADD CONSTRAINT "BodyFatCalibration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "DataSource" AS ENUM ('MANUAL', 'IMPORT', 'FITBIT');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "firstName" TEXT,
ADD COLUMN "lastName" TEXT;

-- AlterTable
ALTER TABLE "CardioLog" ADD COLUMN "distanceKm" DECIMAL(6,2),
ADD COLUMN "source" "DataSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN "externalId" TEXT;

-- CreateTable
CREATE TABLE "ActivityDay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "steps" INTEGER NOT NULL,
    "distanceKm" DECIMAL(6,2) NOT NULL,
    "source" "DataSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityDay_userId_date_idx" ON "ActivityDay"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityDay_userId_date_key" ON "ActivityDay"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "CardioLog_userId_source_externalId_key" ON "CardioLog"("userId", "source", "externalId");

-- AddForeignKey
ALTER TABLE "ActivityDay" ADD CONSTRAINT "ActivityDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "DailyChallengeCategory" AS ENUM ('TECHNIQUE', 'PROGRESSION', 'VOLUME', 'CONSISTENCY', 'RECOVERY');

-- AlterTable
ALTER TABLE "DailyChallengeItem" ADD COLUMN     "category" "DailyChallengeCategory" NOT NULL DEFAULT 'CONSISTENCY',
ADD COLUMN     "rotationsUsed" INTEGER NOT NULL DEFAULT 0;

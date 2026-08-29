-- DropForeignKey
ALTER TABLE "WaterLog" DROP CONSTRAINT "WaterLog_userId_fkey";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "waterTargetMlOverride";

-- DropTable
DROP TABLE "WaterLog";

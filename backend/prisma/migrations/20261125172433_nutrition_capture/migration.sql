-- CreateEnum
CREATE TYPE "RecipeImportStatus" AS ENUM ('PREVIEW_PENDING', 'PREVIEW_READY', 'EXTRACT_PENDING', 'EXTRACTING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "RecipeImportSource" AS ENUM ('URL', 'PHOTO', 'TEXT', 'VIDEO');

-- CreateTable
CREATE TABLE "RecipeImport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "RecipeImportSource" NOT NULL,
    "status" "RecipeImportStatus" NOT NULL,
    "url" TEXT,
    "platform" TEXT,
    "title" TEXT,
    "sourceData" JSONB,
    "draft" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipeImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NutritionWeeklyDrop" (
    "id" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "position" INTEGER NOT NULL,
    "catalogKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "servings" DOUBLE PRECISION NOT NULL,
    "ingredients" JSONB NOT NULL,
    "steps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "kcal" DOUBLE PRECISION,
    "proteinG" DOUBLE PRECISION,
    "perServing" JSONB NOT NULL,
    "estimatedFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NutritionWeeklyDrop_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecipeImport_userId_createdAt_idx" ON "RecipeImport"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "NutritionWeeklyDrop_catalogKey_weekStart_idx" ON "NutritionWeeklyDrop"("catalogKey", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "NutritionWeeklyDrop_weekStart_position_key" ON "NutritionWeeklyDrop"("weekStart", "position");

-- AddForeignKey
ALTER TABLE "RecipeImport" ADD CONSTRAINT "RecipeImport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


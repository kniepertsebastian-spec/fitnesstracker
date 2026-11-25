-- Kalorientracker core tables (Roadmap 02). Only new tables, enums and indexes; existing
-- Fitnesstracker tables are untouched (the only links are new foreign keys to "User").

-- Trigram search on food names and brands (typo-tolerant). pg_trgm is a trusted extension,
-- so the database owner may create it.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateEnum
CREATE TYPE "FoodSource" AS ENUM ('USER', 'BLS', 'OFF');

-- CreateEnum
CREATE TYPE "NutrientBasis" AS ENUM ('PER_100G', 'PER_100ML');

-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK');

-- CreateTable
CREATE TABLE "Food" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "source" "FoodSource" NOT NULL,
    "sourceRef" TEXT,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "barcode" TEXT,
    "basis" "NutrientBasis" NOT NULL DEFAULT 'PER_100G',
    "densityGPerMl" DOUBLE PRECISION,
    "kcal" DOUBLE PRECISION,
    "proteinG" DOUBLE PRECISION,
    "carbsG" DOUBLE PRECISION,
    "fatG" DOUBLE PRECISION,
    "fiberG" DOUBLE PRECISION,
    "sugarG" DOUBLE PRECISION,
    "saturatedFatG" DOUBLE PRECISION,
    "saltG" DOUBLE PRECISION,
    "micronutrients" JSONB,
    "estimatedFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "clientUpdatedAt" TIMESTAMP(3),
    "fetchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Food_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodUnit" (
    "id" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,
    "userId" TEXT,
    "label" TEXT NOT NULL,
    "baseAmount" DOUBLE PRECISION NOT NULL,
    "clientUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FoodUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "servings" DOUBLE PRECISION,
    "finalWeightG" DOUBLE PRECISION,
    "note" TEXT,
    "totalRawWeightG" DOUBLE PRECISION NOT NULL,
    "totalKcal" DOUBLE PRECISION,
    "totalProteinG" DOUBLE PRECISION,
    "totalCarbsG" DOUBLE PRECISION,
    "totalFatG" DOUBLE PRECISION,
    "totalFiberG" DOUBLE PRECISION,
    "totalSugarG" DOUBLE PRECISION,
    "totalSaturatedFatG" DOUBLE PRECISION,
    "totalSaltG" DOUBLE PRECISION,
    "estimatedFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "clientUpdatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeIngredient" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "foodId" TEXT,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitLabel" TEXT NOT NULL,
    "baseAmount" DOUBLE PRECISION NOT NULL,
    "rawWeightG" DOUBLE PRECISION NOT NULL,
    "kcal" DOUBLE PRECISION,
    "proteinG" DOUBLE PRECISION,
    "carbsG" DOUBLE PRECISION,
    "fatG" DOUBLE PRECISION,
    "fiberG" DOUBLE PRECISION,
    "sugarG" DOUBLE PRECISION,
    "saturatedFatG" DOUBLE PRECISION,
    "saltG" DOUBLE PRECISION,
    "estimatedFields" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "RecipeIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "mealType" "MealType" NOT NULL,
    "eatenAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MealLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mealLogId" TEXT NOT NULL,
    "foodId" TEXT,
    "recipeId" TEXT,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitLabel" TEXT NOT NULL,
    "baseAmount" DOUBLE PRECISION NOT NULL,
    "grams" DOUBLE PRECISION,
    "kcal" DOUBLE PRECISION,
    "proteinG" DOUBLE PRECISION,
    "carbsG" DOUBLE PRECISION,
    "fatG" DOUBLE PRECISION,
    "fiberG" DOUBLE PRECISION,
    "sugarG" DOUBLE PRECISION,
    "saturatedFatG" DOUBLE PRECISION,
    "saltG" DOUBLE PRECISION,
    "estimatedFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MealEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyNutritionRating" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "score" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DailyNutritionRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NutritionSettings" (
    "userId" TEXT NOT NULL,
    "fatPercentOfRemaining" INTEGER NOT NULL DEFAULT 40,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NutritionSettings_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "Food_userId_updatedAt_idx" ON "Food"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "Food_barcode_idx" ON "Food"("barcode");

-- CreateIndex
CREATE INDEX "Food_name_trgm_idx" ON "Food" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Food_brand_trgm_idx" ON "Food" USING GIN ("brand" gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "Food_source_sourceRef_key" ON "Food"("source", "sourceRef");

-- CreateIndex
CREATE INDEX "FoodUnit_foodId_idx" ON "FoodUnit"("foodId");

-- CreateIndex
CREATE INDEX "FoodUnit_userId_updatedAt_idx" ON "FoodUnit"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "Recipe_userId_updatedAt_idx" ON "Recipe"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "RecipeIngredient_recipeId_idx" ON "RecipeIngredient"("recipeId");

-- CreateIndex
CREATE INDEX "RecipeIngredient_foodId_idx" ON "RecipeIngredient"("foodId");

-- CreateIndex
CREATE INDEX "MealLog_userId_date_idx" ON "MealLog"("userId", "date");

-- CreateIndex
CREATE INDEX "MealLog_userId_updatedAt_idx" ON "MealLog"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "MealEntry_mealLogId_idx" ON "MealEntry"("mealLogId");

-- CreateIndex
CREATE INDEX "MealEntry_userId_updatedAt_idx" ON "MealEntry"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "DailyNutritionRating_userId_date_idx" ON "DailyNutritionRating"("userId", "date");

-- CreateIndex
CREATE INDEX "DailyNutritionRating_userId_updatedAt_idx" ON "DailyNutritionRating"("userId", "updatedAt");

-- AddForeignKey
ALTER TABLE "Food" ADD CONSTRAINT "Food_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodUnit" ADD CONSTRAINT "FoodUnit_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodUnit" ADD CONSTRAINT "FoodUnit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealLog" ADD CONSTRAINT "MealLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealEntry" ADD CONSTRAINT "MealEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealEntry" ADD CONSTRAINT "MealEntry_mealLogId_fkey" FOREIGN KEY ("mealLogId") REFERENCES "MealLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealEntry" ADD CONSTRAINT "MealEntry_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealEntry" ADD CONSTRAINT "MealEntry_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyNutritionRating" ADD CONSTRAINT "DailyNutritionRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NutritionSettings" ADD CONSTRAINT "NutritionSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

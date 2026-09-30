ALTER TABLE "TrainingPlan"
ADD COLUMN "remarks" TEXT,
ADD COLUMN "detectedAsymmetries" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "asymmetryAnalyzedAt" TIMESTAMP(3);

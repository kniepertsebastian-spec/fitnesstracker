-- AlterTable
ALTER TABLE "Supplement" ADD COLUMN IF NOT EXISTS "aiAnalysis" JSONB;

-- CreateTable
CREATE TABLE IF NOT EXISTS "SupplementKnowledgeCache" (
    "id" TEXT NOT NULL,
    "canonicalKey" TEXT NOT NULL,
    "displayNameDe" TEXT NOT NULL,
    "evidenceTier" TEXT NOT NULL,
    "generalEvidenceSummary" TEXT NOT NULL,
    "standardDosageRule" TEXT NOT NULL,
    "optimalTimingRule" TEXT NOT NULL,
    "defaultReminderTime" TEXT NOT NULL,
    "cautions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplementKnowledgeCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SupplementKnowledgeCache_canonicalKey_key" ON "SupplementKnowledgeCache"("canonicalKey");

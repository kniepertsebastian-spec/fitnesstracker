CREATE TABLE "BodyAnalysis" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceName" TEXT,
    "ocrText" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "metrics" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BodyAnalysis_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BodyAnalysis_userId_measuredAt_idx" ON "BodyAnalysis"("userId", "measuredAt");

ALTER TABLE "BodyAnalysis" ADD CONSTRAINT "BodyAnalysis_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

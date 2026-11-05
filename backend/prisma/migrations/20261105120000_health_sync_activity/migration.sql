-- CreateTable
CREATE TABLE "DailyActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "steps" INTEGER NOT NULL,
    "distanceMeters" DOUBLE PRECISION,
    "sequence" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'health_connect',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CyclingSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "distanceMeters" DOUBLE PRECISION,
    "title" VARCHAR(200),
    "source" TEXT NOT NULL DEFAULT 'health_connect',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CyclingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthSyncToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "lastSequence" INTEGER,

    CONSTRAINT "HealthSyncToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyActivity_userId_date_key" ON "DailyActivity"("userId", "date");

-- CreateIndex
CREATE INDEX "CyclingSession_userId_startedAt_idx" ON "CyclingSession"("userId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CyclingSession_userId_externalId_key" ON "CyclingSession"("userId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "HealthSyncToken_userId_key" ON "HealthSyncToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "HealthSyncToken_tokenHash_key" ON "HealthSyncToken"("tokenHash");

-- AddForeignKey
ALTER TABLE "DailyActivity" ADD CONSTRAINT "DailyActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CyclingSession" ADD CONSTRAINT "CyclingSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthSyncToken" ADD CONSTRAINT "HealthSyncToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


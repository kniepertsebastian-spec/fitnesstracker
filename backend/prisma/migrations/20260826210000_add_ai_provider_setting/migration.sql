-- Phase 19: BYOK AI training plan generator.
CREATE TYPE "AiProvider" AS ENUM ('GEMINI', 'OPENAI', 'GROQ', 'OPENROUTER');

CREATE TABLE "AiProviderSetting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "AiProvider" NOT NULL,
    "encryptedApiKey" TEXT NOT NULL,
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiProviderSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiProviderSetting_userId_key" ON "AiProviderSetting"("userId");

ALTER TABLE "AiProviderSetting" ADD CONSTRAINT "AiProviderSetting_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

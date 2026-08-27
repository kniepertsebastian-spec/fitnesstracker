import type { PrismaClient } from "@prisma/client";
import type { AiSettingsDto, SaveAiSettingsInput } from "@fitnesstracker/shared";
import { env } from "../../config/env.js";
import { encryptSecret } from "../../lib/crypto.js";
import { ConflictError } from "../../errors/httpErrors.js";

export function isAiSettingsConfigured(): boolean {
  return env.AI_SETTINGS_ENCRYPTION_KEY.length > 0;
}

export async function getAiSettings(prisma: PrismaClient, userId: string): Promise<AiSettingsDto> {
  const setting = await prisma.aiProviderSetting.findUnique({ where: { userId } });
  return {
    provider: setting?.provider ?? null,
    hasApiKey: setting !== null,
    model: setting?.model ?? null,
    configured: isAiSettingsConfigured(),
  };
}

export async function saveAiSettings(
  prisma: PrismaClient,
  userId: string,
  input: SaveAiSettingsInput,
): Promise<void> {
  if (!isAiSettingsConfigured()) {
    throw new ConflictError("Der Server hat noch keinen AI_SETTINGS_ENCRYPTION_KEY konfiguriert");
  }
  const encryptedApiKey = encryptSecret(input.apiKey, env.AI_SETTINGS_ENCRYPTION_KEY);
  await prisma.aiProviderSetting.upsert({
    where: { userId },
    update: { provider: input.provider, encryptedApiKey, model: input.model ?? null },
    create: { userId, provider: input.provider, encryptedApiKey, model: input.model ?? null },
  });
}

export async function deleteAiSettings(prisma: PrismaClient, userId: string): Promise<void> {
  await prisma.aiProviderSetting.deleteMany({ where: { userId } });
}

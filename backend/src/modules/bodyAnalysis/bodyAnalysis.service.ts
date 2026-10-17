import { spawn } from "node:child_process";
import sharp from "sharp";
import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { decryptSecret } from "../../lib/crypto.js";
import { env } from "../../config/env.js";
import { ConflictError, HttpError } from "../../errors/httpErrors.js";
import { callChatCompletion, AiProviderError } from "../aiPlanGenerator/aiClient.js";

const metricSchema = z.object({
  key: z.string().min(1).max(80),
  label: z.string().min(1).max(100),
  value: z.number().finite(),
  unit: z.string().max(30),
  explanation: z.string().min(1).max(1200),
  assessment: z.string().min(1).max(1200),
  confidence: z.enum(["high", "medium", "low"]),
});
const analysisSchema = z.object({
  summary: z.string().min(1).max(3000),
  metrics: z.array(metricSchema).min(1).max(40),
});
export type BodyAnalysisMetric = z.infer<typeof metricSchema>;
export type BodyAnalysisResult = z.infer<typeof analysisSchema> & {
  measuredAt: string;
  ocrText: string;
  sourceName: string;
};

function runTesseract(image: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("tesseract", ["stdin", "stdout", "-l", "deu+eng", "--psm", "6"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (error) => {
      reject(new ConflictError("Lokale Texterkennung ist auf dem Server nicht verfügbar. Bitte Tesseract installieren oder das Docker-Image aktualisieren."));
    });
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new ConflictError(`Die lokale Texterkennung ist fehlgeschlagen: ${Buffer.concat(stderr).toString("utf8").slice(0, 200)}`));
        return;
      }
      resolve(Buffer.concat(stdout).toString("utf8").trim());
    });
    child.stdin.on("error", () => undefined);
    child.stdin.end(image);
  });
}

export async function analyzeBodyImage(
  prisma: PrismaClient,
  userId: string,
  filename: string,
  mimeType: string,
  input: Buffer,
): Promise<BodyAnalysisResult> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
    throw new ConflictError("Bitte eine JPG-, PNG- oder WebP-Datei hochladen.");
  }
  if (input.length > 10 * 1024 * 1024) throw new ConflictError("Das Bild darf maximal 10 MB groß sein.");

  let prepared: Buffer;
  try {
    prepared = await sharp(input).rotate().resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true }).grayscale().normalize().png().toBuffer();
  } catch {
    throw new ConflictError("Das Bild konnte nicht gelesen werden. Bitte lade einen Screenshot oder ein Foto erneut hoch.");
  }
  const ocrText = await runTesseract(prepared);
  if (ocrText.length < 8) {
    throw new ConflictError("Auf dem Bild wurden zu wenige lesbare Angaben erkannt. Bitte lade ein schärferes Bild hoch.");
  }

  const setting = await prisma.aiProviderSetting.findUnique({ where: { userId } });
  if (!setting) throw new ConflictError("Bitte zuerst unter Einstellungen einen KI-Anbieter und API-Key hinterlegen.");
  if (!env.AI_SETTINGS_ENCRYPTION_KEY) {
    throw new ConflictError("Der Server hat noch keinen AI_SETTINGS_ENCRYPTION_KEY konfiguriert.");
  }
  const apiKey = decryptSecret(setting.encryptedApiKey, env.AI_SETTINGS_ENCRYPTION_KEY);
  const prompt = `Du interpretierst einen Körperzusammensetzungs-/Fitnessanalysebericht vorsichtig und auf Deutsch.
Die lokale OCR hat folgenden Text erkannt. Erfinde niemals fehlende Zahlen, Einheiten oder Werte. Nimm nur
konkret erkannte Körpermesswerte auf. Verwende eindeutige keys wie weightKg, bodyFatPercent,
muscleMassKg, bodyWaterPercent, bmi, visceralFat, boneMassKg, basalMetabolicRateKcal oder einen
kurzen englischen camelCase-key für andere tatsächlich erkannte Werte. Werte müssen numerisch sein.
Für jeden Messwert gib eine verständliche Erklärung und eine vorsichtige Einordnung ohne Diagnose.
Orientierungsbereiche sind abhängig von Alter, Geschlecht, Messgerät und Kontext; behaupte keine
medizinische Sicherheit. Wenn sich ein Wert nicht zuverlässig erkennen lässt, lasse ihn weg.
confidence: high, medium oder low. Gib ausschließlich JSON in diesem Format zurück:
{"summary":"Gesamtüberblick mit klaren Einschränkungen","metrics":[{"key":"weightKg","label":"Gewicht","value":82.4,"unit":"kg","explanation":"...","assessment":"...","confidence":"high"}]}
OCR-TEXT:
${ocrText.slice(0, 12000)}`;

  const raw = await callChatCompletion(
    setting.provider,
    apiKey,
    setting.model,
    [
      { role: "system", content: "Du bist ein vorsichtiger Assistent für Fitnessmesswerte. Keine Diagnosen, keine erfundenen Werte. Antworte ausschließlich mit gültigem JSON." },
      { role: "user", content: prompt },
    ],
  );
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AiProviderError("Die KI hat kein gültiges JSON für die Körperanalyse zurückgegeben.");
  }
  const result = analysisSchema.safeParse(parsed);
  if (!result.success) throw new AiProviderError("Die KI-Auswertung war unvollständig. Bitte versuche es erneut.");
  return {
    ...result.data,
    measuredAt: new Date().toISOString(),
    ocrText: ocrText.slice(0, 12000),
    sourceName: filename.slice(0, 255),
  };
}

const saveSchema = z.object({
  measuredAt: z.string().datetime(),
  sourceName: z.string().max(255).optional(),
  ocrText: z.string().max(12000).default(""),
  summary: z.string().min(1).max(3000),
  metrics: z.array(metricSchema).min(1).max(40),
});
export type SaveBodyAnalysisInput = z.infer<typeof saveSchema>;

export async function saveBodyAnalysis(prisma: PrismaClient, userId: string, rawInput: unknown) {
  const input = saveSchema.parse(rawInput);
  const metrics = input.metrics as Prisma.InputJsonValue;
  return prisma.$transaction(async (tx) => {
    const analysis = await tx.bodyAnalysis.create({
      data: {
        userId,
        measuredAt: new Date(input.measuredAt),
        sourceName: input.sourceName,
        ocrText: input.ocrText,
        summary: input.summary,
        metrics,
      },
    });
    const value = (key: string) => input.metrics.find((item) => item.key === key)?.value;
    const weightKg = value("weightKg");
    if (weightKg !== undefined && weightKg > 0 && weightKg <= 500) {
      const bodyFatPercent = value("bodyFatPercent");
      const muscleMassKg = value("muscleMassKg");
      const bodyWaterPercent = value("bodyWaterPercent");
      await tx.bodyCompositionEntry.create({
        data: {
          userId,
          measuredAt: new Date(input.measuredAt),
          weightKg,
          bodyFatPercent: bodyFatPercent !== undefined && bodyFatPercent >= 0 && bodyFatPercent <= 100 ? bodyFatPercent : undefined,
          muscleMassKg: muscleMassKg !== undefined && muscleMassKg > 0 && muscleMassKg <= 500 ? muscleMassKg : undefined,
          bodyWaterPercent: bodyWaterPercent !== undefined && bodyWaterPercent >= 0 && bodyWaterPercent <= 100 ? bodyWaterPercent : undefined,
        },
      });
    }
    return analysis;
  });
}

export async function listBodyAnalyses(prisma: PrismaClient, userId: string) {
  return prisma.bodyAnalysis.findMany({
    where: { userId },
    orderBy: [{ measuredAt: "desc" }, { createdAt: "desc" }],
    take: 100,
  });
}

export function toBodyAnalysisDto(analysis: {
  id: string; measuredAt: Date; sourceName: string | null; summary: string; ocrText: string; metrics: Prisma.JsonValue; createdAt: Date;
}) {
  return {
    id: analysis.id,
    measuredAt: analysis.measuredAt.toISOString(),
    sourceName: analysis.sourceName,
    summary: analysis.summary,
    ocrText: analysis.ocrText,
    metrics: analysis.metrics,
    createdAt: analysis.createdAt.toISOString(),
  };
}

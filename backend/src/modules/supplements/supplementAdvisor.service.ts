import type { PrismaClient } from "@prisma/client";
import { GoogleGenAI, Type } from "@google/genai";
import {
  supplementAnalysisSchema,
  TRAINING_GOAL_LABELS,
  type AnalyzeSupplementInput,
  type SupplementAnalysisDto,
} from "@fitnesstracker/shared";
import { env } from "../../config/env.js";
import { decryptSecret } from "../../lib/crypto.js";
import { ConflictError } from "../../errors/httpErrors.js";
import { AiProviderError, callChatCompletion } from "../aiPlanGenerator/aiClient.js";
import { calculateNutrition } from "../profile/profile.service.js";
import { estimateWeeklyFrequency } from "../aiPlanGenerator/promptBuilder.js";
import { getPhaseLabel, resolvePhaseConfigs } from "../trainingPlan/trainingPlan.types.js";

const geminiSupplementSchema = {
  type: Type.OBJECT,
  properties: {
    canonicalName: { type: Type.STRING },
    displayNameDe: { type: Type.STRING },
    verdict: { type: Type.STRING, enum: ["ESSENTIAL", "USEFUL", "SITUATIONAL", "NOT_RECOMMENDED"] },
    evidenceTier: { type: Type.STRING, enum: ["A", "B", "C", "D"] },
    goalFitScore: { type: Type.INTEGER },
    generalEvidenceSummary: { type: Type.STRING },
    personalizedRecommendation: { type: Type.STRING },
    recommendedDosage: { type: Type.STRING },
    optimalTiming: { type: Type.STRING },
    suggestedReminderTime: { type: Type.STRING },
    stackWarnings: { type: Type.ARRAY, items: { type: Type.STRING } },
    sideEffectsOrCautions: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: [
    "canonicalName",
    "displayNameDe",
    "verdict",
    "evidenceTier",
    "goalFitScore",
    "generalEvidenceSummary",
    "personalizedRecommendation",
    "recommendedDosage",
    "optimalTiming",
    "suggestedReminderTime",
    "stackWarnings",
    "sideEffectsOrCautions",
  ],
};

const modelResponseZodSchema = supplementAnalysisSchema.omit({ cachedEvidenceUsed: true });

export function normalizeSupplementKey(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

async function buildUserAdvisorContext(prisma: PrismaClient, userId: string): Promise<string> {
  const [profile, plan, supplements, goals, weeklyFreq] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.trainingPlan.findUnique({ where: { userId } }),
    prisma.supplement.findMany({ where: { userId }, orderBy: { reminderTime: "asc" } }),
    prisma.goal.findMany({
      where: { userId, achievedAt: null },
      include: { exercise: { select: { name: true, nameDe: true } } },
      take: 5,
    }),
    estimateWeeklyFrequency(prisma, userId),
  ]);

  const lines: string[] = [];

  if (profile) {
    const nutrition = calculateNutrition(profile);
    const goalMap = {
      CUT: "Fettabbau (Kaloriendefizit)",
      MAINTAIN: "Gewicht halten",
      BULK: "Muskelaufbau (Kalorienüberschuss)",
    };
    lines.push(
      `Athleten-Profil: ${Number(profile.weightKg)} kg, ${profile.heightCm} cm, ${profile.age} Jahre, Geschlecht: ${profile.gender}.`,
      `Ernährungsziel: ${goalMap[profile.goal]} (Ziel: ${nutrition.targetCalories} kcal, ${nutrition.targetProteinG} g Protein/Tag).`,
    );
  } else {
    lines.push(
      "Athleten-Profil: Noch keine Körperdaten hinterlegt (nutze 75 kg als Referenzwert und weise kurz darauf hin).",
    );
  }

  if (plan) {
    const configs = resolvePhaseConfigs(plan.phaseConfigs);
    const phaseLabel = getPhaseLabel(configs, plan.currentPhase);
    const goalLabel = plan.trainingGoal ? TRAINING_GOAL_LABELS[plan.trainingGoal] : "nicht explizit gewählt";
    lines.push(
      `Aktuelle 8-Wochen-Trainingsphase: ${phaseLabel} (${plan.currentPhase}). Primäres Trainingsziel: ${goalLabel}.`,
    );
    if (plan.remarks?.trim()) {
      lines.push(`Besonderheiten / Hinweise aus dem Trainingsplan: ${plan.remarks.trim()}`);
    }
  }

  lines.push(`Geschätzte Trainingsfrequenz: ca. ${weeklyFreq} Einheiten pro Woche.`);

  if (goals.length > 0) {
    const goalStrings = goals.map((g) => {
      const ex = g.exercise ? (g.exercise.nameDe ?? g.exercise.name) : g.type;
      return `${ex}: Ziel ${Number(g.targetValue)} (${g.type})`;
    });
    lines.push(`Aktive Leistungs-/Körperziele: ${goalStrings.join(", ")}.`);
  }

  if (supplements.length > 0) {
    const stack = supplements
      .map((s) => `${s.name} (${s.reminderTime} Uhr${s.enabled ? "" : ", pausiert"})`)
      .join(", ");
    lines.push(`Aktueller Supplement-Stack des Nutzers: ${stack}.`);
  } else {
    lines.push("Aktueller Supplement-Stack: Noch keine anderen Supplements eingetragen.");
  }

  return lines.join("\n");
}

export async function analyzeSupplementForUser(
  prisma: PrismaClient,
  userId: string,
  input: AnalyzeSupplementInput,
): Promise<SupplementAnalysisDto> {
  if (!env.AI_SETTINGS_ENCRYPTION_KEY) {
    throw new ConflictError("Der Server hat noch keinen AI_SETTINGS_ENCRYPTION_KEY konfiguriert");
  }
  const setting = await prisma.aiProviderSetting.findUnique({ where: { userId } });
  if (!setting) {
    throw new ConflictError(
      "Noch kein KI-Anbieter konfiguriert — bitte zuerst unter KI-Einstellungen einen API-Key hinterlegen.",
    );
  }
  const apiKey = decryptSecret(setting.encryptedApiKey, env.AI_SETTINGS_ENCRYPTION_KEY);

  const lookupKey = normalizeSupplementKey(input.name);
  const cachedKnowledge = !input.forceRefresh
    ? await prisma.supplementKnowledgeCache.findUnique({ where: { canonicalKey: lookupKey } })
    : null;

  const userContext = await buildUserAdvisorContext(prisma, userId);

  const systemPrompt = [
    "Du bist ein evidenzbasierter Sport- und Ernährungswissenschaftler (orientiert an ISSN-, Examine.com- und AIS-Klassifikationen).",
    "Bewerte das angefragte Supplement nüchtern, kritisch und wissenschaftlich fundiert für das konkrete Profil und Trainingsziel des Nutzers.",
    "Antworte AUSSCHLIESSLICH auf Deutsch als valides JSON-Objekt mit exakt diesen Feldern:",
    '- canonicalName: englischer, kleingeschriebener Standard-Wirkstoffname mit Unterstrichen (z.B. "creatine_monohydrate", "caffeine", "ashwagandha", "whey_protein")',
    '- displayNameDe: sauberer deutscher Name (z.B. "Kreatin Monohydrat")',
    '- verdict: "ESSENTIAL" | "USEFUL" | "SITUATIONAL" | "NOT_RECOMMENDED"',
    '- evidenceTier: "A" (starke Studienlage/AIS Gruppe A), "B" (solide/kontextabhängig), "C" (schwache/widersprüchliche Evidenz), "D" (wirkungslos/abzuraten)',
    "- goalFitScore: Ganzzahl 1 bis 10, wie sinnvoll das Supplement für GENAU diesen Nutzer in seiner aktuellen Trainingsphase und seinem Ernährungsziel ist.",
    "- generalEvidenceSummary: 2-3 Sätze zur allgemeinen wissenschaftlichen Studienlage (ohne Marketing-Mythen).",
    "- personalizedRecommendation: 2-3 Sätze direkt an den Nutzer ('Du...'), warum es in seiner aktuellen Phase und seinem Ziel sinnvoll oder überflüssig ist.",
    "- recommendedDosage: Exakte Dosierungsempfehlung in g/mg/IE, konkret umgerechnet auf das Körpergewicht des Nutzers.",
    "- optimalTiming: Wann und wie einnehmen (z.B. zu einer fetthaltigen Mahlzeit, 30-45 Min. vor dem Training, abends).",
    '- suggestedReminderTime: Beste Uhrzeit im Format "HH:MM" (z.B. "08:00", "16:30" oder "21:00"), passend zum bestehenden Stack.',
    "- stackWarnings: Array mit konkreten Hinweisen zu Überlappungen oder Timing-Konflikten mit dem bestehenden Supplement-Stack des Nutzers (z.B. doppeltes Kreatin im Pre-Workout, Zink/Magnesium-Konkurrenz). Leer, wenn keine Konflikte.",
    "- sideEffectsOrCautions: Array mit wichtigen Nebenwirkungen oder Kontraindikationen (max. 3 kurze Punkte).",
  ].join("\n");

  const cacheHint = cachedKnowledge
    ? [
        "\nBereits verifizierte Evidenz-Basis aus dem lokalen Cache (nutze diese als wissenschaftliche Grundlage und passe Dosierung/Score/Stack-Warnungen auf den Nutzer an):",
        `Wirkstoff: ${cachedKnowledge.displayNameDe} (Tier ${cachedKnowledge.evidenceTier})`,
        `Evidenz: ${cachedKnowledge.generalEvidenceSummary}`,
        `Dosierungsregel: ${cachedKnowledge.standardDosageRule}`,
        `Timing-Regel: ${cachedKnowledge.optimalTimingRule}`,
      ].join("\n")
    : "";

  const userPrompt = [
    `Angefragtes Supplement: "${input.name}"`,
    input.notesOrIngredients ? `Zusatzangaben / Inhaltsstoffe vom Etikett: "${input.notesOrIngredients}"` : "",
    "\nNutzer-Kontext:",
    userContext,
    cacheHint,
  ]
    .filter(Boolean)
    .join("\n");

  let rawResponseText: string;

  if (setting.provider === "GEMINI") {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: setting.model || "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
        config: {
          temperature: 0.2,
          maxOutputTokens: 2048,
          thinkingConfig: { thinkingBudget: 0 },
          responseMimeType: "application/json",
          responseSchema: geminiSupplementSchema,
        },
      });
      rawResponseText = response.text ?? "";
    } catch (error) {
      throw new AiProviderError(
        `KI-Anbieter konnte nicht erreicht werden: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  } else {
    rawResponseText = await callChatCompletion(setting.provider, apiKey, setting.model, [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawResponseText.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, ""));
  } catch {
    throw new AiProviderError("Antwort des KI-Anbieters war kein gültiges JSON");
  }

  if (parsedJson && typeof parsedJson === "object" && "suggestedReminderTime" in parsedJson) {
    const t = String((parsedJson as Record<string, unknown>).suggestedReminderTime ?? "");
    if (/^\d:[0-5]\d$/.test(t)) {
      (parsedJson as Record<string, unknown>).suggestedReminderTime = `0${t}`;
    } else if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) {
      (parsedJson as Record<string, unknown>).suggestedReminderTime = "08:00";
    }
  }

  const validated = modelResponseZodSchema.safeParse(parsedJson);
  if (!validated.success) {
    throw new AiProviderError("Antwort des KI-Anbieters entsprach nicht dem erwarteten Supplement-Analyse-Format");
  }

  const data = validated.data;
  const canonicalKey = normalizeSupplementKey(data.canonicalName || input.name);

  await prisma.supplementKnowledgeCache
    .upsert({
      where: { canonicalKey },
      create: {
        canonicalKey,
        displayNameDe: data.displayNameDe,
        evidenceTier: data.evidenceTier,
        generalEvidenceSummary: data.generalEvidenceSummary,
        standardDosageRule: data.recommendedDosage,
        optimalTimingRule: data.optimalTiming,
        defaultReminderTime: data.suggestedReminderTime,
        cautions: data.sideEffectsOrCautions,
      },
      update: {
        displayNameDe: data.displayNameDe,
        evidenceTier: data.evidenceTier,
        generalEvidenceSummary: data.generalEvidenceSummary,
        standardDosageRule: data.recommendedDosage,
        optimalTimingRule: data.optimalTiming,
        defaultReminderTime: data.suggestedReminderTime,
        cautions: data.sideEffectsOrCautions,
      },
    })
    .catch(() => undefined);

  return {
    ...data,
    cachedEvidenceUsed: Boolean(cachedKnowledge),
  };
}

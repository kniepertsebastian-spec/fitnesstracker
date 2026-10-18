import { spawn } from "node:child_process";
import sharp from "sharp";
import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { GoogleGenAI } from "@google/genai";
import { decryptSecret } from "../../lib/crypto.js";
import { env } from "../../config/env.js";
import { ConflictError } from "../../errors/httpErrors.js";
import { callChatCompletion, AiProviderError } from "../aiPlanGenerator/aiClient.js";

const metricSchema = z.object({
  key: z.string().min(1).max(80),
  label: z.string().min(1).max(100),
  value: z.number().finite(),
  unit: z.string().max(30),
  explanation: z.string().min(1).max(2000),
  assessment: z.string().min(1).max(2000),
  confidence: z.enum(["high", "medium", "low"]),
});
const analysisSchema = z.object({
  summary: z.string().min(1).max(8000),
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
    child.on("error", () => {
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
  const prompt = `Erstelle aus diesem Fitness-/Körperzusammensetzungsbericht eine wirklich detaillierte, verständliche und personalisierte Auswertung auf Deutsch. Arbeite ausschließlich mit den vorliegenden Angaben; erfinde keine Messwerte, biografischen Daten oder Verlaufspunkte.

DATENQUALITÄT UND PRIORITÄTEN:
- Bevorzuge aktuelle Werte aus der zentralen Übersicht bzw. den ausdrücklich als aktuell markierten Tabellen.
- Verwechsle Achsenwerte, Grenzbereiche, frühere Messpunkte in Diagrammen, linke/rechte Segmentwerte oder Sollwerte niemals mit dem aktuellen Gesamtwert.
- Wenn Werte einander widersprechen (z. B. Gewicht, Körperfettanteil oder Muskelmasse in verschiedenen Bereichen), markiere den Konflikt im Gesamtfazit und setze die betroffenen Metriken auf confidence "low" oder lasse nicht eindeutig zuordenbare Werte weg. Wähle nicht stillschweigend einen Wert.
- Extrahiere so viele eindeutig erkennbare aktuelle Messwerte wie sinnvoll, nicht nur 4–5. Dazu gehören ggf. weightKg, bodyFatPercent, fatMassKg, fatFreeMassKg, muscleMassKg, skeletalMuscleKg, bodyWaterPercent, proteinMassKg, boneMassKg, bmi, visceralFat, basalMetabolicRateKcal, subcutaneousFatPercent, asmi, waistHipRatio, heightCm und ageYears. Verwende kurze englische camelCase-keys für weitere tatsächlich erkannte numerische Werte.
- Körpergröße, Alter und andere Kontextangaben nur aufnehmen, wenn klar erkennbar. Geschlecht nicht als numerische Metrik darstellen.
- Werte aus der aktuellen Übersicht haben Vorrang vor historischen Diagrammen. Übernimm Verlauf nur in die qualitative Einschätzung, wenn die Richtung klar ist; leite keine exakten früheren Messungen aus Diagrammachsen ab.

GESAMTBEWERTUNG:
Schreibe summary als ausführlichen Bericht mit klaren Überschriften und Absätzen (maximal 7.500 Zeichen). Beginne unbedingt mit den folgenden vier kurzen, leicht verständlichen Abschnitten, damit die wichtigsten Erkenntnisse sofort sichtbar sind:
1. "GESAMTFAZIT" – 3–5 Sätze: Gesamtbild und vorsichtige Einordnung, wie die Messwerte im Fitness-/Gesundheitskontext wirken. Nutze Formulierungen wie "insgesamt eher günstig", "gemischtes Bild" oder "einige Punkte verdienen Aufmerksamkeit". Vergib KEINEN pauschalen Gesundheits-Score und behaupte nicht, anhand einer Körperwaage die Gesundheit vollständig beurteilen zu können. Nenne die 2–3 wichtigsten Gründe und Unsicherheiten.
2. "KURZÜBERSICHT" – stichpunktartige Kurzliste der wichtigsten tatsächlich erkannten Werte mit Zahlen und Einheiten (z. B. Gewicht, BMI, Körperfett, Fettmasse, fettfreie Masse, Muskelmasse, viszerales Fett, Grundumsatz). Nur vorhandene und hinreichend eindeutige Werte nennen; keine Werte erfinden. Ergänze jeweils eine sehr kurze Einordnung, soweit sinnvoll.
3. "DAS IST GUT" – 2–4 konkrete positive Befunde, die tatsächlich durch Messwerte gestützt sind. Wenn es keine klaren positiven Befunde gibt, sage das ehrlich, statt positive Aussagen zu erfinden.
4. "DARAUF SOLLTEST DU ACHTEN" – 2–4 konkrete Punkte mit Priorität. Erkläre, warum der jeweilige Wert relevant sein kann und was man sinnvollerweise tun oder im Verlauf beobachten könnte. Unauffällige oder unsichere Werte nicht unnötig problematisieren. Bei fehlenden Daten ausdrücklich sagen, dass die Einordnung begrenzt ist.

Fahre danach mit diesen Abschnitten fort:
5. "KÖRPERZUSAMMENSETZUNG" – verknüpfe Gewicht, Fettmasse, Körperfettanteil, fettfreie Masse, Muskel-/Skelettmuskelmasse und Wasser. Prüfe rechnerische Plausibilität, z. B. ob Fettmasse ungefähr Gewicht × Körperfettanteil entspricht und ob fettfreie Masse ungefähr Gewicht minus Fettmasse entspricht. Weise auf Abweichungen hin, ohne Messmethoden als exakt darzustellen.
6. "MUSKELN & VERTEILUNG" – erkläre Muskelmasse, Skelettmuskel, ASMI und segmentale Verteilung nur soweit erkennbar; unterscheide Gesamtmuskelmasse und Skelettmuskelmasse. Keine Diagnose aus Waagenwerten ableiten.
7. "FETTVERTEILUNG & WEITERE INDIKATOREN" – ordne BMI, viszerales/subkutanes Fett, WHR und Grundumsatz vorsichtig ein, falls vorhanden. Erkläre Grenzen von BMI und BIA-Waagen.
8. "ABNEHMZIEL & MUSKELERHALT" – wenn Gewicht, Körperfettanteil und/oder fettfreie Masse verlässlich vorhanden sind, rechne transparent und gerundet mögliche Szenarien für einen moderaten Ziel-Körperfettanteil (bei erwachsenen Männern z. B. 18 % und 20 %, bei Frauen nicht dieselben Szenarien verwenden; wenn Geschlecht/Alter unklar ist, keine geschlechtsspezifischen Zielwerte vorgeben). Bei verfügbarer fettfreier Masse kann das theoretische Zielgewicht = fettfreie Masse / (1 − Ziel-Körperfettanteil) sein, aber nur als grobe Modellrechnung unter der Annahme, dass fettfreie Masse erhalten bleibt. Zeige die Annahme und mögliche Messunsicherheit. Nutze nicht die angegebene "Muskelmasse" allein als fettfreie Masse. Wenn die Daten nicht reichen, sage konkret, was fehlt. Kein aggressives oder medizinisch verbindliches Ziel verordnen.
9. "KONKRETE NÄCHSTE SCHRITTE" – 3–5 praktische, priorisierte Hinweise zu Ernährung, Krafttraining, Alltagsbewegung, Erholung und sinnvoller Wiederholungsmessung. Keine erfundenen Kalorienvorgaben; Grundumsatz ist nicht gleich Gesamtverbrauch. Proteinempfehlungen nur als allgemeine Orientierung und ohne medizinische Gewissheit.
10. "MESSQUALITÄT & GRENZEN" – benenne erkannte Widersprüche/Unsicherheiten und dass BIA-Waagenwerte von Hydration, Tageszeit und Gerät abhängen; keine Diagnose.

Jede Messgröße bekommt zusätzlich eine kurze, spezifische Erklärung und Einordnung. Vermeide generische Floskeln wie "Wert beobachten" ohne zu sagen, was genau im Verlauf relevant wäre. Keine Diagnose und keine Angst erzeugende Sprache. Wenn ein Abschnitt mangels Daten nicht sinnvoll möglich ist, sage das offen. Gesundheitsbezogene Einordnung ist nur eine Orientierung anhand der Messwerte und ersetzt keine ärztliche Beurteilung.

Gib ausschließlich gültiges JSON in diesem Format zurück:
{"summary":"... ausführlicher Bericht mit Absätzen ...","metrics":[{"key":"weightKg","label":"Gewicht","value":82.4,"unit":"kg","explanation":"...","assessment":"...","confidence":"high"}]}
OCR-TEXT:
${ocrText.slice(0, 12000)}`;

  const systemPrompt = "Du bist ein sorgfältiger Fitness- und Körperzusammensetzungs-Assistent. Liefere eine ausführliche, datenbasierte Auswertung mit transparenten Annahmen. Keine Diagnosen, keine erfundenen Werte, keine stillschweigend aufgelösten Widersprüche. Antworte ausschließlich mit gültigem JSON.";
  let raw: string;
  if (setting.provider === "GEMINI") {
    // Use the same saved Gemini key and native SDK path as the training-plan generator.
    const ai = new GoogleGenAI({ apiKey });
    try {
      const response = await ai.models.generateContent({
        model: setting.model || "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\n${prompt}` }] }],
        config: { temperature: 0.2, responseMimeType: "application/json" },
      });
      raw = response.text ?? "";
    } catch (error) {
      throw new AiProviderError(`Gemini konnte die Körperanalyse nicht auswerten: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!raw) throw new AiProviderError("Gemini hat eine leere Antwort für die Körperanalyse zurückgegeben.");
  } else {
    raw = await callChatCompletion(
      setting.provider,
      apiKey,
      setting.model,
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
    );
  }
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
  summary: z.string().min(1).max(8000),
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

import type { PrismaClient } from "@prisma/client";
import { Type } from "@google/genai";
import { z } from "zod";
import type { DescriptionTranslationState } from "@fitnesstracker/shared";
import { ForbiddenError } from "../../errors/httpErrors.js";
import { callModel } from "../aiPlanGenerator/aiPlanGenerator.service.js";
import { isOperator } from "./exercise.service.js";

// One-off run that gives every catalog exercise with a German name a German description. It uses the
// operator's own AI key (BYOK, like every other AI feature), writes the result to Exercise.descriptionDe
// and can be stopped and started again — it only ever touches exercises that still have none.

const BATCH_SIZE = 10;
const PAUSE_BETWEEN_BATCHES_MS = 1500;
const MAX_FAILED_BATCHES_IN_A_ROW = 3;

const SYSTEM_PROMPT = `Du bist Fachübersetzer für Fitness-Übungsbeschreibungen. Übersetze die englische Ausführungsbeschreibung jeder Übung ins Deutsche.
Regeln: Bleibe in der Anweisungsform des Originals und sprich den Nutzer mit "du" an. Behalte die Absätze (Leerzeilen), Zahlen und Einheiten bei. Verwende gebräuchliche deutsche Fachbegriffe (Kurzhantel, Langhantel, Kabelzug, Bank, Wiederholung, Satz). Füge nichts hinzu: keine Warnungen, Tipps oder Erklärungen, und lass nichts weg.
Antworte AUSSCHLIESSLICH mit validem JSON in exakt diesem Format, mit genau den übergebenen ids: {"items": [{"id": "<id>", "text": "<deutsche Beschreibung>"}]}`;

const geminiSchema = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { id: { type: Type.STRING }, text: { type: Type.STRING } },
        required: ["id", "text"],
      },
    },
  },
  required: ["items"],
};

const responseSchema = z.object({ items: z.array(z.object({ id: z.string(), text: z.string() })) });

// A translation that is empty, unchanged, or far too short/long is thrown away instead of stored.
export function isPlausibleTranslation(original: string, translated: string): boolean {
  const t = translated.trim();
  const o = original.trim();
  if (!t || t === o) return false;
  if (t.includes("```") || /^[{[]/.test(t)) return false;
  const ratio = t.length / Math.max(1, o.length);
  if (ratio < 0.5 || ratio > 2.2) return false;
  // Roughly the same number of paragraphs (steps stay steps).
  const paragraphs = (s: string) => s.split(/\n\s*\n/).filter((p) => p.trim()).length;
  return Math.abs(paragraphs(t) - paragraphs(o)) <= 1;
}

const WHERE_MISSING = { nameDe: { not: null }, description: { not: null }, descriptionDe: null, isActive: true } as const;

interface RunState {
  running: boolean;
  translated: number;
  failed: number;
  error: string | null;
}

// In memory: a run is a minutes-long background job of one operator, not data worth a table.
const state: RunState = { running: false, translated: 0, failed: 0, error: null };

export async function getTranslationState(prisma: PrismaClient, userId: string): Promise<DescriptionTranslationState> {
  const [remaining, operator] = await Promise.all([prisma.exercise.count({ where: WHERE_MISSING }), isOperator(prisma, userId)]);
  return { running: state.running, remaining, translated: state.translated, failed: state.failed, error: state.error, isOperator: operator };
}

export async function startDescriptionTranslation(prisma: PrismaClient, userId: string): Promise<DescriptionTranslationState> {
  if (!(await isOperator(prisma, userId))) {
    throw new ForbiddenError("Die Beschreibungen kann nur das Betreiberkonto übersetzen.");
  }
  if (!state.running) {
    state.running = true;
    state.translated = 0;
    state.failed = 0;
    state.error = null;
    void run(prisma, userId);
  }
  return getTranslationState(prisma, userId);
}

async function run(prisma: PrismaClient, userId: string): Promise<void> {
  const skipped = new Set<string>();
  let failedInARow = 0;
  try {
    for (;;) {
      const batch = await prisma.exercise.findMany({
        where: { ...WHERE_MISSING, id: { notIn: [...skipped] } },
        orderBy: { name: "asc" },
        take: BATCH_SIZE,
        select: { id: true, name: true, nameDe: true, description: true },
      });
      if (batch.length === 0) break;

      try {
        const raw = await callModel(
          prisma,
          userId,
          SYSTEM_PROMPT,
          JSON.stringify(batch.map((e) => ({ id: e.id, name: e.nameDe ?? e.name, text: e.description }))),
          { geminiResponseSchema: geminiSchema, maxOutputTokens: 8192 },
        );
        const parsed = responseSchema.parse(JSON.parse(raw.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, "")));
        const byId = new Map(parsed.items.map((i) => [i.id, i.text]));
        let saved = 0;
        for (const exercise of batch) {
          const text = byId.get(exercise.id);
          if (text && isPlausibleTranslation(exercise.description as string, text)) {
            await prisma.exercise.update({ where: { id: exercise.id }, data: { descriptionDe: text.trim() } });
            state.translated += 1;
            saved += 1;
          } else {
            skipped.add(exercise.id);
            state.failed += 1;
          }
        }
        failedInARow = saved === 0 ? failedInARow + 1 : 0;
      } catch (error) {
        // The whole batch failed (quota, network, unreadable answer): leave it for the next run.
        for (const e of batch) skipped.add(e.id);
        state.failed += batch.length;
        failedInARow += 1;
        state.error = error instanceof Error ? error.message.slice(0, 300) : "Unbekannter Fehler";
      }
      if (failedInARow >= MAX_FAILED_BATCHES_IN_A_ROW) {
        state.error ??= "Mehrere Anfragen in Folge sind fehlgeschlagen.";
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, PAUSE_BETWEEN_BATCHES_MS));
    }
  } finally {
    state.running = false;
  }
}

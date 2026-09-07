import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();
const BATCH_SIZE = 10;
const model = process.env.GEMINI_TRANSLATION_MODEL ?? "gemini-2.5-flash";
const apiKey = process.env.GEMINI_API_KEY;

const responseSchema = z.object({
  translations: z.array(
    z.object({
      id: z.string().uuid(),
      descriptionDe: z.string().min(1),
    }),
  ),
});

async function translateBatch(exercises: Array<{ id: string; name: string; description: string }>) {
  if (!apiKey) throw new Error("GEMINI_API_KEY is required");

  const prompt = [
    "Translate these English exercise instructions into natural, concise German.",
    "Use established German fitness terminology. Preserve meaning, warnings, paragraph structure, numbers, and units.",
    "Do not add advice, medical claims, or information absent from the source.",
    "Return every id exactly once as JSON with shape: {\"translations\":[{\"id\":\"...\",\"descriptionDe\":\"...\"}]}.",
    JSON.stringify(exercises),
  ].join("\n\n");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0 },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini request failed (${response.status}): ${await response.text()}`);
  }

  const body = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("");
  if (!text) throw new Error("Gemini returned no translation text");

  const parsed = responseSchema.parse(JSON.parse(text));
  const expectedIds = new Set(exercises.map((exercise) => exercise.id));
  const returnedIds = new Set(parsed.translations.map((translation) => translation.id));
  if (
    parsed.translations.length !== expectedIds.size ||
    returnedIds.size !== expectedIds.size ||
    [...expectedIds].some((id) => !returnedIds.has(id))
  ) {
    throw new Error("Gemini response did not contain every requested exercise exactly once");
  }
  return parsed.translations;
}

async function main() {
  let translated = 0;

  while (true) {
    const exercises = await prisma.exercise.findMany({
      where: { description: { not: null }, descriptionDe: null, NOT: { description: "" } },
      select: { id: true, name: true, description: true },
      orderBy: { id: "asc" },
      take: BATCH_SIZE,
    });
    const batch = exercises.flatMap((exercise) =>
      exercise.description ? [{ ...exercise, description: exercise.description }] : [],
    );
    if (batch.length === 0) break;

    const translations = await translateBatch(batch);
    await prisma.$transaction(
      translations.map((translation) =>
        prisma.exercise.update({
          where: { id: translation.id },
          data: { descriptionDe: translation.descriptionDe.trim() },
        }),
      ),
    );
    translated += translations.length;
    console.log(`Translated ${translated} exercise descriptions…`);
  }

  console.log(`Done. Added ${translated} German exercise descriptions.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

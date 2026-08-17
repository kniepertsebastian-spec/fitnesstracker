import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const exercises = [
  { name: "Bankdrücken", description: "Langhantel-Bankdrücken auf der Flachbank." },
  { name: "Kniebeuge", description: "Langhantel-Kniebeuge, hüftbreiter Stand." },
  { name: "Kreuzheben", description: "Konventionelles Kreuzheben mit der Langhantel." },
  { name: "Schulterdrücken", description: "Langhantel oder Kurzhantel-Schulterdrücken im Stehen oder Sitzen." },
  { name: "Klimmzug", description: "Klimmzug im Obergriff, Körper bis zum Anschlag hochziehen." },
  { name: "Latzug", description: "Latzug zur Brust am Kabelzug." },
  { name: "Rudern vorgebeugt", description: "Langhantelrudern im vorgebeugten Stand." },
  { name: "Beinpresse", description: "Beinpresse an der Maschine." },
];

// Manual entries are tagged source="manual" with a slug as sourceId, purely so the same
// (source, sourceId) upsert-idempotency pattern used by imported exercises also works here.
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[üä]/g, (c) => ({ ü: "ue", ä: "ae" })[c] ?? c)
    .replace(/ö/g, "oe")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function main() {
  for (const exercise of exercises) {
    const sourceId = slugify(exercise.name);
    await prisma.exercise.upsert({
      where: { source_sourceId: { source: "manual", sourceId } },
      update: {},
      create: { ...exercise, source: "manual", sourceId },
    });
  }
  console.log(`Seeded ${exercises.length} exercises.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const exercises = [
  { name: "Bench Press", nameDe: "Bankdrücken", description: "Barbell bench press on a flat bench.", descriptionDe: "Langhantel-Bankdrücken auf der Flachbank." },
  { name: "Squat", nameDe: "Kniebeuge", description: "Barbell squat with a hip-width stance.", descriptionDe: "Langhantel-Kniebeuge, hüftbreiter Stand." },
  { name: "Deadlift", nameDe: "Kreuzheben", description: "Conventional barbell deadlift.", descriptionDe: "Konventionelles Kreuzheben mit der Langhantel." },
  { name: "Overhead Press", nameDe: "Schulterdrücken", description: "Standing or seated barbell or dumbbell overhead press.", descriptionDe: "Langhantel oder Kurzhantel-Schulterdrücken im Stehen oder Sitzen." },
  { name: "Pull-Up", nameDe: "Klimmzug", description: "Overhand-grip pull-up, pulling the body up through the full range of motion.", descriptionDe: "Klimmzug im Obergriff, Körper bis zum Anschlag hochziehen." },
  { name: "Lat Pulldown", nameDe: "Latzug", description: "Cable lat pulldown to the chest.", descriptionDe: "Latzug zur Brust am Kabelzug." },
  { name: "Bent-Over Row", nameDe: "Rudern vorgebeugt", description: "Bent-over barbell row.", descriptionDe: "Langhantelrudern im vorgebeugten Stand." },
  { name: "Leg Press", nameDe: "Beinpresse", description: "Machine leg press.", descriptionDe: "Beinpresse an der Maschine." },
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
    const sourceId = slugify(exercise.nameDe);
    await prisma.exercise.upsert({
      where: { source_sourceId: { source: "manual", sourceId } },
      update: exercise,
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

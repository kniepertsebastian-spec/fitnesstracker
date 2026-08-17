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

async function main() {
  for (const exercise of exercises) {
    await prisma.exercise.upsert({
      where: { name: exercise.name },
      update: {},
      create: exercise,
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

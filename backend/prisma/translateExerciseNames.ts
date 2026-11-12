import { PrismaClient } from "@prisma/client";
import { loadNameTranslations } from "../src/modules/exercises/nameTranslations.js";

const prisma = new PrismaClient();

// English name -> German display name, for rows already imported before the import itself
// translated names. Only touches rows with source="free-exercise-db".
const translations = loadNameTranslations();

async function main() {
  let updated = 0;
  let unmatched = 0;

  for (const [name, nameDe] of Object.entries(translations)) {
    const result = await prisma.exercise.updateMany({
      where: { name, source: "free-exercise-db" },
      data: { nameDe },
    });
    if (result.count > 0) {
      updated += result.count;
    } else {
      unmatched += 1;
    }
  }

  console.log(`Set nameDe on ${updated} exercises. ${unmatched} translation entries matched no row.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

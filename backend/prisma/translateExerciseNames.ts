import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// English name -> German display name, for the free-exercise-db import. Generated once by
// working through the full dataset — see context.md for how. Only touches rows with
// source="free-exercise-db"; manually seeded/created exercises already have a German `name`
// and are left alone.
const translations: Record<string, string> = JSON.parse(
  readFileSync(path.join(__dirname, "data/exerciseNameTranslationsDe.json"), "utf-8"),
);

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

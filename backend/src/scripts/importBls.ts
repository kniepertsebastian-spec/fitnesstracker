import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { readXlsxRows } from "../lib/xlsx.js";
import { BLS_ATTRIBUTION, importBlsFoods, mapBlsRows } from "../modules/foods/blsImport.js";

// Imports the BLS 4.0 data file (layer 2 of the food search). Idempotent: run it again for a
// corrected file and known codes are updated in place.
//   dev:        pnpm --filter backend bls:import ../BLS_4_0_Daten_2025_DE.xlsx
//   container:  node dist/scripts/importBls.js /tmp/BLS_4_0_Daten_2025_DE.xlsx
// The data file is not part of the repository (download: https://www.blsdb.de, CC BY 4.0).

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Pfad zur Datei BLS_4_0_Daten_2025_DE.xlsx fehlt.");
    process.exitCode = 2;
    return;
  }
  const started = Date.now();
  const { foods, skipped, missingMicros } = mapBlsRows(readXlsxRows(readFileSync(file)));
  console.log(`${foods.length} Lebensmittel gelesen, ${skipped} Zeilen übersprungen.`);
  if (missingMicros.length) console.warn(`Nicht in der Datei: ${missingMicros.join(", ")}`);
  if (foods.length === 0) {
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient();
  try {
    const { created, updated } = await importBlsFoods(prisma, foods);
    console.log(`BLS-Import fertig: ${created} neu, ${updated} aktualisiert (${((Date.now() - started) / 1000).toFixed(1)} s).`);
    console.log(`Quelle: ${BLS_ATTRIBUTION}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

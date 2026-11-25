import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { emptyNutrients } from "../modules/nutrition/nutrients.js";
import { importBlsFoods, type BlsFood } from "../modules/foods/blsImport.js";
import { hasTestDb, startApp } from "./testApp.js";

describe.skipIf(!hasTestDb)("BLS import (integration)", () => {
  let app: FastifyInstance;
  const prefix = `IT${randomUUID().slice(0, 6)}`;
  const food = (code: string, kcal: number): BlsFood => ({
    code: `${prefix}${code}`,
    name: `Testlebensmittel ${prefix}${code}`,
    nutrients: { ...emptyNutrients(), kcal, proteinG: 1 },
    estimatedFields: ["proteinG"],
    micronutrients: { VITC: { value: 2, unit: "mg" } },
  });

  beforeAll(async () => {
    app = await startApp();
  });
  afterAll(async () => {
    await app.prisma.food.deleteMany({ where: { source: "BLS", sourceRef: { startsWith: prefix } } });
    await app.close();
  });

  it("creates, then updates in place on a second run", async () => {
    expect(await importBlsFoods(app.prisma, [food("A", 100), food("B", 200)], 1)).toMatchObject({ created: 2, updated: 0 });
    const before = await app.prisma.food.findUniqueOrThrow({ where: { source_sourceRef: { source: "BLS", sourceRef: `${prefix}A` } } });
    expect(before).toMatchObject({ userId: null, kcal: 100, estimatedFields: ["proteinG"], micronutrients: { VITC: { value: 2, unit: "mg" } } });

    expect(await importBlsFoods(app.prisma, [food("A", 110), food("C", 300)])).toMatchObject({ created: 1, updated: 1 });
    const after = await app.prisma.food.findUniqueOrThrow({ where: { source_sourceRef: { source: "BLS", sourceRef: `${prefix}A` } } });
    expect(after.id).toBe(before.id);
    expect(after.kcal).toBe(110);
    expect(await app.prisma.food.count({ where: { source: "BLS", sourceRef: { startsWith: prefix } } })).toBe(3);
  });
});

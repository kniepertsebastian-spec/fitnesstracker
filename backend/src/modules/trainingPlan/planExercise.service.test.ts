import { describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { createPlanExercise } from "./planExercise.service.js";

interface Row {
  id: string;
  userId: string;
  phase: string;
  exerciseId: string;
  dayLabel: string | null;
  order: number;
}

// Just enough of prisma.planExercise: equality filters, descending order sort, create.
function fakePrisma() {
  const rows: Row[] = [];
  const matches = (row: Row, where: Partial<Row>) =>
    (Object.keys(where) as (keyof Row)[]).every((key) => row[key] === where[key]);
  const prisma = {
    exercise: { findUnique: async ({ where }: { where: { id: string } }) => ({ id: where.id }) },
    planExercise: {
      findFirst: async ({ where, orderBy }: { where: Partial<Row>; orderBy?: { order: "desc" } }) => {
        const found = rows.filter((r) => matches(r, where));
        if (orderBy) found.sort((a, b) => b.order - a.order);
        return found[0] ?? null;
      },
      create: async ({ data }: { data: Omit<Row, "id"> }) => {
        const row = { ...data, id: `row-${rows.length}` };
        rows.push(row);
        return { ...row, exercise: { id: row.exerciseId } };
      },
    },
  };
  return { prisma: prisma as unknown as PrismaClient, rows };
}

describe("createPlanExercise order", () => {
  it("keeps the split days in the order they were created", async () => {
    const { prisma, rows } = fakePrisma();
    const days = ["Push", "Pull", "Legs"];
    for (const [d, day] of days.entries()) {
      for (let i = 0; i < 2; i++) {
        await createPlanExercise(prisma, "u1", { phase: "AUFBAU", exerciseId: `ex-${d}-${i}`, dayLabel: day });
      }
    }
    // One strictly increasing sequence over the whole phase: day order = first appearance.
    expect(rows.map((r) => r.order)).toEqual([0, 1, 2, 3, 4, 5]);
    expect([...new Set(rows.map((r) => r.dayLabel))]).toEqual(days);
  });

  it("adds to an earlier day without reordering the days", async () => {
    const { prisma, rows } = fakePrisma();
    await createPlanExercise(prisma, "u1", { phase: "AUFBAU", exerciseId: "a", dayLabel: "Push" });
    await createPlanExercise(prisma, "u1", { phase: "AUFBAU", exerciseId: "b", dayLabel: "Pull" });
    await createPlanExercise(prisma, "u1", { phase: "AUFBAU", exerciseId: "c", dayLabel: "Push" });
    const sorted = [...rows].sort((x, y) => x.order - y.order);
    expect([...new Set(sorted.map((r) => r.dayLabel))]).toEqual(["Push", "Pull"]);
    expect(sorted.filter((r) => r.dayLabel === "Push").map((r) => r.exerciseId)).toEqual(["a", "c"]);
  });
});

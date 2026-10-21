import { describe, expect, it, vi } from "vitest";
import { importBodyCompositionSchema } from "@fitnesstracker/shared";
import { importEntries } from "./bodyComposition.service.js";

function fakePrisma(existingTimes: string[]) {
  const createMany = vi.fn().mockResolvedValue({ count: 0 });
  const prisma = {
    bodyCompositionEntry: {
      findMany: vi.fn().mockResolvedValue(existingTimes.map((t) => ({ measuredAt: new Date(t) }))),
      createMany,
    },
  };
  return { prisma: prisma as unknown as Parameters<typeof importEntries>[0], createMany };
}

describe("importEntries", () => {
  const entries = [
    { measuredAt: "2024-01-05T07:15:30.000Z", weightKg: 76.554, bodyFatPercent: 21.34 },
    { measuredAt: "2024-01-06T07:15:30.000Z", weightKg: 76 },
    { measuredAt: "2024-01-06T07:15:30.000Z", weightKg: 75 }, // repeated within the payload
  ];

  it("skips measurements that already exist and repeats, and rounds to the column precision", async () => {
    const { prisma, createMany } = fakePrisma(["2024-01-06T07:15:30.000Z"]);
    const result = await importEntries(prisma, "user-1", { entries });
    expect(result).toEqual({ imported: 1, skipped: 2 });
    expect(createMany).toHaveBeenCalledWith({
      data: [
        { userId: "user-1", measuredAt: new Date("2024-01-05T07:15:30.000Z"), weightKg: 76.55, bodyFatPercent: 21.3 },
      ],
    });
  });

  it("writes nothing when everything exists already", async () => {
    const { prisma, createMany } = fakePrisma(entries.map((e) => e.measuredAt));
    expect(await importEntries(prisma, "user-1", { entries })).toEqual({ imported: 0, skipped: 3 });
    expect(createMany).not.toHaveBeenCalled();
  });

  it("validates the payload: 1 to 1000 entries with plausible values", () => {
    expect(() => importBodyCompositionSchema.parse({ entries: [] })).toThrow();
    expect(() => importBodyCompositionSchema.parse({ entries: [{ measuredAt: "x", weightKg: 80 }] })).toThrow();
    expect(() =>
      importBodyCompositionSchema.parse({ entries: [{ measuredAt: "2024-01-05T07:15:30.000Z", weightKg: 0 }] }),
    ).toThrow();
  });
});

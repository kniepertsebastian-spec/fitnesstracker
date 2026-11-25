import { describe, expect, it } from "vitest";
import { HttpError } from "../errors/httpErrors.js";
import { assertAiBudget, budgetDay, budgetKeys, consumeAiBudget, memoryBudgetCounter } from "./aiBudget.js";

const limits = { perUser: 3, global: 5 };
const now = new Date("2026-11-25T12:00:00Z");

describe("budgetDay", () => {
  it("uses the Europe/Berlin calendar day", () => {
    // 23:30 UTC on 24 Nov is already 25 Nov in Berlin (UTC+1).
    expect(budgetDay(new Date("2026-11-24T23:30:00Z"))).toBe("2026-11-25");
    expect(budgetDay(new Date("2026-11-24T22:30:00Z"))).toBe("2026-11-24");
  });

  it("builds separate user and global keys per day", () => {
    expect(budgetKeys("u1", now)).toEqual({ user: "ai-budget:2026-11-25:user:u1", global: "ai-budget:2026-11-25:global" });
  });
});

describe("consumeAiBudget", () => {
  it("allows calls up to the per-user budget and refuses the next one without counting it", async () => {
    const counter = memoryBudgetCounter();
    for (let i = 1; i <= 3; i++) {
      const result = await consumeAiBudget(counter, "u1", limits, { now });
      expect(result).toMatchObject({ allowed: true, usedByUser: i, remainingForUser: 3 - i });
    }
    const refused = await consumeAiBudget(counter, "u1", limits, { now });
    expect(refused).toMatchObject({ allowed: false, usedByUser: 3, usedGlobal: 3, remainingForUser: 0 });
    // Another user still has budget, and the refusal did not consume global units.
    expect((await consumeAiBudget(counter, "u2", limits, { now })).usedGlobal).toBe(4);
  });

  it("enforces the global budget across users", async () => {
    const counter = memoryBudgetCounter();
    for (const user of ["a", "a", "b", "b", "c"]) expect((await consumeAiBudget(counter, user, limits, { now })).allowed).toBe(true);
    expect((await consumeAiBudget(counter, "d", limits, { now })).allowed).toBe(false);
  });

  it("counts a weighted call with its cost", async () => {
    const counter = memoryBudgetCounter();
    expect((await consumeAiBudget(counter, "u1", limits, { now, cost: 3 })).allowed).toBe(true);
    expect((await consumeAiBudget(counter, "u1", limits, { now })).allowed).toBe(false);
  });

  it("starts fresh on the next day", async () => {
    const counter = memoryBudgetCounter();
    for (let i = 0; i < 3; i++) await consumeAiBudget(counter, "u1", limits, { now });
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    expect((await consumeAiBudget(counter, "u1", limits, { now: tomorrow })).allowed).toBe(true);
  });

  it("forgets expired counters in memory", async () => {
    let clock = 0;
    const counter = memoryBudgetCounter(() => clock);
    await counter.incrBy("k", 5, 10);
    clock = 11_000;
    expect(await counter.incrBy("k", 1, 10)).toBe(1);
  });
});

describe("assertAiBudget", () => {
  it("throws 429 once the budget is used up", async () => {
    const counter = memoryBudgetCounter();
    await assertAiBudget(counter, "u1", { perUser: 1, global: 10 }, { now });
    await expect(assertAiBudget(counter, "u1", { perUser: 1, global: 10 }, { now })).rejects.toMatchObject({ statusCode: 429 });
    await expect(assertAiBudget(counter, "u1", { perUser: 1, global: 10 }, { now })).rejects.toBeInstanceOf(HttpError);
  });
});

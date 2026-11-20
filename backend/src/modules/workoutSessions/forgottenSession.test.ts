import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

vi.mock("../push/push.service.js", () => ({ sendNotificationToUser: vi.fn(async () => undefined) }));

import { completeStaleDailySessions, processForgottenSessions } from "./forgottenSession.js";
import { sendNotificationToUser } from "../push/push.service.js";

const NOW = new Date("2026-11-03T12:00:00Z");
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);

function fakePrisma(opts: { overdue?: unknown[]; due?: unknown[]; daily?: unknown[]; lastLog?: Date | null }) {
  const update = vi.fn(async () => ({}));
  const updateMany = vi.fn(async () => ({ count: 1 }));
  const findMany = vi.fn()
    .mockResolvedValueOnce(opts.overdue ?? [])
    .mockResolvedValueOnce(opts.due ?? [])
    .mockResolvedValueOnce(opts.daily ?? []);
  const prisma = {
    workoutSession: { findMany, update, updateMany },
    workoutLog: { findFirst: vi.fn(async () => (opts.lastLog ? { performedAt: opts.lastLog } : null)) },
  } as unknown as PrismaClient;
  return { prisma, update, updateMany };
}

const base = { id: "s1", userId: "u1", startedAt: minutesAgo(160), user: { remindWorkout: true } };

describe("processForgottenSessions", () => {
  it("asks after 2h and stamps the prompt time", async () => {
    const { prisma, updateMany } = fakePrisma({ due: [base] });
    expect(await processForgottenSessions(prisma, NOW)).toEqual({ prompted: 1, completed: 0 });
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { stopPromptSentAt: NOW } }));
    expect(sendNotificationToUser).toHaveBeenCalledWith(expect.anything(), "u1", expect.objectContaining({ title: "Training noch aktiv?" }));
  });

  it("completes at the last set when the prompt stays unanswered", async () => {
    const lastSet = minutesAgo(70);
    const { prisma, updateMany } = fakePrisma({
      overdue: [{ ...base, stopPromptSentAt: minutesAgo(31) }],
      lastLog: lastSet,
    });
    expect(await processForgottenSessions(prisma, NOW)).toEqual({ prompted: 0, completed: 1 });
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "COMPLETED", endedAt: lastSet } }));
  });

  it("treats a set logged after the prompt as an answer", async () => {
    const { prisma, update, updateMany } = fakePrisma({
      overdue: [{ ...base, stopPromptSentAt: minutesAgo(31) }],
      lastLog: minutesAgo(5),
    });
    expect(await processForgottenSessions(prisma, NOW)).toEqual({ prompted: 0, completed: 0 });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: { stopPromptSentAt: null, keepAliveAt: NOW } }));
    expect(updateMany).not.toHaveBeenCalled();
  });
});

describe("completeStaleDailySessions", () => {
  // 2026-11-03 12:00 UTC = 13:00 in Berlin; the local day started at 2026-11-02 23:00 UTC.
  const daily = (startedAt: Date) => ({ id: "d1", userId: "u1", startedAt, user: { timeZone: "Europe/Berlin" } });

  function dailyPrisma(sessions: unknown[], lastLog: Date | null) {
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const prisma = {
      workoutSession: { findMany: vi.fn(async () => sessions), updateMany },
      workoutLog: { findFirst: vi.fn(async () => (lastLog ? { performedAt: lastLog } : null)) },
    } as unknown as PrismaClient;
    return { prisma, updateMany };
  }

  it("closes a Daily session from an earlier day at the last logged set", async () => {
    const lastSet = new Date("2026-11-02T17:30:00Z");
    const { prisma, updateMany } = dailyPrisma([daily(new Date("2026-11-02T08:00:00Z"))], lastSet);
    expect(await completeStaleDailySessions(prisma, NOW)).toBe(1);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "COMPLETED", endedAt: lastSet } }));
  });

  it("leaves a Daily session of today open — it may be picked up again later", async () => {
    const { prisma, updateMany } = dailyPrisma([daily(new Date("2026-11-03T07:00:00Z"))], null);
    expect(await completeStaleDailySessions(prisma, NOW)).toBe(0);
    expect(updateMany).not.toHaveBeenCalled();
  });
});

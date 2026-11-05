import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.fn().mockResolvedValue(undefined);
vi.mock("./push.service.js", () => ({ sendNotificationToUser: (...args: unknown[]) => send(...args) }));

import { cancelRestTimerPush, scheduleRestTimerPush } from "./restTimerPush.js";

const prisma = {} as Parameters<typeof scheduleRestTimerPush>[0];

describe("rest timer push", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    send.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it("notifies once at the end, replacing an earlier timer", () => {
    scheduleRestTimerPush(prisma, "u1", new Date(Date.now() + 90_000), "Bankdrücken");
    scheduleRestTimerPush(prisma, "u1", new Date(Date.now() + 60_000), "Bankdrücken");
    vi.advanceTimersByTime(60_000);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][2]).toMatchObject({ title: "Pause vorbei", tag: "rest-timer", skipIfVisible: true });
    vi.advanceTimersByTime(60_000);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("sends nothing after cancel, for past or implausibly far ends", () => {
    scheduleRestTimerPush(prisma, "u2", new Date(Date.now() + 30_000));
    cancelRestTimerPush("u2");
    expect(scheduleRestTimerPush(prisma, "u2", new Date(Date.now() - 1000))).toBe(false);
    expect(scheduleRestTimerPush(prisma, "u2", new Date(Date.now() + 60 * 60_000))).toBe(false);
    vi.advanceTimersByTime(2 * 60 * 60_000);
    expect(send).not.toHaveBeenCalled();
  });
});

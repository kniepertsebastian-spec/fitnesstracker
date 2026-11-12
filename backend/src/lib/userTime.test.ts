import { describe, expect, it } from "vitest";
import {
  localDateAsUtc,
  localDayKey,
  localDayStart,
  localHour,
  localWeekStart,
  localWeekStartAsUtc,
  resolveUserTimeZone,
} from "./userTime.js";

const BERLIN = "Europe/Berlin";

describe("user-local time", () => {
  // Sunday 8 Nov 2026, 23:30 UTC = Monday 9 Nov, 00:30 in Berlin (CET, UTC+1).
  const instant = new Date("2026-11-08T23:30:00Z");

  it("starts the week on Monday 00:30 local time, although UTC still says Sunday", () => {
    expect(instant.getUTCDay()).toBe(0);
    expect(localDayKey(instant, BERLIN)).toBe("2026-11-09");
    expect(localWeekStart(instant, BERLIN).toISOString()).toBe("2026-11-08T23:00:00.000Z");
    expect(localWeekStartAsUtc(instant, BERLIN).toISOString()).toBe("2026-11-09T00:00:00.000Z");
    // the same instant is still last week for someone west of Greenwich
    expect(localWeekStartAsUtc(instant, "America/New_York").toISOString()).toBe("2026-11-02T00:00:00.000Z");
  });

  it("switches the day at local midnight, not at UTC midnight", () => {
    const beforeMidnight = new Date("2026-11-09T22:59:00Z"); // 23:59 in Berlin
    const afterMidnight = new Date("2026-11-09T23:01:00Z"); // 00:01 next day in Berlin
    expect(localDateAsUtc(beforeMidnight, BERLIN).toISOString()).toBe("2026-11-09T00:00:00.000Z");
    expect(localDateAsUtc(afterMidnight, BERLIN).toISOString()).toBe("2026-11-10T00:00:00.000Z");
    expect(localDayStart(afterMidnight, BERLIN).toISOString()).toBe("2026-11-09T23:00:00.000Z");
  });

  it("handles the summer-time switch", () => {
    // Sunday 25 Oct 2026 is the day Europe/Berlin goes back to CET (a 25-hour day).
    const day = new Date("2026-10-25T12:00:00Z");
    expect(localDayStart(day, BERLIN).toISOString()).toBe("2026-10-24T22:00:00.000Z");
    expect(localWeekStart(day, BERLIN).toISOString()).toBe("2026-10-18T22:00:00.000Z");
  });

  it("reads the local hour", () => {
    expect(localHour(new Date("2026-11-09T19:00:00Z"), BERLIN)).toBe(20);
    expect(localHour(new Date("2026-11-09T19:00:00Z"), "America/New_York")).toBe(14);
  });

  it("falls back to the default zone for unknown values", () => {
    expect(resolveUserTimeZone("Mars/Olympus")).toBe(BERLIN);
    expect(resolveUserTimeZone(null)).toBe(BERLIN);
    expect(resolveUserTimeZone("Asia/Tokyo")).toBe("Asia/Tokyo");
  });
});

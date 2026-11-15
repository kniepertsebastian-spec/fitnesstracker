import { describe, expect, it } from "vitest";
import {
  localDateInputValue,
  localDateTimeToIso,
  localTimeInputValue,
  localYesterdayInputValue,
} from "./dates";

describe("localDateTimeToIso", () => {
  it("round-trips local date and time through the ISO instant", () => {
    const iso = localDateTimeToIso("2026-11-10", "18:30");
    expect(iso).not.toBeNull();
    const back = new Date(iso as string);
    expect(localDateInputValue(back)).toBe("2026-11-10");
    expect(localTimeInputValue(back)).toBe("18:30");
  });

  it("keeps a late-evening set on the chosen local day", () => {
    const back = new Date(localDateTimeToIso("2026-11-10", "23:45") as string);
    expect(localDateInputValue(back)).toBe("2026-11-10");
  });

  it("rejects empty, malformed and impossible input", () => {
    expect(localDateTimeToIso("", "18:00")).toBeNull();
    expect(localDateTimeToIso("2026-11-10", "")).toBeNull();
    expect(localDateTimeToIso("10.11.2026", "18:00")).toBeNull();
    expect(localDateTimeToIso("2026-02-31", "18:00")).toBeNull();
    expect(localDateTimeToIso("2026-11-10", "25:00")).toBeNull();
  });
});

describe("localYesterdayInputValue", () => {
  it("crosses month and year boundaries", () => {
    expect(localYesterdayInputValue(new Date(2026, 2, 1, 12))).toBe("2026-02-28");
    expect(localYesterdayInputValue(new Date(2027, 0, 1, 0, 5))).toBe("2026-12-31");
  });
});

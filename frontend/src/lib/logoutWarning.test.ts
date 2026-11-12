import { describe, expect, it } from "vitest";
import { logoutWarnings } from "./logoutWarning";

describe("logoutWarnings", () => {
  it("is empty when online and fully synced", () => {
    expect(logoutWarnings({ isOnline: true, pendingCount: 0, failedCount: 0 })).toEqual([]);
  });
  it("names unsynced entries and the offline state", () => {
    const w = logoutWarnings({ isOnline: false, pendingCount: 3, failedCount: 0 });
    expect(w).toHaveLength(2);
    expect(w[0]).toContain("3 Einträge sind noch nicht synchronisiert");
    expect(w[1]).toContain("offline");
  });
  it("uses the singular", () => {
    expect(logoutWarnings({ isOnline: true, pendingCount: 1, failedCount: 1 }).join(" ")).toContain("1 Eintrag ist");
  });
});

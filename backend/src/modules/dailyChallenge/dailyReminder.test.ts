import { describe, expect, it } from "vitest";
import { dailyReminderBody } from "./dailyReminder.js";

describe("dailyReminderBody", () => {
  it("names the open challenge items with their progress", () => {
    expect(dailyReminderBody([{ name: "Liegestütze", completedReps: 12, targetReps: 20 }], [])).toBe(
      "Heute noch offen: Liegestütze 12/20",
    );
  });

  it("lists daily exercises after the challenge items", () => {
    expect(
      dailyReminderBody([{ name: "Kniebeugen", completedReps: 0, targetReps: 15 }], ["Plank", "Klimmzüge"]),
    ).toBe("Heute noch offen: Kniebeugen 0/15 · Plank · Klimmzüge");
  });

  it("shortens long lists", () => {
    const body = dailyReminderBody([], ["A", "B", "C", "D", "E"]);
    expect(body).toBe("Heute noch offen: A · B · C · +2 weitere");
  });

  it("returns null when nothing is open", () => {
    expect(dailyReminderBody([], [])).toBeNull();
  });
});

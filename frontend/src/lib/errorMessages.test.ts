import { describe, expect, it } from "vitest";
import { germanErrorMessage } from "./errorMessages";

describe("germanErrorMessage", () => {
  it("translates the login error", () => {
    expect(germanErrorMessage(401, "Invalid email or password")).toBe("E-Mail oder Passwort ist falsch.");
  });
  it("translates not-found messages by subject", () => {
    expect(germanErrorMessage(404, "Goal not found")).toBe("Das Ziel wurde nicht gefunden.");
    expect(germanErrorMessage(404, "Something else not found")).toBe("Nicht gefunden.");
  });
  it("keeps German server messages", () => {
    expect(germanErrorMessage(409, "Bitte eine JPG-, PNG- oder WebP-Datei hochladen.")).toBe(
      "Bitte eine JPG-, PNG- oder WebP-Datei hochladen.",
    );
  });
  it("uses the status when there is no message", () => {
    expect(germanErrorMessage(429, "")).toContain("Zu viele Anfragen");
    expect(germanErrorMessage(500, undefined)).toContain("Server");
  });
});

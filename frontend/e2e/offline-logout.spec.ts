import { test, expect } from "@playwright/test";
import { goOffline, goOnline, login, registerTestUser } from "./support";

// Roadmap 2.1: a logout that never reached the server must not be undone by the refresh cookie.
test.describe("Abmelden ohne Verbindung", () => {
  test("offline abmelden, online neu laden → Login-Seite statt angemeldet", async ({ page, context, request }) => {
    const user = await registerTestUser(request, "offline-logout");
    await login(page, user);

    await goOffline(page, context);
    await page.getByRole("button", { name: "Abmelden" }).filter({ visible: true }).first().click();
    // A single tap no longer logs out: the dialog asks first and warns about the offline state.
    const dialog = page.getByRole("dialog", { name: "Abmelden?" });
    await expect(dialog).toContainText("Du bist offline");
    await expect(page).not.toHaveURL(/\/login/);
    await dialog.getByRole("button", { name: "Abmelden" }).click();
    await page.waitForURL("/login");

    await goOnline(page, context);
    await page.reload();
    await page.waitForURL("/login");
    await expect(page.locator('input[type="email"]')).toBeVisible();

    // The server really ended the session: no refresh cookie is left to sign back in with.
    const cookies = await context.cookies();
    expect(cookies.find((c) => c.name === "refreshToken")).toBeUndefined();
    const refreshed = await page.evaluate(async () => (await fetch("/api/auth/refresh", { method: "POST", credentials: "include" })).status);
    expect(refreshed).toBe(401);
  });
});

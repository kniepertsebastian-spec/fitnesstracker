import { test, expect } from "@playwright/test";
import { login, registerTestUser } from "./support";

// roadmap v2 M1/m4: the login page is what a fresh install (and Lighthouse) opens first. It must load
// without errors in the console — no 401 from the boot check — and without the signed-in runtime
// (offline queues, sync), which is loaded only after a login. Dexie stays off the critical path: it
// is not preloaded, only fetched lazily afterwards by the query-cache persister (restore/clear).
test.describe("Login-Kaltstart", () => {
  test("ohne Sitzung: keine Fehler in der Konsole, Boot-Check antwortet 200", async ({ page }) => {
    const consoleErrors: string[] = [];
    const failedResponses: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("response", (response) => {
      if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
    });
    const runtimeChunks: string[] = [];
    page.on("request", (request) => {
      if (/\/assets\/AuthenticatedRuntime-[^/]+\.js$/.test(request.url())) runtimeChunks.push(request.url());
    });

    const [session] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith("/api/auth/session") && r.request().method() === "POST"),
      page.goto("/login"),
    ]);
    expect(session.status()).toBe(200);
    expect(await session.json()).toEqual({ authenticated: false });

    await expect(page.locator('input[type="email"]')).toBeVisible();
    await page.waitForLoadState("networkidle");

    expect(failedResponses).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(runtimeChunks).toEqual([]);
    const preloaded = await page.locator('link[rel="modulepreload"]').evaluateAll((links) =>
      links.map((link) => link.getAttribute("href") ?? ""),
    );
    expect(preloaded.filter((href) => /\/(AuthenticatedRuntime|db|vendor-radix)-/.test(href))).toEqual([]);
  });

  test("mit Sitzung: ein Neuladen meldet über den Boot-Check wieder an", async ({ page, request }) => {
    const user = await registerTestUser(request, "session-boot");
    await login(page, user);

    const [session] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith("/api/auth/session") && r.request().method() === "POST"),
      page.reload(),
    ]);
    expect(session.status()).toBe(200);
    expect(await session.json()).toMatchObject({ authenticated: true, user: { email: user.email } });
    await expect(page).toHaveURL(/\/diary$/);
    await expect(page.getByRole("heading", { name: "Fitnesstagebuch" })).toBeVisible();
  });
});

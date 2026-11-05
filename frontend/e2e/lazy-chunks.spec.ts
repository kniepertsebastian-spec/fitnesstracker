import { test, expect } from "@playwright/test";
import { login, openNav, registerTestUser } from "./support";

// roadmap3 P2.2: every screen is a lazy chunk. A chunk that can't be fetched (a new deploy
// replaced the hashed files, or the connection dropped) must lead to a way out, not a blank app.
test.describe("Lazy geladene Seiten", () => {
  // The service worker would answer from its precache and bypass the blocking below.
  test.use({ serviceWorkers: "block" });

  test("fehlender Chunk: einmal automatisch neu laden, dann Hinweis mit Ausweg", async ({ page, request }) => {
    const user = await registerTestUser(request, "chunks");
    await login(page, user);

    let blocked = true;
    let progressRequests = 0;
    await page.route("**/assets/ProgressPage-*.js", (route) => {
      progressRequests += 1;
      return blocked ? route.fulfill({ status: 404, body: "gone" }) : route.continue();
    });

    await openNav(page, "Fortschritt");
    // The reload guard allows exactly one automatic reload; the second failure shows the message.
    await expect(page.getByText("Diese Seite konnte nicht geladen werden")).toBeVisible({ timeout: 15_000 });
    expect(progressRequests).toBeGreaterThanOrEqual(2);
    await expect(page.getByRole("button", { name: "Neu laden" })).toBeVisible();

    // Connection back: "Neu laden" brings the page up.
    blocked = false;
    await page.getByRole("button", { name: "Neu laden" }).click();
    await expect(page.getByRole("heading", { name: "Fortschritt" })).toBeVisible({ timeout: 15_000 });
  });

  test("Seitenwechsel lädt Chunks nach, ohne die aktuelle Seite zu leeren", async ({ page, request }) => {
    const user = await registerTestUser(request, "chunks-nav");
    await login(page, user);
    // login() ends with a client-side navigation to the diary, whose chunk may still be on its
    // way: start from a page that is really rendered.
    await expect(page.getByRole("heading", { name: "Fitnesstagebuch" })).toBeVisible();
    const headingBefore = await page.locator("h1").first().textContent();
    expect(headingBefore).toBe("Fitnesstagebuch");
    // A slow chunk. Checking right after the click would race React's re-render, so wait until
    // the request is on its way and look in the middle of the delay.
    let chunkRequested!: () => void;
    const requested = new Promise<void>((resolve) => (chunkRequested = resolve));
    await page.route("**/assets/GoalsPage-*.js", async (route) => {
      chunkRequested();
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await route.continue();
    });
    await openNav(page, "Ziele");
    await requested;
    await page.waitForTimeout(1200);
    // Still loading: the current page stays on screen, no "Lädt…" blanking. A single snapshot —
    // `expect(...).toBeVisible()` retries and would just pass once the chunk has arrived.
    // (checkVisibility() is false for what React hides behind a Suspense fallback.)
    const whileLoading = await page.evaluate(() => {
      const h1 = document.querySelector("h1");
      return {
        heading: h1?.checkVisibility() ? h1.textContent : null,
        fallbackShown: document.body.innerText.includes("Lädt…"),
      };
    });
    expect(whileLoading).toEqual({ heading: headingBefore, fallbackShown: false });
    await expect(page.getByRole("heading", { name: "Ziele" })).toBeVisible({ timeout: 10_000 });
  });
});

import { test, expect } from "@playwright/test";
import { login, registerTestUser, syncPill } from "./support";

// Paket C: the app shell is usable from the keyboard alone.
test.describe("Tastaturbedienung", () => {
  test("Skip-Link ist der erste Tab-Stopp und springt zum Inhalt", async ({ page, request }) => {
    const user = await registerTestUser(request, "skiplink");
    await login(page, user);
    await page.goto("/");
    await expect(page.getByRole("main")).toBeVisible();
    await page.waitForLoadState("networkidle");

    // Start the Tab sequence from the top of the document, as after a fresh page load.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Zum Inhalt springen" });
    await expect(skip).toBeFocused();
    const box = await skip.boundingBox();
    expect(box && box.width > 40 && box.height > 40, "skip link visible once focused").toBeTruthy();

    await page.keyboard.press("Enter");
    await expect(page.locator("main#main-content")).toBeFocused();
    expect(new URL(page.url()).hash).toBe("");
  });

  test("Sync-Status öffnet per Enter/Leertaste und schließt per Escape mit Fokus-Rückgabe", async ({
    page,
    request,
  }) => {
    const user = await registerTestUser(request, "syncpopover");
    await login(page, user);
    await page.goto("/");
    const pill = syncPill(page);
    await expect(pill).toHaveText("Synchronisiert", { timeout: 10_000 });
    const panel = page.getByRole("dialog", { name: "Synchronisierung" });

    await pill.focus();
    await expect(pill).toHaveAttribute("aria-expanded", "false");
    await page.keyboard.press("Enter");
    await expect(panel).toBeVisible();
    await expect(pill).toHaveAttribute("aria-expanded", "true");
    await expect(pill).toHaveAttribute("aria-controls", (await panel.getAttribute("id"))!);

    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(pill).toBeFocused();
    await expect(pill).toHaveAttribute("aria-expanded", "false");

    await page.keyboard.press("Space");
    await expect(panel).toBeVisible();
    // A tap outside closes it as well.
    await page.getByRole("main").click({ position: { x: 5, y: 5 } });
    await expect(panel).toBeHidden();
  });
});

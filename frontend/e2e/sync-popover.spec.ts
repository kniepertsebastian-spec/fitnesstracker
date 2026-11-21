import { test, expect } from "@playwright/test";
import { fetchAnyExercise, login, registerTestUser, syncPill, workoutLogDialog } from "./support";

// Roadmap Paket F [M7]: the sync panel is the only way out of a failed sync, so on a phone every
// control in it must be a full touch target, and it must close with Escape (focus back on the pill).
const MIN = 44;
const EPS = 0.5;
const VIEWPORT = { width: 390, height: 844 };

test.use({ viewport: VIEWPORT });

test.describe("Sync-Popover", () => {
  test("Touch-Ziele ≥ 44 px, liegt im Viewport, schließt mit Escape", async ({ page, context, request }) => {
    const user = await registerTestUser(request, "sync-popover");
    const accessToken = await login(page, user);
    const exercise = await fetchAnyExercise(request, accessToken);
    await expect(syncPill(page)).toHaveText("Synchronisiert");

    // Two rejected sets: each gets its own retry/discard row, plus "Alle erneut versuchen".
    await context.route("**/api/workout-logs", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ message: "Simulierter Server-Fehler (E2E)" }),
        });
      } else {
        await route.continue();
      }
    });
    await page.getByRole("button", { name: "Satz", exact: true }).click();
    const form = workoutLogDialog(page);
    await form.locator('select[name="exerciseId"]').selectOption(exercise.id);
    for (const reps of [10, 11]) {
      await form.locator('input[name="reps"]').fill(String(reps));
      await form.locator('input[name="weightKg"]').fill("40");
      await form.locator('button[type="submit"]').click();
    }
    await form.getByRole("button", { name: /^(Fertig|Abbrechen)$/ }).click();
    await expect(syncPill(page)).toHaveText("2 fehlgeschlagen", { timeout: 10_000 });

    const pill = syncPill(page);
    const pillBox = (await pill.boundingBox())!;
    expect(pillBox.width, "Status-Pill breit genug").toBeGreaterThanOrEqual(MIN - EPS);
    expect(pillBox.height, "Status-Pill hoch genug").toBeGreaterThanOrEqual(MIN - EPS);

    await pill.click();
    await expect(pill).toHaveAttribute("aria-expanded", "true");
    const panel = page.getByRole("dialog", { name: "Synchronisierung" });
    await expect(panel).toBeVisible();
    await expect(panel.getByTestId("failed-mutation")).toHaveCount(2);

    const panelBox = (await panel.boundingBox())!;
    expect(panelBox.x, "Popover links im Viewport").toBeGreaterThanOrEqual(0);
    expect(panelBox.x + panelBox.width, "Popover rechts im Viewport").toBeLessThanOrEqual(VIEWPORT.width);

    const buttons = panel.getByRole("button");
    await expect(buttons).toHaveCount(5);
    const undersized: string[] = [];
    for (const button of await buttons.all()) {
      const box = (await button.boundingBox())!;
      if (box.width < MIN - EPS || box.height < MIN - EPS) {
        undersized.push(`"${(await button.textContent())?.trim()}" ${Math.round(box.width)}×${Math.round(box.height)}`);
      }
    }
    expect(undersized, undersized.join("\n")).toEqual([]);

    // Escape closes the panel and returns focus to the pill — also when focus was inside it.
    await panel.getByRole("button", { name: "Erneut versuchen" }).first().focus();
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(pill).toHaveAttribute("aria-expanded", "false");
    await expect(pill).toBeFocused();

    // Keyboard reopens it; a tap outside closes it again.
    await page.keyboard.press("Enter");
    await expect(panel).toBeVisible();
    await page.mouse.click(VIEWPORT.width / 2, VIEWPORT.height / 2);
    await expect(panel).toBeHidden();
  });
});

import { test, expect } from "@playwright/test";
import { fetchAnyExercise, login, openHistory, registerTestUser, serverWorkoutLogs, workoutLogDialog } from "./support";

// Training nachtragen: sets can be logged for a past day when the tracker was not running.
test.describe("Training nachtragen", () => {
  test("Satz für gestern nachtragen landet in der Historie, nicht unter Heute", async ({ page, request }) => {
    const user = await registerTestUser(request, "backfill");
    const token = await login(page, user);
    const exercise = await fetchAnyExercise(request, token);

    // The history is browsed from the Verlauf tab; with nothing logged yet it still offers the entry.
    await openHistory(page);
    await page.getByRole("button", { name: "Nachtragen", exact: true }).click();

    const dialog = workoutLogDialog(page);
    await expect(dialog.getByRole("heading", { name: "Satz nachtragen" })).toBeVisible();
    // Opens on yesterday, the likeliest case.
    await expect(dialog.getByRole("radio", { name: "Gestern" })).toHaveAttribute("aria-checked", "true");

    await dialog.locator('select[name="exerciseId"]').selectOption(exercise.id);
    await dialog.locator('input[name="reps"]').fill("8");
    await dialog.locator('input[name="weightKg"]').fill("60");
    await dialog.locator('button[type="submit"]').click();
    await expect(dialog.getByText("1 Satz gespeichert")).toBeVisible();

    // A second set of the same exercise continues the numbering on that day and keeps the time.
    await expect(dialog.locator('input[name="setNumber"]')).toHaveValue("2");
    await dialog.locator('input[name="reps"]').fill("7");
    await dialog.locator('button[type="submit"]').click();
    await expect(dialog.getByText("2 Sätze gespeichert")).toBeVisible();
    await dialog.getByRole("button", { name: "Fertig" }).click();

    // Stamped yesterday evening on the server (18:00 local), not "now".
    await expect.poll(async () => (await serverWorkoutLogs(request, token)).length).toBe(2);
    const logs = (await serverWorkoutLogs(request, token)) as unknown as Array<{ performedAt: string; setNumber: number }>;
    for (const log of logs) {
      const ageHours = (Date.now() - new Date(log.performedAt).getTime()) / 3_600_000;
      expect(ageHours).toBeGreaterThan(5);
      expect(ageHours).toBeLessThan(43);
    }

    // The history shows the day it was entered for.
    await expect(page.getByRole("heading", { name: "Gestern" })).toBeVisible();

    // And the diary's "Heute" list stays empty.
    await page.getByRole("navigation", { name: "Tagebuch" }).getByRole("link", { name: "Heute" }).click();
    await page.waitForURL("**/diary");
    await expect(page.getByRole("heading", { name: "Fitnesstagebuch" })).toBeVisible();
    await expect(page.getByRole("button", { name: /bearbeiten/ })).toHaveCount(0);
  });

  test("Zeitpunkt in der Zukunft wird abgelehnt", async ({ page, request }) => {
    const user = await registerTestUser(request, "backfill-future");
    const token = await login(page, user);
    const exercise = await fetchAnyExercise(request, token);

    await openHistory(page);
    await page.getByRole("button", { name: "Nachtragen", exact: true }).click();
    const dialog = workoutLogDialog(page);
    await dialog.locator('select[name="exerciseId"]').selectOption(exercise.id);

    const tomorrow = new Date(Date.now() + 86_400_000);
    const pad = (n: number) => String(n).padStart(2, "0");
    await dialog.getByLabel("Datum").fill(`${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`);
    await dialog.locator('button[type="submit"]').click();

    await expect(dialog.getByText("Der Zeitpunkt liegt in der Zukunft.")).toBeVisible();
    expect(await serverWorkoutLogs(request, token)).toHaveLength(0);
  });
});

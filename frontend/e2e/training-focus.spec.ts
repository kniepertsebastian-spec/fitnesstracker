import { test, expect } from "@playwright/test";
import { registerTestUser, fetchAnyExercise, login, goOffline, goOnline, openNav, syncPill, serverWorkoutLogs } from "./support";

const API_URL = process.env.E2E_API_URL ?? "http://localhost:3000/api";

test.describe("Training im Fokusmodus (F4)", () => {
  test("komplettes Training offline: Start → Sätze → Pause → Abschluss → online → Sync", async ({
    page,
    context,
    request,
  }) => {
    const user = await registerTestUser(request, "focus");
    const accessToken = await login(page, user);
    const exercise = await fetchAnyExercise(request, accessToken);
    const auth = { Authorization: `Bearer ${accessToken}` };

    // One plan exercise for the current phase, two planned sets.
    const plan = await (await request.get(`${API_URL}/training-plan`, { headers: auth })).json();
    const created = await request.post(`${API_URL}/plan-exercises`, {
      headers: auth,
      data: { phase: plan.currentPhase, exerciseId: exercise.id, targetSets: 2, targetReps: 8 },
    });
    expect(created.ok(), await created.text()).toBeTruthy();

    // Back to the dashboard (client-side, so the in-memory token survives) and into the focus mode.
    await openNav(page, "Dashboard");
    await page.getByRole("button", { name: /Training starten/ }).first().click();
    await page.waitForURL("/training");
    await expect(page.getByRole("heading", { name: exercise.name })).toBeVisible();
    // No shell navigation in focus mode.
    await expect(page.getByRole("navigation", { name: "Hauptmenü" })).toHaveCount(0);

    await goOffline(page, context);

    // A set is one tap: plan values are pre-filled, ticking logs it.
    await page.getByRole("button", { name: "Satz 1 abhaken" }).click();
    await expect(page.getByRole("button", { name: "Satz 1 rückgängig" })).toBeVisible();
    // Satzpause starts as a card under the exercise.
    await expect(page.getByRole("timer", { name: "Satzpause" })).toBeVisible();
    await expect(syncPill(page)).toContainText("Offline");

    await page.getByRole("button", { name: "Satz 2 abhaken" }).click();
    await expect(page.getByRole("button", { name: "Satz 2 rückgängig" })).toBeVisible();

    await page.getByRole("button", { name: "Training abschließen" }).click();
    await expect(page.getByText("Training abgeschlossen", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Zur Historie" })).toBeVisible();

    await goOnline(page, context);
    await expect
      .poll(async () => (await serverWorkoutLogs(request, accessToken)).filter((l) => l.exerciseId === exercise.id).length, {
        timeout: 15_000,
      })
      .toBe(2);

    const open = await request.get(`${API_URL}/workout-sessions/open`, { headers: auth });
    expect(await open.json()).toBeNull();
  });
});

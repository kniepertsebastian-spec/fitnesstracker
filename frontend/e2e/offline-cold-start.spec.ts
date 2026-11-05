import { test, expect } from "@playwright/test";
import { fetchAnyExercise, goOffline, goOnline, login, openNav, registerTestUser, serverWorkoutLogs } from "./support";

const API_URL = process.env.E2E_API_URL ?? "http://localhost:3000/api";

// roadmap3 P1.2: the plan is cached across reloads, so the app opened without signal (in the
// gym basement, after the OS killed it) can still start a workout from the plan.
test.describe("Offline-Kaltstart", () => {
  test("App offline neu laden → Training aus dem Plan starten → Satz → online → Sync", async ({
    page,
    context,
    request,
  }) => {
    const user = await registerTestUser(request, "coldstart");
    const accessToken = await login(page, user);
    const exercise = await fetchAnyExercise(request, accessToken);
    const auth = { Authorization: `Bearer ${accessToken}` };

    const plan = await (await request.get(`${API_URL}/training-plan`, { headers: auth })).json();
    const created = await request.post(`${API_URL}/plan-exercises`, {
      headers: auth,
      data: { phase: plan.currentPhase, exerciseId: exercise.id, targetSets: 2, targetReps: 8 },
    });
    expect(created.ok(), await created.text()).toBeTruthy();

    // Load the dashboard online once (plan + weekly status), then give the throttled persister
    // time to write the cache.
    await openNav(page, "Dashboard");
    await expect(page.getByText(exercise.name).first()).toBeVisible();
    await page.waitForTimeout(3000);

    await goOffline(page, context);
    await page.reload();
    await expect(page.getByText(exercise.name).first()).toBeVisible();

    await page.getByRole("button", { name: /Training starten/ }).first().click();
    await page.waitForURL("/training");
    await expect(page.getByRole("heading", { name: exercise.name })).toBeVisible();
    await page.getByRole("button", { name: "Satz 1 abhaken" }).click();
    await expect(page.getByRole("button", { name: "Satz 1 rückgängig" })).toBeVisible();

    await goOnline(page, context);
    await expect
      .poll(async () => (await serverWorkoutLogs(request, accessToken)).filter((l) => l.exerciseId === exercise.id).length, {
        timeout: 15_000,
      })
      .toBe(1);
  });
});

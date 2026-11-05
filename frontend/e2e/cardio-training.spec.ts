import { test, expect } from "@playwright/test";
import { fetchAnyExercise, goOffline, goOnline, login, openNav, registerTestUser, syncPill } from "./support";

const API_URL = process.env.E2E_API_URL ?? "http://localhost:3000/api";

// F9: the training view walks Aufwärmen → Kraft → Cardio → Dehnen, and cardio entries go through
// their own offline queue. This covers the part that matters in a gym without signal: a warm-up
// saved offline shows as pending, reaches the server exactly once after going online, and the
// view moves on to the strength part.
test.describe("Training mit Cardio (F9)", () => {
  test("Aufwärmen offline speichern, wieder online, genau ein Eintrag am Server", async ({ page, context, request }) => {
    const user = await registerTestUser(request, "cardio");
    const token = await login(page, user);
    const auth = { Authorization: `Bearer ${token}` };

    // A one-exercise plan in the current phase plus a goal, so the rule suggests a warm-up.
    const planRes = await request.get(`${API_URL}/training-plan`, { headers: auth });
    expect(planRes.ok()).toBeTruthy();
    const { currentPhase } = await planRes.json();
    const exercise = await fetchAnyExercise(request, token);
    const addRes = await request.post(`${API_URL}/plan-exercises`, {
      headers: auth,
      data: { phase: currentPhase, exerciseId: exercise.id, targetSets: 2, targetReps: 8 },
    });
    expect(addRes.ok(), await addRes.text()).toBeTruthy();
    const goalRes = await request.patch(`${API_URL}/training-plan/goal`, { headers: auth, data: { goal: "MUSCLE_GAIN" } });
    expect(goalRes.ok(), await goalRes.text()).toBeTruthy();
    expect((await goalRes.json()).trainingGoal).toBe("MUSCLE_GAIN");

    const cardioPlanRes = await request.get(`${API_URL}/cardio/plan`, { headers: auth });
    expect(cardioPlanRes.ok()).toBeTruthy();
    const cardioPlan = await cardioPlanRes.json();
    const warmup = cardioPlan.days[0].items.find((i: { slot: string }) => i.slot === "WARMUP");
    expect(warmup, "the rule should plan a warm-up").toBeTruthy();

    await openNav(page, "Dashboard");
    await page.waitForURL("/");
    await page.getByRole("button", { name: "Training starten" }).first().click();
    await page.waitForURL("/training");

    const stages = page.getByRole("navigation", { name: "Ablauf des Trainings" });
    await expect(stages).toBeVisible();
    await expect(stages).toContainText("Aufwärmen");
    await expect(stages).toContainText("Cardio");
    const save = page.getByRole("button", { name: "Cardio speichern" });
    await expect(save).toBeVisible();

    await goOffline(page, context);
    await expect(syncPill(page)).toHaveText("Offline");
    await save.click();
    await expect(syncPill(page)).toHaveText("Offline · 1 ausstehend");
    // Warm-up done → the view continues with the strength part.
    await expect(page.getByRole("button", { name: "Satz 1 abhaken" }).first()).toBeVisible();

    await goOnline(page, context);
    await expect(syncPill(page)).toHaveText("Synchronisiert", { timeout: 10_000 });

    const logsRes = await request.get(`${API_URL}/cardio-logs`, { headers: auth });
    expect(logsRes.ok()).toBeTruthy();
    const { items } = await logsRes.json();
    expect(items, "exactly one cardio entry should have reached the server").toHaveLength(1);
    expect(items[0].durationMinutes).toBe(warmup.durationMinutes);
    expect(items[0].machine).toBe(warmup.machine);
    expect(items[0].clientId).toBeTruthy();
  });
});

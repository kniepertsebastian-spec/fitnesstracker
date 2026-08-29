import { test, expect } from "@playwright/test";
import {
  registerTestUser,
  fetchAnyExercise,
  login,
  goOffline,
  goOnline,
  syncPill,
  workoutLogDialog,
  serverWorkoutLogs,
  type E2eUser,
} from "./support";

// No `test.describe.configure({ mode: "serial" })` here: playwright.config.ts's `workers: 1` +
// `fullyParallel: false` already keep every test in this file running one at a time — `serial`
// mode on top of that does something different and unwanted (it was tried and reverted): it ties
// every describe block in the file into one chain where a single failure skips the rest and a
// retry restarts the *whole* chain from its first test, even though these four scenarios are
// otherwise fully independent (separate registered users, no shared state).

async function openCreateDialog(page: import("@playwright/test").Page) {
  await page.locator('button', { hasText: '+ Satz' }).click();
}

async function fillAndSubmit(
  page: import("@playwright/test").Page,
  opts: { exerciseId?: string; reps: number; weightKg: number },
) {
  const dialog = workoutLogDialog(page);
  if (opts.exerciseId) {
    await dialog.locator('select[name="exerciseId"]').selectOption(opts.exerciseId);
  }
  await dialog.locator('input[name="reps"]').fill(String(opts.reps));
  await dialog.locator('input[name="weightKg"]').fill(String(opts.weightKg));
  await dialog.locator('button[type="submit"]').click();
}

// Create-mode "Speichern" stays open (see the savedCount comment in WorkoutLogFormDialog.tsx —
// lets several sets get logged without reopening/reselecting the exercise each time), so a
// create needs this explicit close. An edit's "Speichern" calls onClose() itself on success —
// closeDialog after an edit would race that self-close and click a button already detaching from
// the DOM, so edits below never call this.
async function closeDialog(page: import("@playwright/test").Page) {
  await workoutLogDialog(page).locator('button', { hasText: /Fertig|Abbrechen/ }).click();
}

async function editWeight(page: import("@playwright/test").Page, exerciseName: string, weightKg: number) {
  await rowFor(page, exerciseName).locator('button', { hasText: "Bearbeiten" }).click();
  const dialog = workoutLogDialog(page);
  await dialog.locator('input[name="weightKg"]').fill(String(weightKg));
  await dialog.locator('button[type="submit"]').click();
  await expect(dialog).toHaveCount(0);
}

function rowFor(page: import("@playwright/test").Page, exerciseName: string) {
  return page.locator("table tr", { hasText: exerciseName }).first();
}

test.describe("Kritischer Offline-Flow", () => {
  let user: E2eUser;

  test.beforeAll(async ({ request }) => {
    user = await registerTestUser(request, "critical");
  });

  test("Login, offline erstellen/bearbeiten, Reload, wieder online, Server-State", async ({
    page,
    context,
    request,
  }) => {
    let accessToken = "";

    await test.step("Login", async () => {
      accessToken = await login(page, user);
      await expect(syncPill(page)).toHaveText("Synchronisiert");
    });

    const exercise = await fetchAnyExercise(request, accessToken);

    await test.step("Offline gehen", async () => {
      await goOffline(page, context);
      await expect(syncPill(page)).toHaveText("Offline");
    });

    await test.step("Workout erstellen (offline)", async () => {
      await openCreateDialog(page);
      await fillAndSubmit(page, { exerciseId: exercise.id, reps: 12, weightKg: 41 });
      await closeDialog(page);

      const row = rowFor(page, exercise.name);
      await expect(row).toContainText("⏳");
      await expect(syncPill(page)).toHaveText("Offline · 1 ausstehend");
    });

    await test.step("Workout bearbeiten (offline)", async () => {
      await editWeight(page, exercise.name, 45);

      await expect(rowFor(page, exercise.name)).toContainText("45");
      // Editing a still-unsynced create coalesces into the same single pending mutation rather
      // than queuing a second one — see enqueueMutation in offline/workoutLogSync.ts.
      await expect(syncPill(page)).toHaveText("Offline · 1 ausstehend");
    });

    await test.step("App neu laden (offline)", async () => {
      await page.reload();
      await expect(syncPill(page)).toHaveText("Offline · 1 ausstehend");
    });

    await test.step("Lokale Daten prüfen", async () => {
      const row = rowFor(page, exercise.name);
      await expect(row).toContainText("45");
      await expect(row).toContainText("⏳");
    });

    await test.step("Online gehen", async () => {
      await goOnline(page, context);
      await expect(syncPill(page)).toHaveText("Synchronisiert", { timeout: 10_000 });
    });

    await test.step("Server-State prüfen", async () => {
      const logs = await serverWorkoutLogs(request, accessToken);
      const match = logs.find((l) => l.exerciseId === exercise.id && l.weightKg === 45);
      expect(match, "synced log with the edited weight should exist server-side").toBeTruthy();
      expect(match?.reps).toBe(12);
    });
  });
});

test.describe("Mehrere Offline-Änderungen und Mutation Coalescing", () => {
  let user: E2eUser;

  test.beforeAll(async ({ request }) => {
    user = await registerTestUser(request, "coalescing");
  });

  test("mehrfaches Bearbeiten offline erzeugt nur eine synchronisierte Version", async ({
    page,
    context,
    request,
  }) => {
    const accessToken = await login(page, user);
    const exercise = await fetchAnyExercise(request, accessToken);

    await goOffline(page, context);
    await openCreateDialog(page);
    await fillAndSubmit(page, { exerciseId: exercise.id, reps: 8, weightKg: 51 });
    await closeDialog(page);
    await expect(rowFor(page, exercise.name)).toContainText("51");
    await expect(syncPill(page)).toHaveText("Offline · 1 ausstehend");

    // Three rapid edits to the same not-yet-synced row while still offline. Asserting the row's
    // displayed value after each edit (not just that the dialog closed) matters here: the next
    // iteration clicks "Bearbeiten" on that same row again, and without confirming the previous
    // edit has actually landed first, that click could hit the row mid-update.
    for (const weight of [52, 53, 54]) {
      await editWeight(page, exercise.name, weight);
      await expect(rowFor(page, exercise.name)).toContainText(String(weight));
      // Still exactly one pending mutation — coalescing, not queuing a fourth entry.
      await expect(syncPill(page)).toHaveText("Offline · 1 ausstehend");
    }

    await goOnline(page, context);
    await expect(syncPill(page)).toHaveText("Synchronisiert", { timeout: 10_000 });

    const logs = await serverWorkoutLogs(request, accessToken);
    const matches = logs.filter((l) => l.exerciseId === exercise.id && l.reps === 8);
    expect(matches, "only the final coalesced value should have reached the server").toHaveLength(1);
    expect(matches[0].weightKg).toBe(54);
  });
});

test.describe("Create + Delete offline", () => {
  let user: E2eUser;

  test.beforeAll(async ({ request }) => {
    user = await registerTestUser(request, "createdelete");
  });

  test("ein Satz, der offline erstellt und wieder gelöscht wird, erreicht den Server nie", async ({
    page,
    context,
    request,
  }) => {
    const accessToken = await login(page, user);
    const exercise = await fetchAnyExercise(request, accessToken);

    await goOffline(page, context);
    await openCreateDialog(page);
    await fillAndSubmit(page, { exerciseId: exercise.id, reps: 9, weightKg: 61 });
    await closeDialog(page);
    await expect(syncPill(page)).toHaveText("Offline · 1 ausstehend");

    await rowFor(page, exercise.name).locator('button', { hasText: "Löschen" }).click();
    await expect(rowFor(page, exercise.name)).toHaveCount(0);
    // A delete of a mutation that was never synced just cancels the pending create outright —
    // there's nothing for the server to delete, so the queue empties immediately.
    await expect(syncPill(page)).toHaveText("Offline");

    await goOnline(page, context);
    await expect(syncPill(page)).toHaveText("Synchronisiert", { timeout: 10_000 });

    const logs = await serverWorkoutLogs(request, accessToken);
    const match = logs.find((l) => l.exerciseId === exercise.id && l.weightKg === 61);
    expect(match, "a create+delete that both happened offline should never reach the server").toBeUndefined();
  });
});

test.describe("Sync-Fehler", () => {
  let user: E2eUser;

  test.beforeAll(async ({ request }) => {
    user = await registerTestUser(request, "syncerror");
  });

  test("ein fehlgeschlagener Sync wird angezeigt und lässt sich erneut versuchen", async ({
    page,
    context,
    request,
  }) => {
    const accessToken = await login(page, user);
    const exercise = await fetchAnyExercise(request, accessToken);

    let block = true;
    await context.route("**/api/workout-logs", async (route) => {
      if (route.request().method() === "POST" && block) {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ message: "Simulierter Server-Fehler (E2E)" }),
        });
      } else {
        await route.continue();
      }
    });

    await openCreateDialog(page);
    await fillAndSubmit(page, { exerciseId: exercise.id, reps: 7, weightKg: 71 });
    await closeDialog(page);

    await expect(syncPill(page)).toHaveText("1 fehlgeschlagen", { timeout: 10_000 });
    await syncPill(page).click();
    // Each failed item's card in SyncStatusIndicator.tsx — its label/retry row and its reason
    // text are siblings, so scope to the whole card rather than a bare hasText div filter (which
    // would just as happily match the inner row alone and miss the reason).
    const failedItemCard = page.locator("div.rounded-lg.bg-ink-800.p-2").last();
    await expect(failedItemCard).toContainText("Simulierter Server-Fehler (E2E)");

    block = false;
    await page.locator("button", { hasText: "Erneut versuchen" }).first().click();
    await expect(syncPill(page)).toHaveText("Synchronisiert", { timeout: 10_000 });

    const logs = await serverWorkoutLogs(request, accessToken);
    const match = logs.find((l) => l.exerciseId === exercise.id && l.weightKg === 71);
    expect(match, "the retried mutation should have reached the server after the block lifted").toBeTruthy();
  });
});

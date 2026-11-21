import { test, expect, type APIRequestContext } from "@playwright/test";
import { goOffline, goOnline, login, openNav, registerTestUser, skipPreStretchIfShown, syncPill } from "./support";

const API_URL = process.env.E2E_API_URL ?? "http://localhost:3000/api";

// Roadmap Paket F [M3]: a permanent plan change made offline in focus mode ("Dauerhaft im Plan")
// is queued in planEditSync.ts. It has to show up in the sync indicator like a pending set, the
// logout dialog has to warn about it, and it has to reach the server once the device is online.

async function twoExercises(request: APIRequestContext, auth: Record<string, string>) {
  const res = await request.get(`${API_URL}/exercises?limit=2`, { headers: auth });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  const items: Array<{ id: string; name: string }> = Array.isArray(body) ? body : body.items;
  expect(items.length).toBeGreaterThanOrEqual(2);
  return items.slice(0, 2);
}

test.describe("Planänderung ohne Verbindung", () => {
  test("wird im Sync-Indikator gezählt, beim Abmelden gewarnt und online gespeichert", async ({
    page,
    context,
    request,
  }) => {
    const user = await registerTestUser(request, "offline-plan");
    const accessToken = await login(page, user);
    const auth = { Authorization: `Bearer ${accessToken}` };

    const plan = await (await request.get(`${API_URL}/training-plan`, { headers: auth })).json();
    const phase = plan.currentPhase as string;
    const [first, second] = await twoExercises(request, auth);
    for (const exercise of [first, second]) {
      const created = await request.post(`${API_URL}/plan-exercises`, {
        headers: auth,
        data: { phase, exerciseId: exercise.id, targetSets: 2, targetReps: 8 },
      });
      expect(created.ok(), await created.text()).toBeTruthy();
    }
    const planIds = async () => {
      const res = await request.get(`${API_URL}/plan-exercises?phase=${phase}`, { headers: auth });
      expect(res.ok()).toBeTruthy();
      return ((await res.json()).items as Array<{ exerciseId: string }>).map((p) => p.exerciseId);
    };
    expect(await planIds()).toEqual(expect.arrayContaining([first.id, second.id]));

    await openNav(page, "Dashboard");
    await page.getByRole("button", { name: /Training starten/ }).first().click();
    await page.waitForURL("/training");
    await skipPreStretchIfShown(page);
    // Starting the workout is itself a sync; only count what the plan change adds.
    await expect(syncPill(page)).toHaveText("Synchronisiert", { timeout: 10_000 });

    await goOffline(page, context);
    await expect(syncPill(page)).toHaveText("Offline");

    await test.step("Übung offline dauerhaft aus dem Plan entfernen", async () => {
      await page.getByRole("button", { name: "Anpassen" }).click();
      await page.getByRole("radio", { name: "Dauerhaft im Plan" }).click();
      await page.getByRole("button", { name: `${second.name} entfernen` }).click();
      await expect(page.getByRole("button", { name: `${second.name} entfernen` })).toHaveCount(0);
      await expect(syncPill(page)).toHaveText("Offline · 1 ausstehend");
    });

    await test.step("Abmelden warnt vor der ausstehenden Änderung", async () => {
      await page.getByRole("button", { name: "Fertig" }).click();
      await page.getByRole("button", { name: "Abbrechen", exact: true }).click();
      await page.getByRole("dialog", { name: "Training verlassen?" }).getByRole("button", { name: "Pausieren" }).click();
      await page.waitForURL("/");
      // Pausing offline queues its own status change, so at least the plan change is pending.
      await expect(syncPill(page)).toHaveText(/^Offline · \d+ ausstehend$/);

      await page.getByRole("button", { name: "Abmelden" }).filter({ visible: true }).first().click();
      const dialog = page.getByRole("dialog", { name: "Abmelden?" });
      await expect(dialog).toContainText("noch nicht synchronisiert");
      await expect(dialog).toContainText("Du bist offline");
      await dialog.getByRole("button", { name: "Abbrechen" }).click();
      await expect(dialog).toBeHidden();
      await expect(page).not.toHaveURL(/\/login/);
    });

    await test.step("Online wird die Änderung gespeichert", async () => {
      await goOnline(page, context);
      await expect(syncPill(page)).toHaveText("Synchronisiert", { timeout: 15_000 });
      await expect.poll(planIds, { timeout: 15_000 }).not.toContain(second.id);
      expect(await planIds()).toContain(first.id);
    });
  });
});

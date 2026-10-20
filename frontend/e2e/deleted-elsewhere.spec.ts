import { test, expect } from "@playwright/test";
import { fetchAnyExercise, login, openNav, registerTestUser } from "./support";

const API_URL = process.env.E2E_API_URL ?? "http://localhost:3000/api";

// roadmap3 P1.4: a set deleted on another device must also disappear from this device's local
// cache — before, a synced row stayed in IndexedDB forever once the server stopped listing it.
test.describe("Löschen auf anderem Gerät", () => {
  test("ein anderswo gelöschter Satz verschwindet aus dem lokalen Cache", async ({ page, request }) => {
    const user = await registerTestUser(request, "deleted-elsewhere");
    const accessToken = await login(page, user);
    const auth = { Authorization: `Bearer ${accessToken}` };
    const exercise = await fetchAnyExercise(request, accessToken);

    const created = await request.post(`${API_URL}/workout-logs`, {
      headers: auth,
      data: { clientId: crypto.randomUUID(), exerciseId: exercise.id, setNumber: 1, reps: 8, weightKg: 50 },
    });
    expect(created.ok(), await created.text()).toBeTruthy();
    const log = await created.json();

    await openNav(page, "Historie");
    // The day's exercise group in the history (not the exercise filter's <option>).
    const group = () => page.getByRole("main").getByRole("button", { name: exercise.name, exact: false });
    await expect(group().first()).toBeVisible();

    // "The other device" deletes it.
    const deleted = await request.delete(`${API_URL}/workout-logs/${log.id}`, { headers: auth });
    expect(deleted.ok()).toBeTruthy();

    await openNav(page, "Dashboard");
    await openNav(page, "Historie");
    await expect(group()).toHaveCount(0);
  });
});

import { test, expect } from "@playwright/test";
import { fetchAnyExercise, login, openNav, registerTestUser } from "./support";

const API_URL = process.env.E2E_API_URL ?? "http://localhost:3000/api";

// roadmap3 P2.1: after the first full download only what changed is fetched, not the whole
// history on every app start.
test.describe("Delta-Sync der Satz-Historie", () => {
  test("erst Vollabruf, danach nur noch Änderungen", async ({ page, request }) => {
    const user = await registerTestUser(request, "delta");
    const apiLogin = await request.post(`${API_URL}/auth/login`, { data: { email: user.email, password: user.password } });
    const token = (await apiLogin.json()).accessToken as string;
    const auth = { Authorization: `Bearer ${token}` };
    const exercise = await fetchAnyExercise(request, token);

    // A history worth not re-downloading.
    const HISTORY = 30;
    for (let i = 0; i < HISTORY; i++) {
      const res = await request.post(`${API_URL}/workout-logs`, {
        headers: auth,
        data: {
          clientId: crypto.randomUUID(),
          exerciseId: exercise.id,
          setNumber: (i % 3) + 1,
          reps: 8,
          weightKg: 50,
          performedAt: new Date(Date.now() - (i + 2) * 86_400_000).toISOString(),
        },
      });
      expect(res.ok(), await res.text()).toBeTruthy();
    }

    // Rows written within the delta's 5 s overlap window are deliberately sent again. A real
    // history is days old, so let the seeded sets age out of that window before the first load.
    await page.waitForTimeout(6_000);

    const listCalls: { url: string; items: number; deleted: number }[] = [];
    page.on("response", async (response) => {
      const url = new URL(response.url());
      if (url.pathname !== "/api/workout-logs" || response.request().method() !== "GET") return;
      const body = await response.json();
      listCalls.push({ url: response.url(), items: body.items.length, deleted: body.deletedClientIds.length });
    });

    await login(page, user);
    await expect.poll(() => listCalls.length).toBeGreaterThanOrEqual(1);
    // The first download is the full history.
    expect(listCalls[0].url).not.toContain("updatedSince");
    expect(listCalls[0].items).toBe(HISTORY);

    // Changes made elsewhere: one new set, one deleted set. (Earlier delta requests, e.g. from
    // the diary remounting during login, saw nothing yet — only look at those that follow.)
    const callsBeforeChanges = listCalls.length;
    const created = await request.post(`${API_URL}/workout-logs`, {
      headers: auth,
      data: { clientId: crypto.randomUUID(), exerciseId: exercise.id, setNumber: 1, reps: 9, weightKg: 52 },
    });
    expect(created.ok()).toBeTruthy();
    const listed = await (await request.get(`${API_URL}/workout-logs`, { headers: auth })).json();
    const victim = listed.items.find((l: { weightKg: number }) => l.weightKg === 50);
    expect((await request.delete(`${API_URL}/workout-logs/${victim.id}`, { headers: auth })).ok()).toBeTruthy();

    // Back to a screen that reads the history (client-side, so the in-memory token survives).
    await openNav(page, "Historie");
    await expect
      .poll(() => listCalls.slice(callsBeforeChanges).some((c) => c.url.includes("updatedSince")))
      .toBeTruthy();
    const delta = listCalls.slice(callsBeforeChanges).find((c) => c.url.includes("updatedSince"))!;
    // Two changes out of 31 rows — not the history again.
    expect(delta.items).toBe(1);
    expect(delta.deleted).toBe(1);
  });
});

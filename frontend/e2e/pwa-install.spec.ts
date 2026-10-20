import { test, expect } from "@playwright/test";
import { fetchAnyExercise, login, registerTestUser } from "./support";

const API_URL = process.env.E2E_API_URL ?? "http://localhost:3000/api";

// roadmap3 P2.4/P2.5: what the OS and browser need to install the app properly.
test.describe("Installierbarkeit", () => {
  test("Manifest: Sprache, Identität, Shortcuts und Screenshots mit echten Abmessungen", async ({ request, baseURL }) => {
    const res = await request.get("/manifest.webmanifest");
    expect(res.ok()).toBeTruthy();
    expect(res.headers()["content-type"]).toContain("manifest+json");
    const manifest = await res.json();

    expect(manifest.lang).toBe("de");
    expect(manifest.id).toBe("/");
    expect(manifest.shortcuts.map((s: { url: string }) => s.url)).toEqual(["/training?start=1", "/daily", "/progress"]);

    // Every screenshot must exist and be exactly as big as declared — Chrome drops the whole
    // rich install dialog for a mismatch. Chrome also wants at least one narrow and one wide.
    const forms = new Set<string>();
    for (const shot of manifest.screenshots as { src: string; sizes: string; type: string; form_factor: string }[]) {
      forms.add(shot.form_factor);
      const img = await request.get(new URL(shot.src, baseURL).toString());
      expect(img.ok(), shot.src).toBeTruthy();
      const png = await img.body();
      // PNG: IHDR holds width/height at bytes 16..23.
      const size = `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`;
      expect(size, shot.src).toBe(shot.sizes);
      const [w, h] = size.split("x").map(Number);
      expect(Math.max(w, h) / Math.min(w, h), `${shot.src} aspect ratio`).toBeLessThanOrEqual(2.3);
      expect(shot.form_factor === "narrow" ? h > w : w > h, `${shot.src} orientation`).toBeTruthy();
    }
    expect(forms).toEqual(new Set(["narrow", "wide"]));

    for (const icon of [...manifest.icons, ...manifest.shortcuts.flatMap((s: { icons: unknown[] }) => s.icons)] as { src: string }[]) {
      expect((await request.get(new URL(icon.src, baseURL).toString())).ok(), icon.src).toBeTruthy();
    }
    const apple = await request.get("/icons/apple-touch-icon.png");
    const appleBody = await apple.body();
    expect(`${appleBody.readUInt32BE(16)}x${appleBody.readUInt32BE(20)}`).toBe("180x180");
  });

  test("Shortcut „Training starten“ startet die Einheit und verbraucht den Parameter", async ({ page, request }) => {
    const user = await registerTestUser(request, "shortcut");
    const accessToken = await login(page, user);
    const auth = { Authorization: `Bearer ${accessToken}` };
    const exercise = await fetchAnyExercise(request, accessToken);
    const plan = await (await request.get(`${API_URL}/training-plan`, { headers: auth })).json();
    const created = await request.post(`${API_URL}/plan-exercises`, {
      headers: auth,
      data: { phase: plan.currentPhase, exerciseId: exercise.id, targetSets: 2, targetReps: 8 },
    });
    expect(created.ok(), await created.text()).toBeTruthy();

    const openSession = async () => (await request.get(`${API_URL}/workout-sessions/open`, { headers: auth })).json();
    expect(await openSession()).toBeNull();

    // A cold launch from the home-screen icon: full page load, the session cookie signs in.
    await page.goto("/training?start=1");
    await expect(page.getByRole("heading", { name: exercise.name })).toBeVisible();
    await expect.poll(() => new URL(page.url()).search).toBe("");
    await expect.poll(async () => (await openSession())?.clientId ?? null).not.toBeNull();
    const first = (await openSession()).clientId;

    // The parameter is gone: reloading continues the same session, it doesn't start another.
    await page.reload();
    await expect(page.getByRole("heading", { name: exercise.name })).toBeVisible();
    expect((await openSession()).clientId).toBe(first);
  });

  test("dauerhafter Speicher wird nach dem Login angefragt, aber nicht bei jedem Start", async ({ page, request }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __persistCalls: number };
      w.__persistCalls = 0;
      Object.defineProperty(navigator, "storage", {
        configurable: true,
        value: {
          persisted: async () => false,
          persist: async () => {
            w.__persistCalls += 1;
            return false; // refused — must not be asked again right away
          },
        },
      });
    });
    const user = await registerTestUser(request, "persist");
    await login(page, user);
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __persistCalls: number }).__persistCalls))
      .toBe(1);

    await page.reload();
    await expect(page.getByRole("main")).toBeVisible();
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => (window as unknown as { __persistCalls: number }).__persistCalls)).toBe(0);
  });
});

import { test, expect } from "@playwright/test";
import { fetchAnyExercise, login, registerTestUser } from "./support";

const API_URL = process.env.E2E_API_URL ?? "http://localhost:3000/api";

// A large system font or display size shrinks the CSS viewport on phones to ~320 px. Every page
// must still fit without horizontal scrolling — a single fixed-width element makes Chrome zoom
// the whole page out (roadmap3 P1.1).
const ROUTES = [
  "/",
  "/daily",
  "/diary",
  "/history",
  "/exercises",
  "/plan",
  "/plan/generate",
  "/progress",
  "/goals",
  "/nutrition",
  "/settings",
  "/stretching",
  "/training",
];

test.describe("Schmale Displays", () => {
  test.use({ viewport: { width: 320, height: 720 } });

  test("keine Seite ist breiter als 320 px", async ({ page, request }) => {
    const user = await registerTestUser(request, "narrow");
    const accessToken = await login(page, user);
    const auth = { Authorization: `Bearer ${accessToken}` };

    // Some plan content, so the dashboard, plan and training views render their full layout.
    const exercise = await fetchAnyExercise(request, accessToken);
    const plan = await (await request.get(`${API_URL}/training-plan`, { headers: auth })).json();
    const created = await request.post(`${API_URL}/plan-exercises`, {
      headers: auth,
      data: { phase: plan.currentPhase, exerciseId: exercise.id, targetSets: 3, targetReps: 10 },
    });
    expect(created.ok(), await created.text()).toBeTruthy();

    for (const route of ROUTES) {
      // Client-side navigation keeps the in-memory access token.
      await page.evaluate((path) => {
        window.history.pushState({}, "", path);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }, route);
      await page.waitForLoadState("networkidle");
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth, `${route} ist ${scrollWidth} px breit`).toBeLessThanOrEqual(320);
    }
  });
});

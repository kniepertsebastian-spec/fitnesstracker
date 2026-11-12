import { test, expect } from "@playwright/test";
import { login, openNav, registerTestUser } from "./support";

const API_URL = process.env.E2E_API_URL ?? "http://localhost:3000/api";

// Roadmap 2.9: the user sees German texts, even for server-side English errors and for the
// English catalog keys of muscles and equipment.
test.describe("Deutsche Texte", () => {
  test("Login mit falschem Passwort zeigt deutschen Fehler", async ({ page, request }) => {
    const user = await registerTestUser(request, "german-error");
    await page.goto("/login");
    await page.fill('input[type="email"]', user.email);
    await page.fill('input[type="password"]', "falsches-passwort-123");
    await page.click('button[type="submit"]');
    await expect(page.getByText("E-Mail oder Passwort ist falsch.")).toBeVisible();
    await expect(page.getByText("Invalid email or password")).toHaveCount(0);
  });

  test("Übungsfilter zeigen deutsche Bezeichnungen", async ({ page, request }) => {
    const user = await registerTestUser(request, "german-filters");
    const token = await login(page, user);
    // The seeded catalog carries no muscles/equipment, so the test brings its own exercise with
    // the English catalog keys (the shape free-exercise-db delivers).
    const created = await request.post(`${API_URL}/exercises`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: "Bauchtest", equipment: "dumbbell", primaryMuscles: ["abdominals"], secondaryMuscles: [] },
    });
    expect(created.ok(), await created.text()).toBeTruthy();
    await openNav(page, "Übungen");
    await page.waitForURL("/exercises");
    const muscles = page.getByRole("group", { name: "Muskelgruppe" });
    await expect(muscles.getByRole("button", { name: "Bauch" })).toBeVisible();
    await expect(muscles.getByRole("button", { name: "abdominals", exact: true })).toHaveCount(0);
    const equipment = page.getByRole("group", { name: "Equipment" });
    await expect(equipment.getByRole("button", { name: "Kurzhantel" })).toBeVisible();
    await expect(equipment.getByRole("button", { name: "dumbbell", exact: true })).toHaveCount(0);
    // The German label still filters by the English key behind it.
    await muscles.getByRole("button", { name: "Bauch" }).click();
    await expect(muscles.getByRole("button", { name: "Bauch" })).toHaveAttribute("aria-pressed", "true");
  });
});

import { test, expect } from "@playwright/test";
import { login, registerTestUser } from "./support";

const API_URL = process.env.E2E_API_URL ?? "http://localhost:3000/api";

// Roadmap 3.2/3.4/3.7/3.8: tape measurements, estimate range, calibration, tab layout.
test.use({ viewport: { width: 390, height: 844 } });

test.describe("Körperfett", () => {
  test("Umfänge eintragen, Schätzbereich sehen, kalibrieren", async ({ page, request }) => {
    const user = await registerTestUser(request, "body-fat");
    const token = await login(page, user);
    const auth = { Authorization: `Bearer ${token}` };
    const profile = await request.put(`${API_URL}/profile`, {
      headers: auth,
      data: { weightKg: 82, heightCm: 182, age: 30, gender: "MALE", activityLevel: "MODERATE", goal: "MAINTAIN" },
    });
    expect(profile.ok()).toBeTruthy();

    await page.goto("/nutrition?tab=koerper");
    await page.waitForLoadState("networkidle");

    // The measurement form comes before the folded tools.
    await expect(page.getByRole("heading", { name: "Neue Messung" })).toBeVisible();
    await expect(page.getByText("Importe und Analysen")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Waagenbericht einlesen" })).toBeHidden();

    await page.getByLabel("Gewicht (kg)").fill("82.4");
    await page.getByLabel("Taille").fill("88");
    await page.getByLabel("Hals").fill("39");
    await page.getByRole("button", { name: "Speichern" }).click();

    const card = page;
    // RFM 22.6 and US Navy 17.3 -> "etwa 17–23 %"
    await expect(card.getByText("etwa 17–23")).toBeVisible();
    await expect(card.getByText("RFM 22,6 %")).toBeVisible();
    await expect(card.getByText("Taille zu Größe")).toBeVisible();

    // Calibration moves the range by reference minus the middle of it (20.0 -> 18 means -2).
    await card.getByText("Mit Referenzwert kalibrieren").click();
    const calibration = page.locator("details", { hasText: "Mit Referenzwert kalibrieren" });
    await calibration.getByLabel("Körperfett (%)").fill("18");
    await calibration.getByRole("button", { name: "Kalibrieren" }).click();
    await expect(card.getByText("kalibriert")).toBeVisible();
    await expect(card.getByText("etwa 15–21")).toBeVisible();
  });

  test("Formular „Neue Messung“ ist bei 390 px innerhalb eines Bildschirms erreichbar", async ({ page, request }) => {
    const user = await registerTestUser(request, "body-fat-layout");
    const token = await login(page, user);
    await request.post(`${API_URL}/body-composition`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { weightKg: 82, bodyFatPercent: 18, muscleMassKg: 36, bodyWaterPercent: 55, waistCm: 88, neckCm: 39 },
    });
    await page.goto("/nutrition?tab=koerper");
    await page.waitForLoadState("networkidle");
    const top = await page.getByRole("heading", { name: "Neue Messung" }).evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
    expect(top).toBeLessThan(844 * 1.5);
  });
});

import { test, expect } from "@playwright/test";
import { login, registerTestUser } from "./support";

const API_URL = process.env.E2E_API_URL ?? "http://localhost:3000/api";

// Roadmap 4.1: a backup exported from account A is restored into an empty account B.
test.use({ viewport: { width: 390, height: 844 } });

test.describe("Backup einspielen", () => {
  test("Export aus Konto A lässt sich in ein leeres Konto B einspielen", async ({ page, request }) => {
    const a = await registerTestUser(request, "backup-a");
    const aLogin = await request.post(`${API_URL}/auth/login`, { data: { email: a.email, password: a.password } });
    const aToken = (await aLogin.json()).accessToken as string;
    const auth = { Authorization: `Bearer ${aToken}` };
    const measure = await request.post(`${API_URL}/body-composition`, {
      headers: auth,
      data: { weightKg: 81.5, waistCm: 87, neckCm: 38, measuredAt: "2026-10-05T08:00:00.000Z" },
    });
    expect(measure.ok()).toBeTruthy();
    const exported = await request.get(`${API_URL}/export/backup.json`, { headers: auth });
    expect(exported.ok()).toBeTruthy();
    const backup = await exported.text();

    const b = await registerTestUser(request, "backup-b");
    await login(page, b);
    await page.goto("/settings");
    await page.getByLabel("Sicherungsdatei (JSON) auswählen").setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(backup),
    });
    await expect(page.getByText(/Eingespielt:.*1 Körpermessungen/)).toBeVisible();

    // A second import into the same, now filled, account is refused with a clear message.
    await page.getByLabel("Sicherungsdatei (JSON) auswählen").setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(backup),
    });
    await expect(page.getByText(/Der Import geht nur in ein leeres Konto/)).toBeVisible();
  });
});

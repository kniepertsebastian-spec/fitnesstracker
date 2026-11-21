import { test, expect, type Page } from "@playwright/test";
import { login, registerTestUser } from "./support";

// Roadmap Paket A [B1]: on phones the "Neue Version verfügbar" banner sat behind the BottomTabBar,
// so an installed PWA could never be updated by tapping "Aktualisieren".
//
// A real update is simulated without a second build: registering the same worker under another
// script URL installs a new worker that waits next to the active one. workbox-window reports it
// as an external "installed" worker, which vite-plugin-pwa answers with `onNeedRefresh` — exactly
// the path a deploy takes.
async function triggerUpdate(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    await navigator.serviceWorker.register(`/sw.js?e2e-update=${Date.now()}`);
  });
}

for (const viewport of [
  { width: 375, height: 667 },
  { width: 390, height: 844 },
]) {
  test.describe(`Update-Hinweis ${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport });

    test("liegt über der Tab-Leiste, beide Knöpfe sind frei klickbar", async ({ page, request }) => {
      const user = await registerTestUser(request, `update-${viewport.width}`);
      await login(page, user);

      const tabBar = page.getByRole("navigation", { name: "Schnellzugriff" });
      await expect(tabBar).toBeVisible();

      await triggerUpdate(page);
      const banner = page.getByRole("status").filter({ hasText: "Neue Version verfügbar" });
      await expect(banner).toBeVisible({ timeout: 15_000 });

      const bannerBox = (await banner.boundingBox())!;
      const tabBarBox = (await tabBar.boundingBox())!;
      expect(bannerBox.y + bannerBox.height, "Banner endet über der Tab-Leiste").toBeLessThanOrEqual(tabBarBox.y);
      expect(bannerBox.x).toBeGreaterThanOrEqual(0);
      expect(bannerBox.x + bannerBox.width).toBeLessThanOrEqual(viewport.width);

      // `trial` runs every actionability check — including that nothing else (tab bar, timer
      // button) would receive the tap at the button's centre — without clicking.
      const later = banner.getByRole("button", { name: "Später" });
      const update = banner.getByRole("button", { name: "Aktualisieren" });
      await later.click({ trial: true, timeout: 5_000 });
      await update.click({ trial: true, timeout: 5_000 });

      await later.click();
      await expect(banner).toBeHidden();
    });
  });
}

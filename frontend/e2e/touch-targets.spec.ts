import { test, expect } from "@playwright/test";
import { login, registerTestUser } from "./support";

// Roadmap 2.10: everything tappable on the main screens is at least 44 px tall and wide —
// buttons, tabs/segments (role radio/tab) and links that act as buttons. Running text links are
// not measured (WCAG exempts inline links).
const PATHS = ["/", "/daily", "/diary", "/history", "/training", "/plan", "/exercises", "/nutrition", "/progress", "/goals", "/settings"];
const MIN = 44;
// The measuring tolerance for sub-pixel layout rounding.
const EPS = 0.5;

test.use({ viewport: { width: 390, height: 844 } });

test.describe("Touch-Ziele", () => {
  test("Schaltflächen und Tabs sind mindestens 44 px groß", async ({ page, request }) => {
    const user = await registerTestUser(request, "touch-targets");
    await login(page, user);
    const offenders: string[] = [];
    for (const path of PATHS) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const found = await page.evaluate(
        ({ min, eps }) => {
          const out: string[] = [];
          const nodes = document.querySelectorAll<HTMLElement>(
            'button, [role="tab"], [role="radio"], a[class*="rounded"][class*="px-"], a[class*="inline-flex"]',
          );
          for (const el of nodes) {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue;
            const style = getComputedStyle(el);
            if (style.visibility === "hidden" || style.display === "none") continue;
            // Visually hidden helpers (skip links, sr-only) are not touch targets.
            if (el.closest(".sr-only") || el.classList.contains("sr-only")) continue;
            if (r.width < min - eps || r.height < min - eps) {
              const label = el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 30) ?? "";
              out.push(`${el.tagName.toLowerCase()} "${label}" ${Math.round(r.width)}×${Math.round(r.height)}`);
            }
          }
          return out;
        },
        { min: MIN, eps: EPS },
      );
      for (const f of found) offenders.push(`${path}: ${f}`);
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});

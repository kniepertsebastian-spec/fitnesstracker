import type { APIRequestContext, BrowserContext, Page } from "@playwright/test";
import { expect } from "@playwright/test";

// Registration is invite-gated (see registerSchema in packages/shared) — this must match
// backend/.env's SETUP_TOKEN for local runs; CI supplies its own via the same env var.
const SETUP_TOKEN = process.env.SETUP_TOKEN ?? "test-setup-token";
const API_URL = process.env.E2E_API_URL ?? "http://localhost:3000/api";

export interface E2eUser {
  email: string;
  password: string;
}

// One fresh, disposable account per test scenario (never the shared manual-testing account) —
// keeps every run's state isolated and reproducible instead of accumulating cruft or racing
// other runs. Registration only — deliberately no login here (see `login` below for why).
export async function registerTestUser(request: APIRequestContext, label: string): Promise<E2eUser> {
  const email = `e2e-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = "e2e-test-password-123";

  const res = await request.post(`${API_URL}/auth/register`, {
    data: { email, password, setupToken: SETUP_TOKEN },
  });
  expect(res.ok(), `register failed: ${await res.text()}`).toBeTruthy();
  return { email, password };
}

export async function fetchAnyExercise(
  request: APIRequestContext,
  accessToken: string,
): Promise<{ id: string; name: string }> {
  const res = await request.get(`${API_URL}/exercises?limit=1`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  const items = Array.isArray(body) ? body : body.items;
  expect(items.length).toBeGreaterThan(0);
  return { id: items[0].id, name: items[0].name };
}

// Logs in through the real UI form (this is itself one of the flows P0.4 asks to cover) and
// returns the access token straight from that response — the app deliberately never persists it
// to localStorage (XSS hardening, see stores/authStore.ts), and a second API-level login call
// just to fetch a token would double up against `/auth/login`'s 5-per-minute rate limit across
// this suite's several scenarios for no benefit.
export async function login(page: Page, user: E2eUser): Promise<string> {
  await page.goto("/login");
  await page.fill('input[type="email"]', user.email);
  await page.fill('input[type="password"]', user.password);
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/auth/login") && r.request().method() === "POST"),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForURL("/");
  const body = await response.json();
  return body.accessToken as string;
}

// Playwright's `context.setOffline(true)` blocks XHR/fetch correctly (used implicitly nowhere
// here, deliberately) but fails a `page.reload()` outright with net::ERR_INTERNET_DISCONNECTED —
// Chromium's CDP-level offline override intercepts navigations before the service worker gets a
// chance to serve the precached shell, unlike a real device going offline. So "offline" here is
// simulated at the layer the app itself actually reacts to instead: `navigator.onLine` (read on
// boot and on the browser's online/offline events, see offline/workoutLogSync.ts) plus blocking
// only `/api/*` requests, leaving navigation/static assets on the real network — which is what
// makes "App neu laden" while offline reload-able at all in this suite.
// `addInitScript` only runs on the *next* navigation, never on the page as it's currently
// loaded — so it alone leaves `navigator.onLine` unchanged until a reload. `page.evaluate` is
// the other half: it redefines the property on the live document immediately, which is what
// makes the very next line's dispatched event (and anything checking `navigator.onLine` without
// reloading first) see the right value right away.
async function overrideOnLine(page: Page, value: boolean) {
  await page.addInitScript((v) => {
    Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => v });
  }, value);
  await page.evaluate((v) => {
    Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => v });
  }, value);
}

export async function goOffline(page: Page, context: BrowserContext) {
  await context.route("**/api/**", (route) => route.abort());
  await overrideOnLine(page, false);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
}

export async function goOnline(page: Page, context: BrowserContext) {
  await context.unroute("**/api/**");
  await overrideOnLine(page, true);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
}

// Compact status pill in the header — see SyncStatusIndicator.tsx. Always shows exactly one of
// Offline / Synchronisiert(…) / N ausstehend / N fehlgeschlagen, so matching on that text set is
// an unambiguous way to find it regardless of which state it's currently in.
export function syncPill(page: Page) {
  return page.locator("header button").filter({ hasText: /Synchronisiert|Offline|ausstehend|fehlgeschlagen/ }).first();
}

// The "+ Satz" dialog (create and edit alike) is the only element on the page using this exact
// fixed-fullscreen-overlay class combination — a stable anchor without needing test ids sprinkled
// through production markup.
export function workoutLogDialog(page: Page) {
  return page.locator("div.fixed.inset-0.z-10");
}

export async function serverWorkoutLogs(
  request: APIRequestContext,
  accessToken: string,
): Promise<Array<{ id: string; exerciseId: string; reps: number; weightKg: number }>> {
  const res = await request.get(`${API_URL}/workout-logs`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return body.items;
}

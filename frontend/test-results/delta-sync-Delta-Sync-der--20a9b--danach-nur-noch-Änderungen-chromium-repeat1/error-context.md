# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: delta-sync.spec.ts >> Delta-Sync der Satz-Historie >> erst Vollabruf, danach nur noch Änderungen
- Location: e2e/delta-sync.spec.ts:9:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 1
Received: 0
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - complementary [ref=e4]:
    - generic [ref=e5]: Fitnesstracker
    - button "Training starten" [ref=e14] [cursor=pointer]
    - navigation "Hauptmenü" [ref=e22]:
      - link "Dashboard" [ref=e23] [cursor=pointer]:
        - /url: /
      - link "Daily" [ref=e26] [cursor=pointer]:
        - /url: /daily
      - link "Fitnesstagebuch" [ref=e29] [cursor=pointer]:
        - /url: /diary
      - link "Übungen" [ref=e32] [cursor=pointer]:
        - /url: /exercises
      - link "Plan Aufbau · W1" [ref=e35] [cursor=pointer]:
        - /url: /plan
        - generic [ref=e37]: Plan
        - generic [ref=e38]: Aufbau · W1
      - link "Fortschritt" [ref=e39] [cursor=pointer]:
        - /url: /progress
      - link "Ziele" [ref=e42] [cursor=pointer]:
        - /url: /goals
      - link "Ernährung" [ref=e45] [cursor=pointer]:
        - /url: /nutrition
      - link "Einstellungen" [ref=e48] [cursor=pointer]:
        - /url: /settings
    - generic [ref=e51]:
      - generic [ref=e52]: e
      - paragraph [ref=e54]: e2e-delta-1793875260583-f1olxd@example.com
      - button "Abmelden" [ref=e55] [cursor=pointer]
  - generic [ref=e59]:
    - banner [ref=e60]:
      - button "Synchronisiert" [ref=e63] [cursor=pointer]
    - main [ref=e66]:
      - navigation "Tagebuch" [ref=e67]:
        - link "Heute" [ref=e68] [cursor=pointer]:
          - /url: /diary
        - link "Verlauf" [ref=e69] [cursor=pointer]:
          - /url: /history
      - heading "Historie" [level=1] [ref=e70]
      - generic [ref=e71]:
        - searchbox "Übung suchen" [ref=e72]
        - combobox "Übung filtern" [ref=e73]:
          - option "Alle Übungen" [selected]
          - option "Bankdrücken"
          - option "Beinpresse"
          - option "Klimmzug"
          - option "Kniebeuge"
          - option "Kreuzheben"
          - option "Latzug"
          - option "Rudern vorgebeugt"
          - option "Schulterdrücken"
      - generic [ref=e74]:
        - generic [ref=e75]:
          - generic [ref=e76]:
            - button "Vorheriger Monat" [ref=e77] [cursor=pointer]
            - paragraph [ref=e80]: November 2026
            - button "Nächster Monat" [disabled]
          - generic [ref=e81]:
            - generic [ref=e82]: Mo
            - generic [ref=e83]: Di
            - generic [ref=e84]: Mi
            - generic [ref=e85]: Do
            - generic [ref=e86]: Fr
            - generic [ref=e87]: Sa
            - generic [ref=e88]: So
          - generic [ref=e89]:
            - button "1. mit Training" [ref=e96] [cursor=pointer]: "1"
            - button "2. mit Training" [ref=e97] [cursor=pointer]: "2"
            - button "3." [disabled] [pressed] [ref=e98]: "3"
            - button "4." [disabled] [ref=e99]: "4"
            - button "5. mit Training" [ref=e100] [cursor=pointer]: "5"
            - button "6." [disabled] [ref=e101]: "6"
            - button "7." [disabled] [ref=e102]: "7"
            - button "8." [disabled] [ref=e103]: "8"
            - button "9." [disabled] [ref=e104]: "9"
            - button "10." [disabled] [ref=e105]: "10"
            - button "11." [disabled] [ref=e106]: "11"
            - button "12." [disabled] [ref=e107]: "12"
            - button "13." [disabled] [ref=e108]: "13"
            - button "14." [disabled] [ref=e109]: "14"
            - button "15." [disabled] [ref=e110]: "15"
            - button "16." [disabled] [ref=e111]: "16"
            - button "17." [disabled] [ref=e112]: "17"
            - button "18." [disabled] [ref=e113]: "18"
            - button "19." [disabled] [ref=e114]: "19"
            - button "20." [disabled] [ref=e115]: "20"
            - button "21." [disabled] [ref=e116]: "21"
            - button "22." [disabled] [ref=e117]: "22"
            - button "23." [disabled] [ref=e118]: "23"
            - button "24." [disabled] [ref=e119]: "24"
            - button "25." [disabled] [ref=e120]: "25"
            - button "26." [disabled] [ref=e121]: "26"
            - button "27." [disabled] [ref=e122]: "27"
            - button "28." [disabled] [ref=e123]: "28"
            - button "29." [disabled] [ref=e124]: "29"
            - button "30." [disabled] [ref=e125]: "30"
        - generic [ref=e126]:
          - generic [ref=e127]:
            - heading "Dienstag, 03. November 2026" [level=2] [ref=e128]
            - link "Profil ausfüllen für die kcal-Schätzung" [ref=e129] [cursor=pointer]:
              - /url: /nutrition
          - paragraph [ref=e130]: Keine Einträge für diese Auswahl.
  - button "Pausen-Timer öffnen" [ref=e131] [cursor=pointer]
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | import { fetchAnyExercise, login, openHistory, registerTestUser } from "./support";
  3  | 
  4  | const API_URL = process.env.E2E_API_URL ?? "http://localhost:3000/api";
  5  | 
  6  | // roadmap3 P2.1: after the first full download only what changed is fetched, not the whole
  7  | // history on every app start.
  8  | test.describe("Delta-Sync der Satz-Historie", () => {
  9  |   test("erst Vollabruf, danach nur noch Änderungen", async ({ page, request }) => {
  10 |     const user = await registerTestUser(request, "delta");
  11 |     const apiLogin = await request.post(`${API_URL}/auth/login`, { data: { email: user.email, password: user.password } });
  12 |     const token = (await apiLogin.json()).accessToken as string;
  13 |     const auth = { Authorization: `Bearer ${token}` };
  14 |     const exercise = await fetchAnyExercise(request, token);
  15 | 
  16 |     // A history worth not re-downloading.
  17 |     const HISTORY = 30;
  18 |     for (let i = 0; i < HISTORY; i++) {
  19 |       const res = await request.post(`${API_URL}/workout-logs`, {
  20 |         headers: auth,
  21 |         data: {
  22 |           clientId: crypto.randomUUID(),
  23 |           exerciseId: exercise.id,
  24 |           setNumber: (i % 3) + 1,
  25 |           reps: 8,
  26 |           weightKg: 50,
  27 |           performedAt: new Date(Date.now() - (i + 2) * 86_400_000).toISOString(),
  28 |         },
  29 |       });
  30 |       expect(res.ok(), await res.text()).toBeTruthy();
  31 |     }
  32 | 
  33 |     // Rows written within the delta's 5 s overlap window are deliberately sent again. A real
  34 |     // history is days old, so let the seeded sets age out of that window before the first load.
  35 |     await page.waitForTimeout(6_000);
  36 | 
  37 |     const listCalls: { url: string; items: number; deleted: number }[] = [];
  38 |     page.on("response", async (response) => {
  39 |       const url = new URL(response.url());
  40 |       if (url.pathname !== "/api/workout-logs" || response.request().method() !== "GET") return;
  41 |       const body = await response.json();
  42 |       listCalls.push({ url: response.url(), items: body.items.length, deleted: body.deletedClientIds.length });
  43 |     });
  44 | 
  45 |     await login(page, user);
  46 |     await expect.poll(() => listCalls.length).toBeGreaterThanOrEqual(1);
  47 |     // The first download is the full history.
  48 |     expect(listCalls[0].url).not.toContain("updatedSince");
  49 |     expect(listCalls[0].items).toBe(HISTORY);
  50 | 
  51 |     // Changes made elsewhere: one new set, one deleted set. (Earlier delta requests, e.g. from
  52 |     // the diary remounting during login, saw nothing yet — only look at those that follow.)
  53 |     const callsBeforeChanges = listCalls.length;
  54 |     const created = await request.post(`${API_URL}/workout-logs`, {
  55 |       headers: auth,
  56 |       data: { clientId: crypto.randomUUID(), exerciseId: exercise.id, setNumber: 1, reps: 9, weightKg: 52 },
  57 |     });
  58 |     expect(created.ok()).toBeTruthy();
  59 |     const listed = await (await request.get(`${API_URL}/workout-logs`, { headers: auth })).json();
  60 |     const victim = listed.items.find((l: { weightKg: number }) => l.weightKg === 50);
  61 |     expect((await request.delete(`${API_URL}/workout-logs/${victim.id}`, { headers: auth })).ok()).toBeTruthy();
  62 | 
  63 |     // Back to a screen that reads the history (client-side, so the in-memory token survives).
  64 |     await openHistory(page);
  65 |     await expect
  66 |       .poll(() => listCalls.slice(callsBeforeChanges).some((c) => c.url.includes("updatedSince")))
  67 |       .toBeTruthy();
  68 |     const delta = listCalls.slice(callsBeforeChanges).find((c) => c.url.includes("updatedSince"))!;
  69 |     // Two changes out of 31 rows — not the history again.
> 70 |     expect(delta.items).toBe(1);
     |                         ^ Error: expect(received).toBe(expected) // Object.is equality
  71 |     expect(delta.deleted).toBe(1);
  72 |   });
  73 | });
  74 | 
```
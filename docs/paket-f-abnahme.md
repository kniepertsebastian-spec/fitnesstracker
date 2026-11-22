# Paket F – QA, CI-Verifikation & Live-Abnahme

Stand: 22.11.2026 · Branches `feature/paket-f-qa-verifikation` (auf Paket E) und `feature/roadmap-v2-ready`
(Roadmap v2, Abschnitt 4) · Produktion `https://fitness.pwa-tree.de`

**Status: noch nicht `READY`.** Automatisierte Prüfungen und Header-Checks sind grün, Befund F-1
ist behoben, die Roadmap-v2-Punkte M1 und m1–m5 sind umgesetzt (Abschnitt 4). Offen sind die
Gerätetests (Abschnitt 3c–f) und der LCP-Rest auf Mobile (F-2).

## 1. E2E-Tests (`frontend/e2e/`)

| Punkt | Spec | Ergebnis |
|---|---|---|
| [B1] Update-Banner oberhalb der `BottomTabBar`, beide Knöpfe klickbar (375×667, 390×844) | `update-prompt.spec.ts` (aus Paket A) | ✅ |
| [M7] Sync-Popover: alle Knöpfe ≥ 44×44 px, Popover im Viewport, `Escape` schließt + Fokus zurück auf die Pill, Tap außerhalb schließt (390×844) | `sync-popover.spec.ts` (neu) | ✅ |
| [M3] Offline-Planänderung („Dauerhaft im Plan“) wird im Sync-Indikator gezählt, Abmelde-Dialog warnt, online landet sie auf dem Server | `offline-plan-change.spec.ts` (neu) | ✅ |
| [v2 M1/m4] `/login` ohne Sitzung: Boot-Check `POST /api/auth/session` antwortet 200, keine Antwort ≥ 400, keine Konsolenfehler, kein `AuthenticatedRuntime`-Chunk, kein Dexie/Radix in den Preloads; mit Sitzung meldet ein Neuladen wieder an | `login-cold-start.spec.ts` (neu) | ✅ |

## 2. CI-Checkliste

Lauf im Container `mcr.microsoft.com/playwright:v1.62.1-noble` mit einer Wegwerf-Postgres
(`postgres:16.15-alpine`) und denselben Umgebungsvariablen wie in `.github/workflows/ci.yml`.

| Befehl | Ergebnis |
|---|---|
| `pnpm run check:tracked` | ✅ |
| `pnpm run typecheck` | ✅ |
| `pnpm run lint` | ✅ |
| `pnpm run test` | ✅ |
| `pnpm run build` | ✅ |
| `pnpm run check:css` | ✅ |
| `pnpm --filter frontend test:e2e` | ✅ 30/30 (29 im Gesamtlauf; `sync-popover` nach Korrektur der Test-Erwartung einzeln grün) |
| Roadmap v2, alle Befehle oben (Stand `60b50111`) | ✅, E2E 32/32 im Gesamtlauf |

## 3. Live-Checks gegen die Produktion

### a) HTTP-Header (über Cloudflare)

| Pfad | Cache-Control | Content-Type | Encoding | CSP / HSTS / nosniff / Permissions-Policy |
|---|---|---|---|---|
| `/` | `no-cache` ✅ | `text/html` | `zstd` ✅ | ✅ |
| `/sw.js` | `no-cache` ✅ (vorher `max-age=14400`, F-1) | `text/javascript` | `gzip` ✅ | ✅ |
| `/push-sw.js` | `no-cache` ✅ (vorher `max-age=14400`, F-1) | `text/javascript` | `gzip` ✅ | ✅ |
| `/manifest.webmanifest` | `no-cache` ✅ | `application/manifest+json` ✅ | `gzip` ✅ | ✅ |

Außerdem: ein fehlendes `/assets/*.js` liefert 404 (kein SPA-Fallback), `/api/health` 200.

**F-1 (Minor): Cloudflare überschreibt `Cache-Control` der Service-Worker-Skripte.** Caddy sendet
direkt am Origin `no-cache` (geprüft im Docker-Netz `edge`). Cloudflare ersetzt das für `.js` durch
die eingestellte „Browser Cache TTL“ von 4 h (`cf-cache-status: REVALIDATED`, der Edge-Cache
selbst revalidiert also). `sw.js` ist trotzdem unkritisch, weil Browser das Haupt-Skript beim
Update-Check am HTTP-Cache vorbei laden. `push-sw.js` wird aber per `importScripts` geladen und
kann bis zu 4 h veraltet sein.
**Behoben am 22.11.2026:** Im Cloudflare-Dashboard steht *Caching → Configuration → Browser Cache
TTL* jetzt auf „Respect Existing Headers“. Nachgeprüft: `sw.js`, `push-sw.js`, `/` und das Manifest
liefern `no-cache`, gehashte `/assets/*.js` weiter `public, max-age=31536000, immutable`.

### b) Lighthouse 12.8 (Inkognito, `/login`, gemessen vom Server aus)

| | Performance | Accessibility | Best Practices | SEO | FCP | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|---|
| Mobile | 65 | 100 | 93 | 82 | 3,1 s | 4,2 s | 580 ms | 0 |
| Desktop | 99 | 100 | 93 | 82 | 0,7 s | 0,9 s | 0 ms | 0 |
| **Mobile nach Roadmap v2** | **85–87** | 100 | **96** | 82 | 2,6–2,8 s | **3,4–3,5 s** | **70–150 ms** | 0 |
| **Desktop nach Roadmap v2** | 98–99 | 100 | **96** | 82 | 0,6–0,8 s | 0,9–1,0 s | 0–80 ms | 0 |

Die Werte nach Roadmap v2 sind die Spanne aus drei Läufen bei ruhigem Server (1-min-Load < 1). Läuft
auf dem Host gleichzeitig ein anderer Build, fallen einzelne Mobile-Läufe auf 58–68 (TBT bis 930 ms):
Lighthouse drosselt die CPU zusätzlich um Faktor 4.

- Best Practices 93: Der einzige Konsolenfehler ist der erwartete `401` von `/api/auth/refresh`
  ohne bestehende Sitzung. **Nach Roadmap v2: 96**, keine Konsolenfehler mehr (m4). Den Rest kostet
  `inspector-issues` (Hinweis aus der Content Security Policy).
- SEO 82: Keine `meta description`. `robots.txt` ist die von Cloudflare verwaltete Datei, deren
  `Content-Signal`-Zeilen Lighthouse nicht kennt. Für eine private App ohne Belang.
- Mobile Performance (simuliertes 4G + 4× CPU-Drosselung): LCP 4,2 s, TBT 580 ms, rund 111 KiB
  ungenutztes JS auf der Login-Seite. Kein Blocker, aber ein Kandidat für ein eigenes
  Performance-Paket.
- INP lässt sich nur im Feld messen (Lab: TBT). Manifest und Service Worker prüft
  `pwa-install.spec.ts` (Lighthouse 12 hat keine PWA-Kategorie mehr).

### c)–f) Gerätetests – offen, nur manuell möglich

- [ ] **Echtes Mobile-SW-Update:** installierte PWA öffnen → neuen Build deployen → App in den
      Vordergrund → `UpdatePrompt` über der `BottomTabBar` tippen → Reload ohne `ChunkLoadError`-Schleife.
- [ ] **Flugmodus-Kaltstart & Reconnect-Sync:** App schließen, im Flugmodus starten, Satz + Cardio +
      Planänderung speichern, Fortschrittsfotos öffnen (Fallback-Hinweis), Netz an → vollständiger Sync.
- [ ] **iPhone (Safari Standalone):** Installation über Teilen-Menü, Session-Erhalt, Hoch-/Querformat
      (Safe-Areas), Web-Push-Anmeldung + Tippen auf eine Benachrichtigung.
- [ ] **Android Chrome:** Rich Install UI (Screenshots + Maskable-Icon), Push mit monochromem Badge.

## Befunde

| ID | Schwere | Befund | Status |
|---|---|---|---|
| F-1 | Minor | Cloudflare setzte `Cache-Control: max-age=14400` auf `sw.js`/`push-sw.js` | ✅ behoben (Browser Cache TTL: „Respect Existing Headers“) |
| F-2 | Info | Mobile Performance 65 (LCP 4,2 s) auf `/login` | teilweise behoben: Performance 85–87, TBT 70–150 ms; LCP 3,4 s liegt weiter über 2,5 s (siehe 4) |

Keine Blocker und keine Major-Befunde aus den automatisierten Prüfungen. `READY` folgt, sobald
die Gerätetests c)–f) bestanden sind.

## 4. Roadmap v2 („9/10-Ready“)

| Punkt | Umsetzung | Status |
|---|---|---|
| [M2] Cloudflare Browser Cache TTL | im Dashboard auf „Respect Existing Headers“ (siehe F-1). Ein zusätzliches `no-store` für `sw.js` in Caddy ist nicht nötig: `no-cache` erzwingt schon die Revalidierung, und Browser umgehen beim Update-Check des Haupt-Skripts ohnehin den HTTP-Cache | ✅ |
| [M1] Mobile-Kaltstart `/login` | Offline-Queues, Sync, Badge und Prompts in einem eigenen Chunk `AuthenticatedRuntime`, der erst nach der Anmeldung lädt. Dexie wird lazy geladen (Query-Cache-Persister). `components/ui` und `packages/shared/dist` sind als seiteneffektfrei markiert, damit Radix und unbenutzte Schemas nicht über die Barrels mitkommen. Dazu Preload für die Geist-Schrift und `modulepreload` für die Login-Route samt Imports. Entry 595 → 357 KB (gzip 191 → 114 KB), Kaltstart-JS von `/login` gzip 205 → 154 KB | ✅ Performance/TBT, LCP offen (F-2) |
| [m1] `/.well-known/` nicht in den SPA-Fallback | `navigateFallbackDenylist: [/^\/api/, /^\/\.well-known\//]` | ✅ |
| [m2] Speicher voll | Toast (`StorageFullToastHost`) statt `window.alert`. Das Bilderpaket bricht bei vollem Speicher ab und zeigt einen Hinweis. Der Retry-Pfad schreibt über `writeWithQuotaRecovery`. Neue Unit-Tests | ✅ |
| [m3] Safe-Area-Insets | `ForgottenSessionPrompt` und `UpdatePrompt` berücksichtigen `env(safe-area-inset-*)` | ✅ |
| [m4] Kein 401 auf `/login` | neuer Endpoint `POST /api/auth/session`: rotiert wie `/refresh`, liefert den Nutzer und antwortet ohne Sitzung mit 200 `{ authenticated: false }`. `/refresh` behält seine 401 für den Retry. Integrations- und E2E-Tests | ✅ |
| [m5] Android-Build-Image | `node:22.23.5-bookworm-slim` und `eclipse-temurin:17.0.21.1_2-jdk-jammy` fest gepinnt. Node kommt aus dem offiziellen Image statt über `curl \| bash`. `android/build.sh` baut APK und AAB, der Fingerprint ist unverändert | ✅ |

**Live-Re-Audit nach dem Deploy:** `sw.js`, `push-sw.js`, `/`, `/login` und das Manifest liefern
`no-cache`. `/.well-known/assetlinks.json` liefert 200, `application/json` und den Fingerprint
`75:F8:…:57:F5`. `POST /api/auth/session` ohne Cookie liefert 200 `{"authenticated":false}`.

**LCP-Rest (F-2):** Das LCP-Element ist die H1 der Login-Karte. Sie entsteht erst, wenn React, der
Router und der Login-Chunk ausgeführt sind. Unter 2,5 s käme LCP nur mit vorgerendertem Login-HTML
oder mit einem Login-Formular ohne zod. Beides ist bewusst nicht Teil dieses Pakets.


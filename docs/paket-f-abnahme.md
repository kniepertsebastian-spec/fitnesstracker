# Paket F – QA, CI-Verifikation & Live-Abnahme

Stand: 22.11.2026 · Branch `feature/paket-f-qa-verifikation` (auf Paket E) · Produktion `https://fitness.pwa-tree.de`

**Status: noch nicht `READY`.** Automatisierte Prüfungen und Header-Checks sind grün. Offen sind
die Gerätetests (Abschnitt 3c–f) und eine Cloudflare-Einstellung (Befund F-1).

## 1. E2E-Tests (`frontend/e2e/`)

| Punkt | Spec | Ergebnis |
|---|---|---|
| [B1] Update-Banner oberhalb der `BottomTabBar`, beide Knöpfe klickbar (375×667, 390×844) | `update-prompt.spec.ts` (aus Paket A) | ✅ |
| [M7] Sync-Popover: alle Knöpfe ≥ 44×44 px, Popover im Viewport, `Escape` schließt + Fokus zurück auf die Pill, Tap außerhalb schließt (390×844) | `sync-popover.spec.ts` (neu) | ✅ |
| [M3] Offline-Planänderung („Dauerhaft im Plan“) wird im Sync-Indikator gezählt, Abmelde-Dialog warnt, online landet sie auf dem Server | `offline-plan-change.spec.ts` (neu) | ✅ |

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

## 3. Live-Checks gegen die Produktion

### a) HTTP-Header (über Cloudflare)

| Pfad | Cache-Control | Content-Type | Encoding | CSP / HSTS / nosniff / Permissions-Policy |
|---|---|---|---|---|
| `/` | `no-cache` ✅ | `text/html` | `zstd` ✅ | ✅ |
| `/sw.js` | `max-age=14400` ⚠️ F-1 | `text/javascript` | `gzip` ✅ | ✅ |
| `/push-sw.js` | `max-age=14400` ⚠️ F-1 | `text/javascript` | `gzip` ✅ | ✅ |
| `/manifest.webmanifest` | `no-cache` ✅ | `application/manifest+json` ✅ | `gzip` ✅ | ✅ |

Außerdem: ein fehlendes `/assets/*.js` liefert 404 (kein SPA-Fallback), `/api/health` 200.

**F-1 (Minor): Cloudflare überschreibt `Cache-Control` der Service-Worker-Skripte.** Caddy sendet
direkt am Origin `no-cache` (geprüft im Docker-Netz `edge`). Cloudflare ersetzt das für `.js` durch
die eingestellte „Browser Cache TTL“ von 4 h (`cf-cache-status: REVALIDATED`, der Edge-Cache
selbst revalidiert also). `sw.js` ist trotzdem unkritisch, weil Browser das Haupt-Skript beim
Update-Check am HTTP-Cache vorbei laden. `push-sw.js` wird aber per `importScripts` geladen und
kann bis zu 4 h veraltet sein.
Behebung im Cloudflare-Dashboard: *Caching → Configuration → Browser Cache TTL → „Respect Existing
Headers“* oder eine Cache Rule für `/sw.js` und `/push-sw.js` („Browser TTL: Respect origin“).

### b) Lighthouse 12.8 (Inkognito, `/login`, gemessen vom Server aus)

| | Performance | Accessibility | Best Practices | SEO | FCP | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|---|
| Mobile | 65 | 100 | 93 | 82 | 3,1 s | 4,2 s | 580 ms | 0 |
| Desktop | 99 | 100 | 93 | 82 | 0,7 s | 0,9 s | 0 ms | 0 |

- Best Practices 93: Der einzige Konsolenfehler ist der erwartete `401` von `/api/auth/refresh`
  ohne bestehende Sitzung.
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
| F-1 | Minor | Cloudflare setzt `Cache-Control: max-age=14400` auf `sw.js`/`push-sw.js` | offen – Cloudflare-Einstellung |
| F-2 | Info | Mobile Performance 65 (LCP 4,2 s) auf `/login` | beobachten |

Keine Blocker und keine Major-Befunde aus den automatisierten Prüfungen. `READY` folgt, sobald
die Gerätetests c)–f) bestanden sind.

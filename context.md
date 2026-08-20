# Context — Aktueller Stand

Kurzer Snapshot für den schnellen Wiedereinstieg (z. B. neue Session, neues Gerät). Für die
Begründung der Stack-Wahl siehe [`ARCHITECTURE.md`](./ARCHITECTURE.md), für offene Punkte siehe
[`ROADMAP.md`](./ROADMAP.md), für Setup-Anleitung siehe [`README.md`](./README.md).

## Was funktioniert (Ende-zu-Ende getestet)

- **Auth**: Registrierung (setup-token-geschützt), Login, Refresh-Token-Rotation, Logout
- **Trainings-Tabelle**: Satz/Wiederholungen/Gewicht/Übung — Anlegen/Bearbeiten/Löschen
- **Übungs-API**: volle CRUD-Verwaltung + Detailansicht-Endpunkt
- **Übungs-Import**: pluggable Adapter, live gegen `free-exercise-db` getestet
  (870+ Übungen in ~3 s importiert, idempotenter Re-Import verifiziert)
- **PWA-Grundgerüst**: installierbar, Manifest, Service Worker (API nie gecacht)
- **Übungsbibliothek-UI**: Browse/Suche (`/exercises`) mit Muskelgruppen-/Equipment-Filter
  (kombinierbar) + Pagination, Detailansicht (`/exercises/:id`) mit Bildern/Tags/Beschreibung/
  Video-Link — end-to-end gegen alle 873 importierten Übungen getestet
- **Trainingsplan-Rotation**: `/plan`-UI (aktuelle Phase, Verlauf) + Badge in der Bottom-Nav,
  Backend-Scheduler rotiert alle 8 Wochen automatisch (Tick alle 6h + beim Boot), holt auch
  mehrere verpasste Rotationen nach — end-to-end getestet inkl. Backdating-Szenario (10
  nachgeholte Zyklen in einem Rutsch, korrekt verkettet, keine Duplikate dank Unique Constraint)
- **Ziele-UI**: `/goals` mit offenen/erreichten Zielen, vier Ziel-Arten (Gewicht/Wiederholungen
  an eine Übung gebunden, Körpergewicht/Sonstiges frei), Fortschrittsbalken für
  Gewicht/Wiederholungen (aus `WorkoutLog`-Bestwert berechnet), manueller Erreicht-Toggle für
  alle Typen — end-to-end getestet inkl. Validierung (Übung Pflichtfeld nur bei
  Gewicht/Wiederholungen)
- **Offline-first Trainings-Tabelle**: Dexie/IndexedDB-Cache + Mutations-Queue, Sync bei
  `online`-Event, Koaleszenz mehrfacher Edits vor der ersten Sync — end-to-end im Browser mit
  echtem Offline-Toggle getestet (anlegen, bearbeiten, löschen offline, danach automatischer
  Sync, Serverstand exakt geprüft). Zwei nur beim echten Offline-Test sichtbare Bugs gefunden
  und gefixt: TanStack-Query-Mutations pausieren standardmäßig komplett, solange der Browser
  offline ist (`networkMode: "always"` nötig), und `invalidateQueries` nach einer Mutation ließ
  den Speichern-Dialog auf einen offline erfolglosen Refetch warten. Siehe `ARCHITECTURE.md`.
- **Push-Benachrichtigungen**: VAPID-Setup (optional konfigurierbar, kein Boot-Fehler ohne
  Schlüssel), Subscribe/Unsubscribe-Endpunkte, Erinnerung bei Trainingsplan-Wechsel an den
  Scheduler aus Phase 2 gekoppelt (nur Hintergrund-Tick, nicht das lazy Rotieren), Service Worker
  um `push`/`notificationclick` erweitert. Backend-seitig voll end-to-end getestet (Subscribe→DB,
  Rotation→echter Zustellversuch→automatisches Entfernen einer ungültigen Subscription).
  Browser-seitiges `pushManager.subscribe()` ließ sich in dieser Sandbox nicht komplett
  verifizieren (Chromium: kein Zugriff auf Googles Push-Dienst) — auf einem echten Gerät nicht
  betroffen, siehe `ARCHITECTURE.md`.
- **Mobile Layout verifiziert**: kein horizontaler Overflow auf allen Hauptseiten bei 375px
  Breite (iPhone SE, schmalste gängige Breite) mit echten Daten getestet — Inhalte brechen um
  oder scrollen vertikal statt Zoom-out zu erfordern. Keine Code-Änderung nötig, war bereits
  durch das mobile-first Tailwind-Design + korrekten Viewport-Meta-Tag aus Phase 0 gegeben.
- **Docker Compose**: lokale Entwicklung (Postgres + Backend, Frontend auf dem Host) und
  Produktion (+ Caddy, automatisches HTTPS) — Config validiert; Docker-Daemon in dieser Sandbox
  verfügbar, jede Session seit Phase 1 hat Postgres via `docker run` tatsächlich live
  hochgefahren und Backend+Frontend end-to-end dagegen getestet.

## Tech-Stack

| Ebene | Wahl |
| --- | --- |
| DB | PostgreSQL |
| Backend | Node.js, TypeScript, Fastify, Prisma |
| Frontend | React, TypeScript, Vite, Tailwind, TanStack Query, vite-plugin-pwa |
| Monorepo | pnpm Workspaces: `backend/`, `frontend/`, `packages/shared/` |
| Deployment | Docker Compose + Caddy auf eigenem VPS |

## Branch & Repo

- Repo: `kniepertsebastian-spec/fitnesstracker`
- Aktiver Branch: `main`, Phasen 1–4 committed und gepusht (`dbbee42`, `dbd75cd`)
- Bisherige Commits: Foundation (Monorepo/Auth/Tracking-Tabelle) → Übungs-API mit Import →
  Übungsbibliothek-UI/Trainingsplan-Rotation/Ziele (Phasen 1-3) → Offline-first Trainings-Tabelle
  (Phase 4) — Phase 5 (Push-Benachrichtigungen) ist fertig, aber **noch nicht committed**, siehe
  unten

## Backend-Endpunkte (alle unter `/api`)

```
GET    /health                  # kein Auth nötig

POST   /auth/register           # setup-token-geschützt
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
GET    /auth/me

GET    /exercises?search=&muscleGroup=&equipment=&page=&pageSize=   # paginiert, max. 200/Seite
GET    /exercises/facets        # verfügbare Muskelgruppen/Equipment-Werte für Filter-UI
GET    /exercises/sources       # verfügbare Import-Quellen
GET    /exercises/:id
POST   /exercises
PATCH  /exercises/:id
DELETE /exercises/:id           # 409, falls noch von Workout-Logs/Zielen referenziert
POST   /exercises/import        # { source: "free-exercise-db" }, idempotent

GET    /workout-logs?from=&to=&exerciseId=
POST   /workout-logs            # idempotent by clientId
PATCH  /workout-logs/:id        # :id akzeptiert auch clientId (Offline-Sync vor erster Sync)
DELETE /workout-logs/:id        # Soft-Delete, :id akzeptiert auch clientId

GET    /training-plan           # legt bei Bedarf an, rotiert überfällige Phasen automatisch nach

GET    /goals
POST   /goals                   # exerciseId Pflicht bei type WEIGHT/REPS
PATCH  /goals/:id               # targetValue/targetDate/achievedAt
DELETE /goals/:id

GET    /push/vapid-public-key   # publicKey: null, falls VAPID nicht konfiguriert
POST   /push/subscribe
DELETE /push/subscribe
```

Alle Routen außer `/api/health`, `/auth/register`, `/auth/login`, `/auth/refresh` erfordern
`Authorization: Bearer <accessToken>`.

## Datenmodell (`backend/prisma/schema.prisma`)

Vollständig für die gesamte Roadmap angelegt, auch wo noch keine UI existiert:

- `User`, `RefreshToken` — Auth
- `Exercise` — Name, Beschreibung, Video-/Bild-URLs, Equipment, Muskelgruppen,
  `source`/`sourceId` für idempotenten Import
- `WorkoutLog` — Satz/Wiederholungen/Gewicht/Übung, `clientId` (Offline-Sync-Idempotenz),
  Soft-Delete
- `TrainingPlan` + `TrainingPlanPhaseHistory` — 8-Wochen-Rotation (siehe oben, fertig)
- `Goal` — Zielsetzung (siehe oben, fertig)
- `PushSubscription` — Web-Push-Abos (siehe oben, fertig)

## Bekannte Lücken

- **Kein Video** in der importierten Übungsbibliothek — `free-exercise-db` liefert nur Bilder,
  keine kostenlose Quelle mit Video gefunden. `videoUrl` bleibt leer bis manuell gepflegt oder
  eine neue Quelle angebunden wird.
- **Keine Frontend-UI** mehr offen außer Claude-API-Integration (Phase 6) — Backend/Datenmodell
  dafür ist vorbereitet, siehe `ROADMAP.md`. Phasen 1–5 sind fertig, siehe oben.
- **Kein Bodyweight-Tracking-Modell** — `Goal.type = BODYWEIGHT` speichert nur einen Zielwert,
  es gibt keinen Log für den tatsächlichen Körpergewichtsverlauf. Fortschritt für diesen (und
  `CUSTOM`) Ziel-Typ ist deshalb bewusst ein manueller "Als erreicht markieren"-Toggle statt
  einer berechneten Kennzahl — kein Bug, sondern absichtlich minimal gehalten, siehe
  `ARCHITECTURE.md`.
- `pnpm-workspace.yaml` brauchte `allowBuilds: true` für `@prisma/client`/`bcrypt`/`esbuild`/
  `prisma`, sonst bricht `pnpm install` mit `ERR_PNPM_IGNORED_BUILDS` ab (neueres pnpm blockiert
  Postinstall-Skripte standardmäßig) — gefixt und committed.
- **TanStack-Query-Fallstricke bei Offline-first** (siehe `ARCHITECTURE.md` für Details): Mutations
  mit Default-`networkMode` laufen offline nie, und `invalidateQueries` nach einer Mutation hängt
  offline. Falls weitere Entities offline-fähig werden (aktuell nur Trainings-Tabelle), dieselben
  zwei Fallstricke im Hinterkopf behalten.
- **Web Push lässt sich browser-seitig nicht vollständig in dieser Sandbox testen** — Chromium
  braucht für `pushManager.subscribe()` Zugriff auf einen echten Push-Dienst (Google FCM), den es
  in diesem Testcontainer nicht gibt (`AbortError: Registration failed - push service not
  available`). Backend-seitig (Subscribe-Speicherung, Zustellversuch, Pruning) end-to-end
  verifiziert; die eine Lücke ist reine Umgebungs-Einschränkung, nicht App-Verhalten — bei realer
  Nutzung auf einem echten Gerät nicht relevant.

## Nächster sinnvoller Schritt

Phase 5 (Push-Benachrichtigungen) ist fertig, aber **noch nicht committed** —
Arbeitsverzeichnis hat uncommitted Changes (siehe `git status`). Erstmal committen/pushen, dann
weiter mit Phase 6 (Claude-API-Integration: effiziente Übungsauswahl/Zielsetzung, hinter
`CLAUDE_API_ENABLED`) oder Phase 7 (Politur & VPS-Deployment). Siehe `ROADMAP.md`.

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
- **Docker Compose**: lokale Entwicklung (Postgres + Backend, Frontend auf dem Host) und
  Produktion (+ Caddy, automatisches HTTPS) — Config validiert, echter `docker compose up`
  in dieser Sandbox nicht möglich (kein laufender Docker-Daemon), daher Backend/Frontend
  stattdessen direkt gegen eine lokale Postgres-Instanz getestet

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
- Aktiver Branch: `main` (PR #1 mit der vorherigen Session bereits gemerged)
- Bisherige Commits: Foundation (Monorepo/Auth/Tracking-Tabelle) → Übungs-API mit Import →
  Übungsbibliothek-UI (Phase 1) → Trainingsplan-Rotation (Phase 2) → Ziele (Phase 3) —
  Phase 1–3 noch nicht committed, siehe unten

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
PATCH  /workout-logs/:id
DELETE /workout-logs/:id        # Soft-Delete

GET    /training-plan           # legt bei Bedarf an, rotiert überfällige Phasen automatisch nach

GET    /goals
POST   /goals                   # exerciseId Pflicht bei type WEIGHT/REPS
PATCH  /goals/:id               # targetValue/targetDate/achievedAt
DELETE /goals/:id
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
- `PushSubscription` — Web-Push-Abos (noch ungenutzt)

## Bekannte Lücken

- **Kein Video** in der importierten Übungsbibliothek — `free-exercise-db` liefert nur Bilder,
  keine kostenlose Quelle mit Video gefunden. `videoUrl` bleibt leer bis manuell gepflegt oder
  eine neue Quelle angebunden wird.
- **Keine Frontend-UI** mehr offen außer Offline-Sync, Push-Erinnerungen und
  Claude-API-Integration (Phasen 4–6) — Backend/Datenmodell dafür ist vorbereitet, siehe
  `ROADMAP.md`. Phasen 1–3 (Übungsbibliothek, Trainingsplan-Rotation, Ziele) sind seit dieser
  bzw. der vorherigen Session fertig, siehe oben.
- **Kein Bodyweight-Tracking-Modell** — `Goal.type = BODYWEIGHT` speichert nur einen Zielwert,
  es gibt keinen Log für den tatsächlichen Körpergewichtsverlauf. Fortschritt für diesen (und
  `CUSTOM`) Ziel-Typ ist deshalb bewusst ein manueller "Als erreicht markieren"-Toggle statt
  einer berechneten Kennzahl — kein Bug, sondern absichtlich minimal gehalten, siehe
  `ARCHITECTURE.md`.
- **Docker-Daemon** war in einer früheren Sandbox nicht verfügbar, ist es in dieser aber — jede
  Session seit Phase 1 hat Postgres via `docker run` (Alternativ-Ports 5433/3001 wegen
  Portkonflikten mit anderen lokalen Projekten) tatsächlich live hochgefahren und Backend+Frontend
  end-to-end dagegen getestet, nicht nur `docker compose config` validiert.
- `pnpm-workspace.yaml` brauchte `allowBuilds: true` für `@prisma/client`/`bcrypt`/`esbuild`/
  `prisma`, sonst bricht `pnpm install` mit `ERR_PNPM_IGNORED_BUILDS` ab (neueres pnpm blockiert
  Postinstall-Skripte standardmäßig) — gefixt, aber wie der Rest **noch nicht committed**.

## Nächster sinnvoller Schritt

Phase 1 (Übungsbibliothek-UI), Phase 2 (Trainingsplan-Rotation) und Phase 3 (Ziele) sind fertig,
aber **noch nicht committed** — Arbeitsverzeichnis hat uncommitted Changes (siehe `git status`).
Erstmal committen/pushen, dann weiter mit Phase 4 (Offline-first + Sync: Dexie.js/IndexedDB,
Mutations-Queue). Siehe `ROADMAP.md` Phase 4 für Details.

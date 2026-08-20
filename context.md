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
- Aktiver Branch: `claude/fitness-tracker-pwa-cbb4xf` (auf `origin` gepusht, sauber)
- Bisherige Commits: Foundation (Monorepo/Auth/Tracking-Tabelle) → Übungs-API mit Import

## Backend-Endpunkte (alle unter `/api`, außer `/health`)

```
GET    /health                  # kein Auth nötig

POST   /auth/register           # setup-token-geschützt
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
GET    /auth/me

GET    /exercises?search=       # gecappt auf 200 Treffer
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
```

Alle Routen außer `/health`, `/auth/register`, `/auth/login`, `/auth/refresh` erfordern
`Authorization: Bearer <accessToken>`.

## Datenmodell (`backend/prisma/schema.prisma`)

Vollständig für die gesamte Roadmap angelegt, auch wo noch keine UI existiert:

- `User`, `RefreshToken` — Auth
- `Exercise` — Name, Beschreibung, Video-/Bild-URLs, Equipment, Muskelgruppen,
  `source`/`sourceId` für idempotenten Import
- `WorkoutLog` — Satz/Wiederholungen/Gewicht/Übung, `clientId` (Offline-Sync-Idempotenz),
  Soft-Delete
- `TrainingPlan` + `TrainingPlanPhaseHistory` — 8-Wochen-Rotation (noch ohne UI/Scheduler)
- `Goal` — Zielsetzung (noch ohne UI)
- `PushSubscription` — Web-Push-Abos (noch ungenutzt)

## Bekannte Lücken

- **Kein Video** in der importierten Übungsbibliothek — `free-exercise-db` liefert nur Bilder,
  keine kostenlose Quelle mit Video gefunden. `videoUrl` bleibt leer bis manuell gepflegt oder
  eine neue Quelle angebunden wird.
- **Keine Frontend-UI** für Übungsbibliothek, Trainingsplan-Rotation, Ziele, Offline-Sync,
  Push-Erinnerungen, Claude-API-Integration — Backend/Datenmodell ist vorbereitet, siehe
  `ROADMAP.md` für die Reihenfolge.
- **Docker-Daemon** in dieser Entwicklungssandbox nicht verfügbar — `docker compose up` wurde
  nur über `docker compose config` validiert, nicht live durchlaufen. Auf einem echten VPS sollte
  das unproblematisch sein, aber beim ersten Deploy einmal gegenprüfen.

## Nächster sinnvoller Schritt

Laut letzter Absprache: Phase 1 UI (Übungsbibliothek browsen/durchsuchen + Detailansicht), da das
Backend dafür bereits steht. Siehe `ROADMAP.md` Phase 1 für Details.

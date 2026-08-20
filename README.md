# Fitnesstracker

Ein werbefreier, persönlicher Fitnesstracker als installierbare PWA. Sätze/Wiederholungen/Gewicht
pro Übung protokollieren, Trainingsplan-Phasen rotieren automatisch alle 8 Wochen, offline nutzbar
mit Sync sobald wieder online. Siehe [`ARCHITECTURE.md`](./ARCHITECTURE.md) für die technischen
Entscheidungen und [`ROADMAP.md`](./ROADMAP.md) für den vollständigen Ausbauplan.

Aktueller Stand (Phase 0–4 – Foundation, Übungsbibliothek, Trainingsplan-Rotation, Ziele &
Offline-Sync): Login/Registrierung, die Trainings-Tabelle (Satz/Wiederholungen/Gewicht/Übung,
inklusive Offline-Nutzung mit automatischer Sync sobald wieder online), die Übungsbibliothek
(durchsuchen, nach Muskelgruppe/Equipment filtern, Detailansicht), die automatische
8-Wochen-Trainingsplan-Rotation (Aufbau → Muskelausdauer → Negativ) und Ziele
(Gewicht/Wiederholungen pro Übung mit automatischem Fortschritt, Körpergewicht/Sonstiges mit
manueller Erreicht-Markierung) sind Ende-zu-Ende lauffähig. Die Übungs-API liefert dafür volle
CRUD-Verwaltung plus einen Import-Mechanismus, der Übungen aus externen, frei verfügbaren
Datenbanken zieht und in die eigene DB schreibt (siehe unten). Push-Erinnerungen und
Claude-API-Integration sind als Datenmodell bereits angelegt, aber noch ohne UI (siehe Roadmap).

## Stack

- **Datenbank**: PostgreSQL
- **Backend**: Node.js, TypeScript, Fastify, Prisma
- **Frontend**: React, TypeScript, Vite, Tailwind CSS, TanStack Query, vite-plugin-pwa
- **Monorepo**: pnpm workspaces (`backend/`, `frontend/`, `packages/shared/`)
- **Deployment**: Docker Compose + Caddy (automatisches HTTPS) auf einem eigenen VPS

## Voraussetzungen

- Node.js ≥ 20, pnpm ≥ 9
- PostgreSQL 16 (lokal installiert oder via Docker)
- Docker + Docker Compose (für den vollständigen Dev-Stack bzw. Deployment)

## Lokale Entwicklung

```bash
pnpm install
cp .env.example .env   # Werte anpassen, insbesondere SETUP_TOKEN und die JWT-Secrets
```

### Variante A: Postgres + Backend über Docker, Frontend auf dem Host (empfohlen für Dev)

```bash
docker compose up -d postgres backend
pnpm --filter backend prisma:seed   # einmalig: Beispiel-Übungen anlegen
pnpm --filter frontend dev          # http://localhost:5173, proxied /api zum Backend
```

### Variante B: Alles lokal ohne Docker

```bash
# eigene Postgres-Instanz vorausgesetzt, DATABASE_URL in .env entsprechend anpassen
pnpm --filter backend prisma:migrate
pnpm --filter backend prisma:seed
pnpm --filter backend dev     # http://localhost:3000
pnpm --filter frontend dev    # http://localhost:5173 (in einem zweiten Terminal)
```

Registrierung erfordert das `SETUP_TOKEN` aus der `.env` (schützt die offene Registrierung auf
einem öffentlich erreichbaren VPS, da die App nur für dich gedacht ist).

## Übungen importieren

Statt Übungen von Hand zu pflegen, gibt es einen Import-Endpunkt, der einen kompletten
Übungskatalog aus einer externen Quelle zieht und per Upsert (idempotent, anhand von
Quelle+externer-ID) in die eigene DB schreibt — mehrfaches Ausführen legt nichts doppelt an,
sondern aktualisiert nur:

```bash
# Verfügbare Quellen auflisten
curl -H "Authorization: Bearer $ACCESS_TOKEN" http://localhost:3000/api/exercises/sources

# Import anstoßen (aktuell: "free-exercise-db", ~870 Übungen, dauert wenige Sekunden)
curl -X POST http://localhost:3000/api/exercises/import \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H 'Content-Type: application/json' \
  -d '{"source":"free-exercise-db"}'
```

Neue Quellen anbinden: `ExerciseSourceAdapter` in `backend/src/modules/exercises/sources/`
implementieren (Interface in `sources/types.ts`) und in `sources/index.ts` registrieren — der
Import-Endpunkt braucht dafür keine Änderung. Details und Quellen-Übersicht in
[`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Produktions-Deployment (eigener VPS)

```bash
cp .env.example .env   # echte Secrets + DOMAIN setzen
docker build --target export -f frontend/Dockerfile --output frontend/dist .
docker compose -f docker-compose.prod.yml up -d --build
```

Caddy holt automatisch ein Let's-Encrypt-Zertifikat für `DOMAIN` und dient sowohl das gebaute
Frontend als auch die API (`/api/*` → Backend) same-origin, damit Cookie-basierte Auth ohne CORS
funktioniert. Vor dem Deploy: DNS-A-Record auf den VPS zeigen lassen, Ports 80/443 offen.

## Nützliche Skripte

| Befehl | Beschreibung |
| --- | --- |
| `pnpm --filter backend prisma:migrate` | Neue Migration erstellen/anwenden (Dev) |
| `pnpm --filter backend prisma:deploy` | Migrationen anwenden (Prod) |
| `pnpm --filter backend prisma:seed` | Beispiel-Übungen einspielen |
| `pnpm typecheck` | TypeScript-Check in allen Packages |
| `pnpm build` | Backend + Frontend bauen |

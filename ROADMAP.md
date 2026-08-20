# Roadmap

## Phase 0 — Foundation ✅ (dieser Stand)

- Monorepo-Grundgerüst (pnpm Workspaces, Docker Compose, Caddy)
- Vollständiges Prisma-Datenmodell für die gesamte Roadmap
- Auth: Registrierung (Setup-Token-geschützt), Login, Refresh-Rotation, Logout
- Trainings-Tabelle: Satz/Wiederholungen/Gewicht/Übung, CRUD, Ende-zu-Ende lauffähig
- Installierbare PWA-Hülle (Manifest, Icons, Service Worker mit `NetworkOnly` für `/api/**`)
- Übungs-API: CRUD + Detailansicht-Endpunkt, pluggable Import-Mechanismus für externe Quellen
  (`POST /api/exercises/import`), erste Quelle angebunden (free-exercise-db, 870+ Übungen)

## Phase 1 — Übungsbibliothek (UI)

- Backend/API bereits fertig (siehe Phase 0) — hier fehlt nur noch die Oberfläche:
- Browse-/Such-UI für den importierten Katalog (Filter nach Muskelgruppe/Equipment)
- "Übung öffnen"-Detailansicht mit Beschreibung der Ausführung + Bildern
- Video-Lücke schließen: entweder manuell pro Übung nachpflegen oder eine weitere Quelle mit
  Video anbinden (neuer Adapter, siehe `ARCHITECTURE.md`)

## Phase 2 — Trainingsplan-Rotation

- UI für `TrainingPlan` / `TrainingPlanPhaseHistory`
- Backend-Scheduler: rotiert automatisch alle 8 Wochen, immer montags
  (Aufbau → Muskelausdauer → Negativ → Aufbau)
- Aktuelle Phase sichtbar im App-Shell (z. B. Badge neben "Plan"-Tab)

## Phase 3 — Ziele

- Ziele pro Übung oder Körpergewicht setzen (`Goal`-Modell existiert bereits)
- Fortschrittsansicht

## Phase 4 — Offline-first + Sync

- Dexie.js (IndexedDB) als lokaler Store
- Mutations-Queue, Sync-Manager auf Basis von `online`/`offline`-Events (kein Background-Sync-API,
  wegen fehlender iOS-Unterstützung)
- Konfliktauflösung über `clientId` + `updatedAt`

## Phase 5 — Push-Benachrichtigungen

- VAPID-Setup, Subscription-Flow im Frontend
- Erinnerung bei Trainingsplan-Wechsel (an den Scheduler aus Phase 2 gekoppelt)

## Phase 6 — Claude-API-Integration

- Effiziente Übungsauswahl auf Basis von Zielen/Trainingsphase
- Unterstützung bei der Zielsetzung
- Hinter `CLAUDE_API_ENABLED` — aktivierbar, sobald ein Anthropic API-Key vorhanden ist

## Phase 7 — Politur & VPS-Deployment

- `docker-compose.prod.yml` + Caddyfile live auf dem eigenen Server
- Backups (Postgres-Dump-Cronjob), einfaches Monitoring/Logging
- Lighthouse-PWA-Audit, echte App-Icons statt Platzhalter

# Roadmap

## Phase 0 — Foundation ✅ (dieser Stand)

- Monorepo-Grundgerüst (pnpm Workspaces, Docker Compose, Caddy)
- Vollständiges Prisma-Datenmodell für die gesamte Roadmap
- Auth: Registrierung (Setup-Token-geschützt), Login, Refresh-Rotation, Logout
- Trainings-Tabelle: Satz/Wiederholungen/Gewicht/Übung, CRUD, Ende-zu-Ende lauffähig
- Installierbare PWA-Hülle (Manifest, Icons, Service Worker mit `NetworkOnly` für `/api/**`)
- Übungs-API: CRUD + Detailansicht-Endpunkt, pluggable Import-Mechanismus für externe Quellen
  (`POST /api/exercises/import`), erste Quelle angebunden (free-exercise-db, 870+ Übungen)

## Phase 1 — Übungsbibliothek (UI) ✅

- Browse-/Such-UI (`/exercises`) für den importierten Katalog: Textsuche, Filter nach
  Muskelgruppe/Equipment (kombinierbar), "Mehr laden"-Pagination
- Backend erweitert: `GET /exercises` unterstützt jetzt `muscleGroup`/`equipment`/`page`/
  `pageSize` (vorher nur `search`, hart gedeckelt auf 200) + `GET /exercises/facets` für die
  Filter-Dropdown-Optionen
- "Übung öffnen"-Detailansicht (`/exercises/:id`) mit Bildern, Muskel-/Equipment-Tags,
  Beschreibung, Video-Link oder "Kein Video verfügbar"
- Bottom-Nav "Übungen"-Tab verlinkt, End-zu-Ende gegen echte Postgres-Instanz mit allen 873
  importierten Übungen getestet (Suche, Filter-Kombination, Pagination, Detail-Navigation)
- Video-Lücke weiterhin offen: entweder manuell pro Übung nachpflegen oder eine weitere Quelle
  mit Video anbinden (neuer Adapter, siehe `ARCHITECTURE.md`) — kein Blocker für diese Phase

## Phase 2 — Trainingsplan-Rotation ✅

- `GET /training-plan`: legt bei erstem Aufruf automatisch einen Plan an (Start: Montag der
  aktuellen Woche, Phase Aufbau) und rotiert überfällige Phasen nach — auch mehrere verpasste
  Zyklen am Stück (z. B. nach längerer Downtime), jeder abgeschlossene Zyklus landet als
  `TrainingPlanPhaseHistory`-Eintrag
- Backend-Scheduler (`trainingPlan.scheduler.ts`): eigener Tick alle 6h + einmal beim Boot,
  rotiert alle überfälligen Pläne unabhängig von Requests — Grundlage für die
  Phase-5-Push-Erinnerung, die an denselben Rotationsevent andocken wird
  (Aufbau → Muskelausdauer → Negativ → Aufbau, immer montags, siehe `ARCHITECTURE.md`)
- UI (`/plan`): aktuelle Phase, Startdatum, nächster Wechsel, vollständiger Verlauf; Badge mit
  aktueller Phase im "Plan"-Tab der Bottom-Nav
- Unique Constraint auf `TrainingPlanPhaseHistory(trainingPlanId, startedOn)` verhindert
  doppelte Verlaufs-Einträge, falls Scheduler-Tick und Request denselben Zeitraum gleichzeitig
  rotieren — end-to-end getestet inkl. Backdating/Catch-up-Szenario mit 10 nachgeholten Zyklen

## Phase 3 — Ziele ✅

- `GET/POST/PATCH/DELETE /goals`, vier Ziel-Arten: Gewicht/Wiederholungen (an eine Übung
  gebunden) sowie Körpergewicht/Sonstiges (frei, ohne Übungsbezug)
- Fortschrittsansicht für Gewicht/Wiederholungen: `currentValue` wird aus dem Bestwert der
  bisherigen `WorkoutLog`-Einträge zur verknüpften Übung berechnet (kein Zusatz-Datenmodell
  nötig) und als Fortschrittsbalken angezeigt. Körpergewicht/Sonstiges haben keine automatisch
  herleitbare Kennzahl — "erreicht" ist dort bewusst ein manueller Toggle
- UI (`/goals`): offene/erreichte Ziele getrennt, Erstellungs-Dialog mit typabhängigem
  Übungs-Auswahlfeld, Fortschrittsbalken, Erreicht-Toggle, Löschen

## Phase 4 — Offline-first + Sync ✅

- Nur die Trainings-Tabelle ist offline-fähig (der eigentliche "Satz an der Hantelbank
  protokollieren, ohne Empfang"-Anwendungsfall) — Übungsbibliothek/Plan/Ziele bleiben
  netzwerkgebunden, siehe `ARCHITECTURE.md` für die Begründung
- Dexie.js (IndexedDB) als lokaler Store: `workoutLogs`-Cache (`clientId` als Primärschlüssel,
  `id` ist `null` bis zur ersten erfolgreichen Sync) + `pendingMutations`-Queue
- Sync-Manager auf Basis von `online`/`offline`-Events (kein Background-Sync-API, wegen
  fehlender iOS-Unterstützung), holt beim Reconnect automatisch nach
- Konfliktauflösung: Mehrfach-Edits an derselben (noch nicht synchronisierten) Zeile werden in
  der Queue zu einer Mutation zusammengefasst (`clientId` als Schlüssel), statt jeden
  Zwischenstand einzeln nachzuspielen — end-to-end getestet: Anlegen + Bearbeiten offline blieb
  bei "1 ausstehend" statt zwei separaten Mutationen, und der Server bekam nie den
  Zwischenwert zu sehen
- Backend erweitert: `PATCH`/`DELETE /workout-logs/:id` akzeptieren jetzt auch die `clientId` als
  Identifier, weil eine offline angelegte Zeile vor der ersten Sync noch keine Server-`id` hat

## Phase 5 — Push-Benachrichtigungen ✅

- Backend: VAPID-Setup (`VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT`, optional — Push
  bleibt komplett inert ohne konfiguriertes Schlüsselpaar, gleiches Muster wie
  `CLAUDE_API_ENABLED`), `PushSubscription`-CRUD (`GET /push/vapid-public-key`,
  `POST`/`DELETE /push/subscribe`)
- Erinnerung bei Trainingsplan-Wechsel: an den Scheduler aus Phase 2 gekoppelt — nur der
  Hintergrund-Tick (`rotateAllDuePlans`) löst die Push aus, nicht das lazy Rotieren beim Öffnen
  von `/plan` (eine Push für den eigenen gerade ausgelösten Wechsel wäre sinnlos)
- Frontend: Subscription-Flow (`usePushSubscription`) auf der `/plan`-Seite, Service-Worker um
  `push`/`notificationclick`-Handler erweitert (`public/push-sw.js`, per `importScripts` in den
  von `vite-plugin-pwa` generierten SW eingebunden statt auf `injectManifest` umzustellen)
- End-to-end getestet: VAPID-Public-Key-Endpoint, Subscribe/Unsubscribe-Speicherung, und die
  komplette Rotation→Push-Kette (inkl. echtem Zustellversuch gegen einen absichtlich ungültigen
  Endpoint, der korrekt aus der DB entfernt wurde). Echtes `pushManager.subscribe()` im Browser
  ließ sich in der Sandbox nicht end-to-end verifizieren — Chromium meldet dort
  `AbortError: Registration failed - push service not available`, weil kein echter
  Push-Service (Google FCM) erreichbar ist; auf einem echten Gerät/Browser betrifft das nicht.

## Phase 6 — Claude-API-Integration

- Effiziente Übungsauswahl auf Basis von Zielen/Trainingsphase
- Unterstützung bei der Zielsetzung
- Hinter `CLAUDE_API_ENABLED` — aktivierbar, sobald ein Anthropic API-Key vorhanden ist

## Phase 7 — Politur & VPS-Deployment

- `docker-compose.prod.yml` + Caddyfile live auf dem eigenen Server
- Backups (Postgres-Dump-Cronjob), einfaches Monitoring/Logging
- Lighthouse-PWA-Audit, echte App-Icons statt Platzhalter

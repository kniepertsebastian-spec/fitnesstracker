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

## Phase 8 — Profil & Ernährungsrechner ✅

- `Profile`-Modell (1:1 mit User): Gewicht, Größe, Alter, Geschlecht, Aktivitätslevel, Ziel
  (Abnehmen/Halten/Aufbauen), `GET`/`PUT /profile` (immer Vollersatz, kein Teil-Update — die
  Felder ergeben nur zusammen Sinn)
- Kalorien-/Proteinrechner nach Mifflin-St-Jeor-Formel + Aktivitätsmultiplikator, Protein-Ziel
  nach Körpergewicht (g/kg je nach Ziel) — Standardformel, keine Sonderfälle. `bmr`/`tdee`/
  `targetCalories`/`targetProteinG` werden nie gespeichert, sondern bei jedem `GET` aus den
  Profil-Feldern neu berechnet, damit nach einer Bearbeitung nie ein veralteter Wert übrig
  bleibt
- Statische Liste unterschätzter/oft vergessener Ernährungstipps (kuratiert, kein
  Claude-API-Aufruf — das bleibt Phase 6 vorbehalten)
- UI (`/nutrition`, "Ernährung"-Tab in der Bottom-Nav): Formular + Tagesbedarf-Karte + Tipps-Liste
- End-to-end getestet: beide Formel-Zweige (männlich/weiblich unterschiedliches BMR-Offset),
  Persistenz über GET/PUT-Zyklus, Neuberechnung nach Bearbeitung eines Felds (Alter 25→31 senkte
  BMR exakt um die erwarteten 30 kcal)

## Phase 9 — Wasser-Tracking

- Täglicher Wasser-Zähler (schnelles Antippen für z. B. +250ml/+500ml), Tagesziel als Vorschlag
  aus `Profile.weightKg` abgeleitet, manuell überschreibbar
- Reset um Mitternacht, einfacher Verlauf der letzten Tage

## Phase 10 — Supplement-Erinnerungen & Referenzliste

- Liste eigener Supplements mit Name + Uhrzeit, tägliche Push-Erinnerung — nutzt die
  Push-Infrastruktur aus Phase 5 wieder, eigener Scheduler-Tick nach dem Muster von
  `trainingPlan.scheduler.ts` für die tägliche Auslösung
- Statische, kuratierte Referenzliste gängiger Supplements (Creatin, Whey, Koffein,
  Beta-Alanin, Citrullin-Malat, Vitamin D, Omega-3, Ashwagandha, …): Wirkung, grobe Einordnung
  ("wirklich wirksam" vs. "situativ" vs. "überschätzt", auf Basis gängiger
  Studienlage/Konsens) und übliche Dosierungsempfehlung — statischer Datensatz wie die
  Ernährungstipps aus Phase 8, kein Live-Scraping/externe API, aus denselben Gründen wie dort

## Phase 11 — Körperkomposition-Tracking (manuelle Erfassung)

- Manuelles Erfassen von Waagen-Werten über Zeit (Gewicht, Körperfett-%, Muskelmasse,
  Wasseranteil etc.) als Verlauf, kein automatischer Datei-Import (siehe Entscheidung unten)
- Kurze Erklärung pro Kennzahl (was sie bedeutet, grobe Referenzbereiche) + einfache
  Einordnung/Trend-Anzeige gegenüber dem letzten Wert
- **Bewusst kein automatischer Scale-Import in dieser Phase** — Dateiformate unterscheiden sich
  stark zwischen Herstellern (Withings, Renpho, Garmin, …); manuelle Erfassung deckt den
  Bedarf ab, ein Adapter für ein konkretes Gerät kann bei Bedarf später ergänzt werden, ähnlich
  dem `ExerciseSourceAdapter`-Muster aus Phase 0

## Phase 12 — Fortschritts-Fotos

- Erinnerung (Push, wiederkehrend, z. B. wöchentlich) + Upload für Vergleichsfotos ("Spiegel-Foto")
- Speicherung auf dem eigenen VPS-Dateisystem via Docker Volume — konsistent mit "keine externen
  Managed-Dienste" aus `ARCHITECTURE.md`, kein S3/Cloud-Storage-Anbieter nötig
- Nur für den eingeloggten Nutzer sichtbar; Vorher/Nachher-Ansicht zum direkten Vergleich zweier
  Zeitpunkte

## Phase 13 — Automatische Ziel-Vorschläge

- Erweitert die bestehende Ziele-Funktion (Phase 3) um automatisch vorgeschlagene
  Gewichts-Ziele pro Übung mit realistischem Zieldatum, basierend auf der bisherigen
  `WorkoutLog`-Progression zur jeweiligen Übung
- Deadline darf nicht unmöglich sein — Ableitung aus einer konservativen, literaturüblichen
  Progressionsrate statt einer linearen Extrapolation der bisherigen (oft unrealistisch
  optimistischen) Steigerungsrate

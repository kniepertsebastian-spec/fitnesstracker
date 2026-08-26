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

## Phase 9 — Wasser-Tracking ✅

- Täglicher Wasser-Zähler (Antippen für +100/+250/+500 ml, sowie -250 ml zum Korrigieren eines
  Fehltipps — nie unter 0 geklemmt), `GET /water`, `POST /water/log`
- Tagesziel als Vorschlag aus `Profile.weightKg` (35 ml/kg) abgeleitet, ohne Profil ein
  pauschaler Standardwert (2500 ml); manuell überschreibbar über `PUT /water/target`
  (Override lebt als `waterTargetMlOverride` auf `Profile` — setzt daher ein bestehendes Profil
  voraus, sonst `409 Conflict`)
- Verlauf der letzten 7 Tage, tageweise nullgefüllt (kein Loch an ruhigen Tagen)
- UI als Karte innerhalb der bestehenden `/nutrition`-Seite statt eines eigenen Bottom-Nav-Tabs
  — bewusste Entscheidung gegen unbegrenztes Nav-Wachstum mit jeder weiteren Phase, siehe
  `ARCHITECTURE.md`
- End-to-end getestet: Zielvorschlag aus Profilgewicht, Klemmen bei 0, Override setzen/löschen,
  409 ohne Profil, Zero-Fill im Verlauf

## Phase 10 — Supplement-Erinnerungen & Referenzliste ✅

- Liste eigener Supplements mit Name + Uhrzeit (`GET/POST/PATCH/DELETE /supplements`), tägliche
  Push-Erinnerung — nutzt die Push-Infrastruktur aus Phase 5 wieder, eigener Scheduler-Tick
  (`supplement.scheduler.ts`, jede Minute statt alle 6h wie beim Trainingsplan) nach dem Muster
  von `trainingPlan.scheduler.ts`
- Erinnerungs-Uhrzeit ist **lokale Wanduhrzeit in der beim Anlegen erfassten Zeitzone des
  Browsers** (`Intl.DateTimeFormat().resolvedOptions().timeZone`), nicht UTC — eine Erinnerung
  zur falschen Stunde wäre ein echter, spürbarer Bug, anders als die Tages-Grenzen-Unschärfe bei
  Wasser/Trainingsplan. Backend vergleicht rein mit `Intl.DateTimeFormat`, keine
  Zeitzonen-Bibliothek nötig
- Statische, kuratierte Referenzliste gängiger Supplements (Creatin, Whey, Koffein,
  Beta-Alanin, Citrullin-Malat, Vitamin D, Omega-3, Ashwagandha, BCAA, pflanzliche
  Testosteron-Booster, Fatburner, Glutamin): Wirkung, grobe Einordnung ("wirklich wirksam" vs.
  "situativ" vs. "überschätzt", auf Basis gängiger Studienlage/Konsens) und übliche
  Dosierungsempfehlung — statischer Datensatz wie die Ernährungstipps aus Phase 8, kein
  Live-Scraping/externe API, aus denselben Gründen wie dort
- UI als Karten auf der bestehenden `/nutrition`-Seite, kein eigener Nav-Tab
- End-to-end getestet: Reminder-Matching direkt gegen die aktuelle lokale Uhrzeit in
  verschiedenen Zeitzonen (Treffer/Nicht-Treffer/deaktiviert korrekt unterschieden), kein
  Doppel-Versand innerhalb derselben Minute, CRUD, Validierung des Zeitformats

## Phase 11 — Körperkomposition-Tracking (manuelle Erfassung) ✅

- Manuelles Erfassen von Waagen-Werten über Zeit (Gewicht Pflicht, Körperfett-%/Muskelmasse/
  Wasseranteil optional) als Verlauf (`GET/POST/PATCH/DELETE /body-composition`), kein
  automatischer Datei-Import (siehe Entscheidung unten)
- Kurze Erklärung pro Kennzahl + Trend-Pfeil (↑/↓/→) gegenüber dem letzten Wert; Körperfett-%
  zusätzlich grob kategorisiert (ACE-Fitness-Kategorien, geschlechtsabhängig — nur falls
  Geschlecht im Ernährungsprofil hinterlegt ist, sonst keine Kategorie statt einer Vermutung)
- **Bewusst kein automatischer Scale-Import in dieser Phase** — Dateiformate unterscheiden sich
  stark zwischen Herstellern (Withings, Renpho, Garmin, …); manuelle Erfassung deckt den
  Bedarf ab, ein Adapter für ein konkretes Gerät kann bei Bedarf später ergänzt werden, ähnlich
  dem `ExerciseSourceAdapter`-Muster aus Phase 0
- **Schließt eine dokumentierte Lücke aus Phase 3**: `Goal.type = BODYWEIGHT` hatte bisher immer
  `currentValue: null`, weil es keinen Körpergewichts-Log gab. `computeCurrentValue` in
  `goal.service.ts` nutzt jetzt den letzten erfassten Wert aus dieser Phase — end-to-end
  verifiziert (neues Gewicht erfasst → bestehendes BODYWEIGHT-Ziel zeigt sofort den aktuellen
  Wert)
- UI als fünfter Tab ("Körper") auf der bestehenden `/nutrition`-Seite, kein eigener Nav-Tab

## Phase 12 — Fortschritts-Fotos ✅

- `POST /progress-photos` (multipart, `@fastify/multipart`, 10MB-Limit, jpeg/png/webp): Datei
  landet unter `UPLOADS_DIR` (Default `./uploads`, relativ zum Backend-Package) mit
  generiertem UUID-Dateinamen; optionales `takenAt`-Feld überschreibt den Server-Zeitstempel
  (z. B. für ein nachträglich importiertes altes Foto)
- `GET /progress-photos`: Metadaten-Liste (nur `id` + `takenAt`) — der Dateiname/Pfad ist nie im
  DTO enthalten und wird nur intern zum Auflösen des Pfads benutzt
- `GET /progress-photos/:id/file`: authentifizierter Stream der Bilddatei nach
  Eigentümer-Check (404 bei fremder/ungültiger ID) — bewusst keine öffentliche
  Static-File-Route, da es sich um private Körperfotos handelt
- `DELETE /progress-photos/:id`: entfernt DB-Zeile und Datei auf der Platte
- Speicherung auf dem eigenen VPS-Dateisystem via Docker Volume — konsistent mit "keine externen
  Managed-Dienste" aus `ARCHITECTURE.md`, kein S3/Cloud-Storage-Anbieter nötig; in
  `docker-compose.prod.yml` als neues benanntes Volume `uploads:/app/backend/uploads`
  (Dev-Compose braucht das nicht, da dort das ganze Repo gebindmountet ist)
- Wöchentliche Push-Erinnerung: täglicher Scheduler-Tick prüft pro Nutzer, ob das neueste Foto
  (oder — falls noch keins existiert — das Account-Erstelldatum) ≥ 7 Tage zurückliegt; kein
  eigenes "zuletzt erinnert"-Feld nötig, die Erinnerung wiederholt sich dann bewusst an jedem
  weiteren Tag bis zum nächsten Upload (anders als die exakt-einmal-täglich-Regel der
  Supplement-Erinnerung aus Phase 10, hier reicht die grobe Wochen-Kadenz)
- Nur für den eingeloggten Nutzer sichtbar; Vorher/Nachher-Ansicht (zwei Dropdowns) zum direkten
  Vergleich zweier Zeitpunkte, nebeneinander dargestellt
- Frontend holt jedes Bild als authentifizierten Blob (`apiFetchBlob` in `client.ts`) und zeigt
  es über `URL.createObjectURL()` an, da ein normales `<img src>` den Bearer-Token nicht
  mitschicken kann — Upload läuft über eine neue `apiUpload`-Helper-Funktion (FormData statt
  JSON-Body), beide mit dem gleichen 401-Refresh-Retry wie `apiFetch`
- UI als eigener Abschnitt innerhalb des bestehenden "Körper"-Tabs auf `/nutrition` (neben
  `BodyCompositionCard`), kein neuer Tab und kein neuer Bottom-Nav-Eintrag

## Phase 13 — Automatische Ziel-Vorschläge ✅

- `GET /goals/suggestions`: bis zu 5 vorgeschlagene WEIGHT-Ziele, eins pro trainierter Übung —
  nur für Übungen mit mindestens 3 geloggten Sätzen (gegen Vorschläge aus einem einzelnen
  Zufallstreffer) und ohne bereits offenes WEIGHT-Ziel für dieselbe Übung (keine Dopplungen),
  sortiert nach zuletzt trainiert
- Zielwert: bisheriger Bestwert (`_max(weightKg)`) + 5 % Steigerung, mindestens +1 kg, gerundet
  auf 0,5 kg — damit auch leichte Isolationsübungen einen sinnvollen Zielwert statt einer
  Nullrunde bekommen
- Zieldatum **bewusst nicht** aus der linearen Extrapolation der bisherigen (oft durch
  Anfänger-Anfangsgewinne unrealistisch optimistischen) Steigerungsrate abgeleitet, sondern aus
  einer festen, konservativen, literaturüblichen Progressionsrate von 0,25 kg/Woche
  (≈ 1 kg/Monat) — siehe `ARCHITECTURE.md` für die Begründung
- Kein eigener "Vorschlag annehmen"-Endpunkt — ein Vorschlag wird einfach über das bestehende
  `POST /goals` mit den vorgeschlagenen Werten übernommen; danach verschwindet er automatisch aus
  der Vorschlagsliste (weil jetzt ein offenes WEIGHT-Ziel für diese Übung existiert)
- UI: neue "Vorschläge"-Sektion oberhalb der bestehenden Zielliste auf `/goals`, mit
  Ein-Klick-"Übernehmen"-Button pro Vorschlag

## Phase 14 — Tages-Challenge (Bodyweight, überall machbar) ✅

- `GET /daily-challenge`: legt bei erstem Aufruf des Tages automatisch 3 zufällige Übungen mit
  Zufalls-Zielwiederholungen an (10/15/20/25), wiederholte Aufrufe am selben Tag liefern
  dieselbe Auswahl — kein neues Datenmodell für die Übungsauswahl nötig, gespeist aus dem
  bereits importierten Übungskatalog (`Exercise.equipment = "body only"`,
  `category IN (strength, plyometrics)`)
- `POST /daily-challenge/:id/reps { delta }`: Wiederholungen antippen/hinzufügen, bei 0
  geklemmt, kein Deckel nach oben (mehr als das Ziel ist ein gutes Ergebnis, kein Fehler)
- Leichter Keyword-Filter auf Übungsnamen (bench/hanging/wall/chair/box/step/dip) verbessert die
  "wirklich überall, ohne Geräte"-Passung zusätzlich zum Equipment-Tag — Bestenfalls-Heuristik,
  keine Garantie, siehe `ARCHITECTURE.md`
- UI als Karte auf der bestehenden `/`-Seite (Training-Log), kein eigener Nav-Tab — gleiche
  Begründung wie beim Wasser-Tracking aus Phase 9

## Phase 15 — Plan auf der Startseite & Plan-Export/Import ✅

- `/`-Seite (Training-Log) zeigt jetzt eine Karte mit den Übungen der aktuell aktiven
  Trainingsplan-Phase direkt unter der Tages-Challenge, mit Link zurück zur `/plan`-Seite — der
  Plan war bisher nur auf `/plan` sichtbar, obwohl die Startseite die Seite ist, die täglich
  zuerst geöffnet wird
- `GET /plan-exercises/export` (Query-Param `format=csv|json|xml`) exportiert den kompletten Plan
  (alle drei Phasen) als Datei; `POST /plan-exercises/import` (gleicher `format`-Parameter,
  Datei-Upload) liest dieselben drei Formate wieder ein — Import unterstützt genau die Formate,
  die auch exportiert werden können, wie gefordert
- Import matched Übungen anhand ihres Namens (deutsch oder englisch, ohne Groß-/Kleinschreibung)
  gegen den bestehenden Übungskatalog, statt eine `exerciseId` zu erwarten — die ist zwischen
  einem Export und einem späteren Import (oder einer anderen Instanz) nicht stabil. Unbekannte
  Namen werden übersprungen und als Fehlermeldung zurückgegeben, statt den ganzen Import
  abzubrechen; bereits vorhandene Phase/Übung-Kombinationen werden aktualisiert (Sätze/
  Wiederholungen), neue angehängt
- Kein CSV/XML-Parser als Abhängigkeit — bei drei festen, flachen Feldern lohnt sich das nicht;
  siehe `ARCHITECTURE.md` für die Details der Eigenimplementierung

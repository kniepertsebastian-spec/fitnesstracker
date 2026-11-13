# Roadmap

Das ist die eine Roadmap des Projekts. Sie enthält vier Teile:

1. [Teil 1 – Phasen 0–34](#teil-1--phasen-034): was gebaut und geprüft wurde, mit Konzept und Verifikation je Phase.
2. [Teil 2 – Roadmap 3](#teil-2--roadmap-3-fitnesstracker): Nutzerwünsche und PWA-Review vom 19.10.2026 (P0–P4). Im Code verweisen Kommentare mit „roadmap3 P1.2“ usw. auf diese Punkte.
3. [Teil 3 – Roadmap 2](#teil-3--roadmap-2-todo-vor-hardening): die Checkliste „TODO vor Hardening“, vollständig erledigt. Die Phasen 22–33 in Teil 1 setzen sie um.
4. [Teil 4 – Roadmap v2, Ergänzungen](#teil-4--roadmap-v2-ergänzungen): Leitprinzip und Prioritäten P0–P2 (ursprünglich eine Word-Datei). P0.7 steht als Phase 34 in Teil 1, einiges andere in Roadmap 3.

Die UI-Planung steht getrennt in [`docs/ROADMAP-UI.md`](./docs/ROADMAP-UI.md), neue Änderungen im [`CHANGELOG.md`](./CHANGELOG.md).

---

# Teil 1 – Phasen 0–34

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

<!-- ROADMAP_FITNESSTRACKER.md -->
## Roadmap & Refactoring: Fitnesstracker

### 16. Robustheit & Scheduler
- [x] **Timing-Drift bei Supplement-Erinnerungen abfangen**
  - **Problem:** In `supplement.service.ts` (`checkAndSendReminders`) prüft die Bedingung exakt auf `local.time === supplement.reminderTime`[cite: 4]. Blockiert der Event-Loop für wenige Sekunden und der Tick springt von z. B. `07:59:58` auf `08:00:02`, wird die Benachrichtigung für diesen Tag komplett verpasst.
  - **Lösung:** Prüfung auf `local.time >= supplement.reminderTime` umstellen und über `supplement.lastRemindedOn !== local.day` sicherstellen, dass die Nachricht pro Tag genau einmal feuert.
  - **Umsetzung:** Wie beschrieben umgestellt; end-to-end mit einer absichtlich in die Vergangenheit gesetzten `reminderTime` verifiziert (`sent: 1`, `lastRemindedOn` gesetzt, zweiter Lauf `sent: 0`, kein Doppel-Versand).
- [x] **Distributed Locks für In-Memory Scheduler**
  - **Problem:** Die Scheduler (`trainingPlan`, `supplement`, `progressPhoto`) laufen als einfache `setInterval`-Timer im Fastify-Prozess[cite: 4]. Bei mehreren Containern oder Node-Cluster-Instanzen würden Push-Nachrichten mehrfach an Nutzer versendet.
  - **Lösung:** Verteilte Locks via Redis einbauen oder die Scheduler-Logik in einen dedizierten Worker-Container auslagern.
  - **Umsetzung:** Postgres-Advisory-Locks (`pg_try_advisory_lock`/`pg_advisory_unlock`, `backend/src/lib/schedulerLock.ts`) statt Redis — Postgres ist ohnehin die einzige zwischen allen Backend-Instanzen geteilte Ressource, kein zusätzlicher Dienst nötig. Jeder Scheduler hat einen eigenen, festen Lock-Key; ein Tick, der den Lock nicht bekommt, überspringt diesen Durchlauf non-blocking statt zu warten. End-to-end mit zwei parallelen `PrismaClient`-Instanzen verifiziert: der zweite, überlappende Aufruf wurde übersprungen, ein dritter nach Freigabe lief wieder normal.

### 17. Security & APIs
- [x] **Rate-Limiting für sensible Auth-Routen**
  - **Problem:** Auf `/api/auth/login` und `/api/auth/register` existiert bisher kein Brute-Force-Schutz auf Netzwerk-/API-Ebene[cite: 4].
  - **Lösung:** `@fastify/rate-limit` registrieren und auf Auth-Routen auf max. 5 Requests pro Minute limitieren.
  - **Umsetzung:** Wie beschrieben, `global: false` (nur `/auth/login` und `/auth/register` betroffen, per `config: { rateLimit }` auf der Route). End-to-end getestet: 6. Anfrage innerhalb einer Minute liefert `429`, andere Routen (`/health`) bleiben unlimitiert.

### 18. Logik & Benutzerfreundlichkeit
- [x] **Mathematisch korrekte Gleichverteilung bei Daily Challenges**
  - **Problem:** In `dailyChallenge.service.ts` wird `sort(() => Math.random() - 0.5)` für die Übungsauswahl genutzt[cite: 4]. Das führt in der V8-Engine zu einer statistisch ungleichmäßigen Verteilung.
  - **Lösung:** Einen standardkonformen Fisher-Yates (Knuth) Shuffle implementieren.
  - **Umsetzung:** Wie beschrieben; über 200.000 Testläufe zeigt jede Position eine annähernd gleichverteilte Trefferquote (± 1 %), statt der bekannten Verzerrung von `sort(() => Math.random() - 0.5)`.
- [x] **Entkopplung des Wasserziels vom Ernährungsprofil**
  - **Problem:** In `water.service.ts` (`setTargetOverride`) wirft das Backend einen `ConflictError`, wenn der User noch kein `Profile` mit Körpermaßen angelegt hat[cite: 4].
  - **Lösung:** Ein benutzerdefiniertes Wasserziel unabhängig vom vollständigen Ernährungsprofil speichern oder einen Default-Fallback erlauben.
  - **Umsetzung:** `waterTargetMlOverride` von `Profile` auf `User` verschoben (Migration `20260826190000_move_water_target_to_user`, bestehende Werte übernommen) — `User` existiert immer für einen eingeloggten Nutzer, ein eigenes Wasserziel braucht damit kein Ernährungsprofil mit Gewicht/Größe/Alter/Geschlecht mehr. End-to-end verifiziert: `PUT /water/target` liefert `200`/`isCustomTarget: true` ganz ohne vorhandenes `Profile`


<!-- ROADMAP_FITNESSTRACKER_FEATURES.md -->
## Feature-Roadmap: Fitnesstracker

---

## Phase 19: KI-Trainingsplan-Generator (BYOK – Bring Your Own Key) ✅

- [x] **Multi-Provider KI-Schnittstelle**
  - **Konzept:** Einstellungsbereich in der PWA zur flexiblen Auswahl und Hinterlegung eines API-Keys (Google Gemini Free Tier, OpenAI ChatGPT, Groq, OpenRouter).
  - **Umsetzung:** Universeller API-Client im Fastify-Backend (OpenAI-kompatibles Schema), der Requests an den gewählten Endpunkt leitet. API-Keys werden mit AES-256-GCM verschlüsselt in der Datenbank gespeichert.
  - **Umgesetzt:** `GET/PUT/DELETE /ai-settings` (nie der entschlüsselte Key in der Antwort) + `aiClient.ts` mit einer Provider-Konfiguration (Base-URL/Default-Modell) für alle vier Anbieter, alle über dieselbe OpenAI-kompatible Chat-Completions-Form. Verschlüsselung über einen neuen, optionalen `AI_SETTINGS_ENCRYPTION_KEY` (gleiches "inert ohne Config"-Muster wie VAPID/`CLAUDE_API_KEY`). End-to-end verifiziert: Verschlüsselung/Entschlüsselung round-trip, falscher Schlüssel wird abgelehnt, `GET /ai-settings` liefert nie den Klartext-Key, echter HTTP-Request an einen realen Anbieter wurde vom Sandbox-Netzwerk korrekt mit `502` abgefangen statt den Server abstürzen zu lassen.

- [x] **Catalog-Constraint & Structured JSON Output**
  - **Konzept:** Verhindert Halluzinationen von nicht vorhandenen oder im Gym nicht durchführbaren Übungen.
  - **Umsetzung:** Das Backend übergibt dem Prompt die Liste aller in der Datenbank vorhandenen Übungs-IDs und Namen (`Exercise.id`, `Exercise.nameDe`). Per Structured Outputs (JSON Schema) wird das exakte Format für `PlanExercise` (`exerciseId`, `targetSets`, `targetReps`, `order`) erzwungen, über Zod validiert und per DB-Transaktion in die Datenbank geschrieben.
  - **Umgesetzt:** `response_format: { type: "json_object" }` (breiter unterstützt als striktes `json_schema` über alle vier Anbieter hinweg) plus eine Zod-Validierung der geparsten Antwort als eigentliche Durchsetzungsebene — genau wie gefordert. Zusätzliche Verteidigungslinie: jede `exerciseId` wird gegen die Menge der tatsächlich im Prompt angebotenen Katalog-IDs geprüft, auch eine syntaktisch gültige aber halluzinierte UUID wird verworfen. End-to-end mit einem lokalen Stub-Provider getestet: eine gemischte Antwort (1 echte + 1 erfundene ID) behält nur die echte; eine kaputte (Nicht-JSON) Antwort wird sauber abgelehnt, ohne die DB anzufassen.

- [x] **Warm-Start vs. Cold-Start Prompt-Pipeline**
  - **Warm-Start (Bestehende Nutzer):** Automatische Injektion des Profils (`Profile` mit Ziel, Gewicht, Größe, Alter) sowie der Trainingshistorie und Bestleistungen der letzten 8 Wochen (`WorkoutLog`) als Kontext.
  - **Cold-Start (Neue Nutzer):** Ein kompakter 4-Schritte-Modal fragt Trainingsfrequenz, verfügbares Equipment (Homegym/Kurzhanteln/Vollstudio), Erfahrungsgrad und körperliche Einschränkungen ab.
  - **Umgesetzt:** `hasEnoughHistory` (≥5 geloggte Sätze) entscheidet serverseitig, welcher Pfad gilt — ein erster `POST /ai/generate-plan` ohne `coldStart` liefert bei zu wenig Historie `{ status: "needs_cold_start" }` statt eines Fehlers, das Frontend öffnet daraufhin `ColdStartModal` (4 Schritte mit Fortschrittsanzeige) und ruft mit den Antworten erneut auf. End-to-end verifiziert: frischer Nutzer ohne Historie bekommt `needs_cold_start`, derselbe Aufruf mit explizitem `coldStart` generiert trotzdem.
  - **Nachbesserung (Praxis-Feedback):** Die Trainingsfrequenz aus Schritt 1 des Cold-Start-Modals wurde zwar abgefragt, aber nur als Kontext-Satz an den Prompt gehängt — das Modell erstellte trotzdem oft nur einen einzelnen Ganzkörper-Tag mit 6 Übungen statt eines Splits. `resolveSplitDays(frequencyPerWeek)` (`promptBuilder.ts`) übersetzt die Frequenz jetzt fest in eine Split-Struktur (1× Ganzkörper, 2× Ober-/Unterkörper, 3× Push/Pull/Legs, 4× Ober-/Unterkörper A+B, 5× Bro-Split, 6× Push/Pull/Legs A+B — Namen konsistent mit den kuratierten Splits in `RecommendedSplitsSection`), verlangt vom Modell explizit 6 Übungen **pro Tag** (nicht 6 insgesamt) mit einem `day`-Feld pro Eintrag, und schreibt das Ergebnis mit neuem `PlanExercise.dayLabel` weg. Warm-Start-Nutzer (nie nach der Frequenz gefragt) bekommen die Frequenz stattdessen aus der tatsächlichen Log-Kadenz der letzten 4 Wochen geschätzt (`estimateWeeklyFrequency`). End-to-end mit einem Stub-Provider verifiziert: 3×/Woche erzeugt exakt Push/Pull/Legs mit korrekter Tages-Reihenfolge, 1×/Woche bleibt ungruppiert (`dayLabel: null`), ein vom Modell erfundener Tagesname wird verworfen, dieselbe Übung darf auf zwei verschiedenen Tagen erscheinen (neuer Unique Index `userId_phase_exerciseId_dayLabel`), und die Frequenz-Schätzung aus simulierten Logs traf den erwarteten Split.
  - **Nachbesserung 2 (Tage-Ansicht & wöchentlicher Fortschritt):** Die generierten Tage waren zwar korrekt in der DB (`dayLabel`), aber `/plan` zeigte sie weiterhin als eine durchgehende Liste. `PlanExerciseList` hat jetzt ein Tage-Dropdown (bei einem Ein-Tages-Plan wie "Ganzkörper" entfällt es) — Auswahl zeigt genau die 6 Übungen dieses Tages, Auf/Ab-Pfeile wirken nur noch innerhalb des gewählten Tages. Zusätzlich neuer wöchentlicher Fortschritt fürs Dashboard: `GET /plan-exercises/week-status` (`planWeekStatus.service.ts`) erkennt aus den `WorkoutLog`-Einträgen der aktuellen Woche (Mo-So, UTC-Kalendertage wie beim Wasser-/Challenge-Reset), welche Split-Tage schon trainiert wurden, und liefert den nächsten noch offenen Tag als `activeDayIndex`. `CurrentPlanCard` auf der Startseite zeigt dadurch immer nur den aktuell dranstehenden Tag plus eine kleine Fortschrittsleiste (grün = erledigt, violett = aktuell, grau = offen), bei komplett abgeschlossener Woche eine Erfolgsmeldung statt einer Übungsliste. Der Montags-Reset braucht keinen eigenen Job — er ergibt sich von selbst, weil "diese Woche trainiert" bei jedem Aufruf frisch aus den Logs berechnet wird, nie gespeichert. End-to-end verifiziert: frischer 3-Tage-Split zeigt Tag 1 an, nach dem Loggen einer Tag-1-Übung springt das Dashboard sofort auf Tag 2 (auch live im Browser bestätigt), nach allen drei Tagen erscheint die Erfolgsmeldung, und das künstliche Verschieben aller Logs in die Vorwoche setzt korrekt auf Tag 1 zurück. Dabei einen echten Bug gefunden und gefixt: das Speichern eines Satzes invalidierte die Wochen-Status-Query nicht, weil `offline/workoutLogSync.ts` nichts von `plan-exercises`-Query-Keys wusste — Dashboard blieb nach dem Loggen auf dem alten Tag stehen, bis man die Seite neu lud. (Die "mindestens eine Übung genügt"-Regel für "Tag abgeschlossen" wurde in Nachbesserung 3 durch "alle Übungen des Tages" ersetzt, siehe dort.)
  - **Nachbesserung 3 (Plan als Tagebuch):** `CurrentPlanCard` zeigt den aktiven Split-Tag jetzt als ausfüllbare Tabelle (Übung, Sätze, Wdh., kg, Ende-Checkbox) statt nur als reine Anzeige — der Plan *ist* damit das Trainingstagebuch, kein separates Häkchen-System daneben. Jede Zeile startet mit "Sätze" auf 3 vorausgefüllt, Wdh. und kg leer; das Häkchen bei "Ende" schreibt für jeden eingegebenen Satz einen echten `WorkoutLog`-Eintrag (`clientId`, `exerciseId`, `setNumber`, `reps`, `weightKg`) und sperrt danach die Zeile (kein Entfernen des Häkchens — Korrekturen laufen über die bestehende Bearbeiten/Löschen-Funktion der Log-Tabelle darunter, wie bei jedem anderen geloggten Satz). Nach dem Abhaken springt der Fokus automatisch zum Sätze-Feld der nächsten Übung. Weil das jetzt ein präzises "diese Übung wurde erledigt"-Signal pro Übung liefert, wurde die Tag-Abschluss-Regel in `planWeekStatus.service.ts` von "mindestens eine Übung geloggt" auf "alle Übungen des Tages geloggt" verschärft (`.every()` statt `.some()`) — wer weiterhin frei über den klassischen Dialog loggt, muss dafür einfach jede Übung des Tages einmal abdecken, dieselbe Schwelle wie beim Tagebuch-Pfad. Ein neues Feld `loggedThisWeek` pro `PlanExercise` (serverseitig aus den Logs der aktuellen Woche berechnet, nicht persistiert) lässt eine bereits abgehakte Zeile nach einem Reload sofort gesperrt anzeigen, ohne dass das Frontend den Wochen-Grenzwert selbst nachbilden müsste. End-to-end im Browser verifiziert: Tabelle rendert korrekt bei 400px, kein horizontales Overflow bei 375px (`scrollWidth === clientWidth`), Ausfüllen + Abhaken von "Bench Press" (2 Sätze) erzeugt exakt zwei neue Zeilen in der Log-Tabelle darunter und lässt das Dashboard sofort — ohne Reload — von "Push" auf "Pull" springen (erster Fortschrittspunkt wird grün).

- [x] **8-Wochen-Phasen-Alignment im System-Prompt**
  - **Konzept:** Vorgabe der Trainingsparameter passend zur aktuell anstehenden Phase des 8-Wochen-Rotations-Schedulers (`TrainingPhase`):
    - `AUFBAU`: Hypertrophie (3–4 Sätze, 8–12 Wdh., RIR 1–2).
    - `MUSKELAUSDAUER`: Kraftausdauer & Laktattoleranz (3 Sätze, 15–25 Wdh., kurze Pausen).
    - `NEGATIV`: Exzentrische Überlastung & Kraft (4–5 Sätze, 4–6 Wdh., 3–4 Sek. Negativbewegung).
  - **Umgesetzt:** `PHASE_GUIDANCE` in `promptBuilder.ts`, wortwörtlich diese drei Vorgaben, direkt in den System-Prompt eingebettet.

## Phase 20: Workout-Komfort, Analyse & Tracking ✅

- [x] **Automatischer Satzpausen-Timer mit Haptik & Audio**
  - **Konzept:** Nach jedem gespeicherten Satz (`POST /workout-logs`) startet in der PWA automatisch ein konfigurierbarer Rest-Timer (z. B. 90 s / 180 s) mit Vibrationsfeedback (`navigator.vibrate`) und Audiosignal.
  - **Umgesetzt:** `timerStore` bekam `autoStartEnabled`/`autoStartSeconds` (per `zustand/persist` in `localStorage`, reine Geräte-Einstellung, keine Server-Daten), umschaltbar direkt im `RestTimerWidget`. `WorkoutLogFormDialog` startet den Timer nur bei einem neu gespeicherten Satz (nicht beim Bearbeiten). Vibration/Sound existierten schon aus dem manuellen Timer und werden unverändert wiederverwendet. End-to-end im Browser getestet: Satz speichern mit aktiviertem Auto-Start ließ den Timer sichtbar runterzählen.

- [x] **Ghost-Overlay für Fortschrittsfotos**
  - **Konzept:** Beim Öffnen der Kamera für ein neues `ProgressPhoto` wird das vorherige Foto halbtransparent über den Live-Kamerasucher gelegt, um Pose, Abstand und Bildausschnitt exakt abzugleichen.
  - **Umgesetzt:** Neue `ProgressPhotoCamera`-Komponente (`getUserMedia` + `<video>`-Live-Vorschau + das letzte Foto als `opacity`-geregeltes `<img>` darüber, mit Schieberegler), Aufnahme per Canvas-Snapshot statt nativer Kamera-UI (nur so ist der Overlay überhaupt möglich). Fällt bei verweigerter/fehlender Kamera automatisch auf den bestehenden Datei-Upload zurück. End-to-end mit Chromiums `--use-fake-device-for-media-stream` verifiziert: Live-Vorschau, sichtbarer Overlay bei vorhandenem Vorher-Foto, Aufnahme→Upload→Galerie, und der Fallback-Pfad ganz ohne Kamera-Flag (echte Verweigerung/kein Gerät) zeigt die erwartete Fallback-Meldung statt abzustürzen.

- [x] **RIR / RPE Tracking & 1RM-Rechner**
  - **Konzept:** Zusätzliches Erfassen der verbleibenden Wiederholungen (Reps in Reserve, RIR) pro Satz. Automatische Berechnung des geschätzten 1-Rep-Maximums (1RM nach Epley/Brzycki) und Vorgabe einer Aufwärmpyramide.
  - **Umgesetzt:** `WorkoutLog.rir` (nullable, Migration `20260826200000_add_workout_log_rir_and_superset`), RIR-Eingabefeld im Log-Formular. `estimateOneRepMax` mittelt Epley und Brzycki (rein clientseitig, keine neue Datenspeicherung), als Subtitle-Zeile unter dem Übungsnamen in der Tabelle statt einer eigenen Spalte (siehe unten). `buildWarmupPyramid` schlägt 40/60/80/90 % des eingegebenen Zielgewichts vor, aufklappbar im Formular.

- [x] **Supersatz- & Drop-Set-Grouping**
  - **Konzept:** Einführung eines `supersetGroupId`-Feldes in `WorkoutLog`, um zusammengehörige Übungen im Workout-Flow visuell zu bündeln und gemeinsame Satzpausen zu steuern.
  - **Umgesetzt:** `WorkoutLog.supersetGroupId` (client-generierte UUID, gleiches Muster wie `clientId`), im Formular als "Einzeln / Neue Gruppe / Zu letzter" wählbar. Tabelle bündelt optisch über einen deterministisch aus der Gruppen-ID abgeleiteten farbigen linken Rahmen. **Bewusst nicht umgesetzt:** eine automatische Unterdrückung des Auto-Timers innerhalb einer laufenden Superset-Runde — das Grouping ist rein visuell, gemeinsame Pausensteuerung bleibt die bestehende manuelle Pause-Taste, statt eine "wie viele Übungen hat diese Gruppe" -Heuristik zu erfinden, die die Roadmap nicht spezifiziert.
  - **Layout-Korrektur unterwegs gefunden:** zwei zusätzliche Tabellenspalten (RIR, ≈1RM) verursachten horizontalen Overflow bei 375px Breite (per Playwright verifiziert) — entgegen der in `ARCHITECTURE.md` dokumentierten "nie horizontal überlaufen"-Regel. Gelöst, indem beide Werte in die Subtitle-Zeile der bestehenden "Übung"-Spalte wandern statt eigene Spalten zu bekommen; danach kein Overflow mehr (`scrollWidth === clientWidth` bei 375px verifiziert).

## Phase 21: Optionales Cardio-Tracking & entzerrte Plan-Seite ✅

- [x] **Cardio-Tabelle auf dem Dashboard**
  - **Konzept:** Neben dem Kraft-Tagebuch soll optional auch Cardio (Laufband/Fahrrad/Stepper/Stairmaster) direkt auf dem Dashboard erfasst werden können — eine Tabelle mit Übung (Dropdown), Stufe, Intensität, Zeit; "Add row" fügt eine weitere Zeile für eine zweite Übung derselben Session hinzu.
  - **Umgesetzt:** Neues `CardioLog`-Modell (`machine`-Enum, `level` optional, `intensity` als String — die Einheit ist je Gerät unterschiedlich (km/h, Watt, Steigung-%), also kein einzelnes numerisches Feld, `durationMinutes`, Soft-Delete wie bei `WorkoutLog`), `GET/POST /cardio-logs` + `DELETE /cardio-logs/:id`, immer skopiert auf "heute" (UTC-Kalendertag, gleiche Konvention wie Wasser-/Tages-Challenge). Frontend: `CardioLogCard` unter `CurrentPlanCard` auf dem Dashboard — eine "Übung"-Dropdown-Spalte statt eigener Spalten pro Gerät (sonst wären pro Zeile drei Spalten immer leer), "Add row" hängt eine weitere leere Zeile an, ein Häkchen-Button pro Zeile speichert sie einzeln als eigenen `CardioLog`-Eintrag (kein Bezug zum Plan/Split — Cardio ist eine freie Ergänzung, keine geplante Übung). Bewusst **kein Offline-Sync** wie beim Kraft-Tagebuch (`WorkoutLog`) — normale React-Query-Mutations reichen für ein optionales Zusatzfeature ohne die Komplexität der IndexedDB-Sync-Queue zu rechtfertigen. End-to-end verifiziert: kein horizontaler Overflow bei 375px, Speichern erzeugt exakt eine neue, gesperrte Zeile, Validierungsfehler bei leerer Intensität/Zeit, Löschen entfernt den Eintrag wieder.

- [x] **`/plan` entlastet — Generieren & Exportieren auf eigene Seite**
  - **Konzept:** `/plan` war mit manueller Übungsliste, KI-Generator und Export/Import überladen — Generieren und Exportieren/Importieren sind seltene, bewusste Aktionen, kein täglicher Blick.
  - **Umgesetzt:** Neue Route `/plan/generate` (`PlanGenerateExportPage`) übernimmt `AiPlanGeneratorCard` und `PlanExportImportCard` samt der Phasen-Tabs (jetzt als gemeinsame `PhaseTabs`-Komponente, da beide Seiten denselben Tab-Umschalter brauchen). `/plan` behält Phasenübersicht, Push-Erinnerung, die editierbare Übungsliste (mit dem Tage-Dropdown aus Nachbesserung 2) und Verlauf; ein Link "Generieren & Exportieren" oben rechts führt zur neuen Seite, dort führt "Zum Plan" zurück. End-to-end verifiziert: `/plan` zeigt keinen KI-Provider-Auswahl mehr, `/plan/generate` zeigt KI-Generator und Export/Import korrekt an.

## Phase 22: Trainingsablauf — Start/Pause/Fortsetzen/Abbrechen/Abschließen (roadmap2.md P0.1) ✅

- [x] **Session-Buttons auf dem Dashboard, offline-fähig wie das Satz-Logging**
  - **Konzept:** Aus `docs/roadmap2.md`: "Trainingsablauf vollständig machen – Start, Sätze, Pause, Abbruch, Fortsetzen und Abschluss zuverlässig." Nach Absprache bewusst schlank gehalten — reicht als Buttons, keine Pflicht, Sätze nur innerhalb einer laufenden Session loggen zu können.
  - **Umgesetzt:** Neues `WorkoutSession`-Modell (`clientId` für Offline-Idempotenz wie bei `WorkoutLog`, `status`-Enum `ACTIVE`/`PAUSED`/`COMPLETED`/`ABORTED`, `startedAt`/`endedAt`) — bewusst **kein** `sessionId` auf `WorkoutLog`: das Loggen eines Satzes bleibt unabhängig davon, ob eine Session offen ist, die Session läuft parallel dazu, ist keine Voraussetzung fürs bestehende "+ Satz". `GET /workout-sessions/open` liefert die aktuell offene Session (höchstens eine gleichzeitig pro Nutzer), `POST /workout-sessions` startet (idempotent per `clientId`, gleiches Upsert-Muster wie `createWorkoutLog`), `PATCH /workout-sessions/:id` setzt den Status (setzt `endedAt`, sobald der Status `COMPLETED`/`ABORTED` wird). Frontend: `WorkoutSessionBar` oben auf dem Dashboard — "Training starten" ohne offene Session, sonst Status + "Pause"/"Fortsetzen"/"Abschließen"/"Abbrechen".
  - **Offline-Sync als eigenes, kleineres Pendant zu `workoutLogSync.ts`** statt Erweiterung der bestehenden Log-Sync-Queue um einen zweiten Mutationstyp — eigene Dexie-Tabellen (`workoutSessions`, `pendingSessionMutations`, neue Dexie-Version 2 in `offline/db.ts`), eigenes, aber deutlich kleineres `offline/workoutSessionSync.ts` (nur `create`/`update`, kein `delete` — eine Session wird nie gelöscht, nur beendet). Gleiche Grundmuster wie beim Satz-Logging: lokal-zuerst schreiben, dann synchron in die Mutation-Queue einreihen und sofort zu flushen versuchen; ein Offline-Start bekommt sofort eine lokale `id: null`-Zeile und ist voll bedienbar (Pause/Abbrechen/Abschließen funktionieren offline genauso), der Sync zum Server passiert beim nächsten `online`-Event. Gewählt statt einer gemeinsamen, kind-parametrisierten Queue, um die bereits funktionierende, getestete Log-Sync-Logik nicht anzufassen.
  - End-to-end verifiziert: Start→Pause→Reload (Server-Persistenz bestätigt)→Fortsetzen läuft wie erwartet; offline Abbrechen einer laufenden Session aktualisiert die UI sofort; offline eine neue Session starten funktioniert sofort; nach Reconnect+Reload ist die offline gestartete Session serverseitig vorhanden (Sync bestätigt); kein horizontaler Overflow bei 375px, auch mit allen drei Aktions-Buttons gleichzeitig sichtbar.

## Phase 23: Trainingsplan & Rotation — Pausen und Neustart (roadmap2.md P0.2) ✅

- [x] **Pausieren/Fortsetzen/Phase neu starten als Buttons auf `/plan`**
  - **Konzept:** Aus `docs/roadmap2.md`: "Trainingsplan & Rotation finalisieren – Phasenwechsel, 8-Wochen-Zyklus, Pausen und Neustart eindeutig." Phasenwechsel und der 8-Wochen-Zyklus existierten bereits (`rotatePhaseIfDue`/`rotateAllDuePlans`); gefehlt hat, den Rotations-Countdown pausieren zu können (z. B. Verletzung/Urlaub) und die aktuelle Phase explizit neu zu starten.
  - **Umgesetzt:** Neues `TrainingPlan.pausedAt`-Feld (nullable). `rotatePhaseIfDue` überspringt eine pausierte Plan komplett (liefert `nextRotationOn: null`), der Scheduler filtert pausierte Pläne bereits in der SQL-Query raus. `POST /training-plan/pause` setzt `pausedAt` (idempotent — ein zweites Pausieren verschiebt den Zeitpunkt nicht), `POST /training-plan/resume` verschiebt `phaseStartedOn` exakt um die pausierte Dauer nach vorne (`phaseStartedOn += (jetzt - pausedAt)`), damit die verbleibende Zeit bis zur Rotation erhalten bleibt statt durch die Pause stillschweigend aufgezehrt zu werden — 10 Tage pausiert und wieder fortgesetzt heißt exakt 10 Tage später wieder dran, per Skript verifiziert. `POST /training-plan/restart-phase` setzt `phaseStartedOn` auf den Montag der aktuellen Woche zurück (`mostRecentMonday`, gleiche Normalisierung wie beim initialen Plan-Anlegen), ohne `currentPhase` oder die Historie anzufassen — kein Phasenwechsel wurde ja tatsächlich abgeschlossen — und hebt eine laufende Pause automatisch mit auf.
  - **`nextRotationOn` ist jetzt `string | null`** im DTO (`null` während einer Pause) — `/plan` zeigt "pausiert seit …" statt eines nächsten Wechsel-Datums, sobald `pausedAt` gesetzt ist. Keine Bestätigungs-Dialoge für "Phase neu starten", obwohl es den Fortschritt der aktuellen Phase zurücksetzt — konsistent mit dem Rest der App, die nirgends `window.confirm` für destruktive Aktionen nutzt (z. B. "Löschen" in der Log-Tabelle, "Abbrechen" bei der Trainings-Session).
  - End-to-end verifiziert: Pausieren zeigt sofort "pausiert seit HH…" statt des Wechsel-Datums und übersteht einen Reload; Fortsetzen zeigt wieder ein nächstes Wechsel-Datum; Phase neu starten setzt "Seit" korrekt auf den aktuellen Montag zurück; ein Skript-Test mit künstlich zehn Tage zurückdatiertem `pausedAt` bestätigt die exakte 10-Tage-Verschiebung beim Fortsetzen; kein horizontaler Overflow bei 375px mit allen Buttons sichtbar.

## Phase 24: Progressionslogik — Steigerung, Fehlversuche, Deloads (roadmap2.md P0.3) ✅

- [x] **Gewichts-/Wiederholungs-Vorschlag im Plan-Tagebuch, phasenabhängig**
  - **Konzept:** Aus `docs/roadmap2.md`: "Progressionslogik festlegen – Klare Regeln für Steigerung, Fehlversuche und Deloads." Nach Absprache: nur Aufbau (Gewicht) sollte ursprünglich betroffen sein, Muskelausdauer/Negativ eher über Wiederholungen — beim genaueren Blick auf die bestehende Phasen-Definition (`promptBuilder.ts`s `PHASE_GUIDANCE`: Negativ = 4-6 Wdh., exzentrische Überlastung, nicht Ausdauer) stellte sich heraus, dass Negativ vom Wiederholungsbereich her eher zu Aufbau passt als zu Muskelausdauer (15-25 Wdh.) — auf Nachfrage entschieden: Aufbau **und** Negativ progressieren über Gewicht, nur Muskelausdauer über Wiederholungen.
  - **Umgesetzt:** `computeProgression` (`planWeekStatus.service.ts`) vergleicht die letzten zwei geloggten Sätze einer Übung (unabhängig von der Woche — Fortschritt braucht die volle Historie, nicht nur "diese Woche") gegen deren Ziel-Wiederholungen (`PlanExercise.targetReps`, sonst ein Phasen-Default: Aufbau 10, Muskelausdauer 20, Negativ 5 — Mittelwerte aus `PHASE_GUIDANCE`). Klare Regeln: Ziel erreicht → Steigerung (Gewichts-Modus: +2,5kg; Wdh.-Modus: +2 Wdh., gleiches Gewicht); Ziel verfehlt ("Fehlversuch") → gleiches Gewicht/gleiche Ziel-Wdh. nochmal; zweimal in Folge beim selben Gewicht verfehlt → Deload (-10 %, auf 2,5kg gerundet). Ergebnis (`ProgressionSuggestion`, neues Feld `progression` auf `PlanDiaryExerciseDto`) fließt direkt in die Plan-Tagebuch-Zeile (`CurrentPlanCard.tsx`): eine kurze Subtitle-Zeile unter dem Übungsnamen ("↑ 62.5kg", "= 40kg", "Deload → 35kg") und die Wdh./kg-Felder sind mit dem Vorschlag vorausgefüllt statt leer — wer einfach nur bestätigt, trainiert automatisch nach der Regel, ohne selbst rechnen zu müssen.
  - **Batch-Query pro Übung statt einer gedeckelten Gesamtabfrage** (`fetchRecentSetsByExercise`): für jede der (meist sechs) Übungen des aktiven Tages werden die letzten zwei Sätze einzeln per `take: 2` abgefragt (parallel via `Promise.all`), statt eine einzige `take`-begrenzte Abfrage über alle Übungen zu teilen — bei ungleich verteiltem Logging (eine Übung viel öfter trainiert als eine andere) liefert Letzteres sonst für die selten trainierte Übung keine oder falsche Historie.
  - **Kein Vorschlag ohne jede Historie** (`progression: null`) — eine frisch zum Plan hinzugefügte Übung zeigt leere Felder wie bisher, kein erfundener Startwert.
  - End-to-end verifiziert (per Skript direkt gegen `getWeeklyPlanStatus` sowie live im Browser): zwei Fehlversuche beim selben Gewicht lösen korrekt einen Deload aus (z. B. 40kg → 35kg), ein erreichtes Ziel schlägt korrekt eine Gewichtssteigerung vor (20kg → 22,5kg), Muskelausdauer schlägt bei erreichtem Ziel eine Wiederholungssteigerung statt einer Gewichtssteigerung vor: die Werte erscheinen korrekt vorausgefüllt in den Tagebuch-Feldern. Dabei eine echte UI-Lücke gefunden und gefixt: das kg-Feld (`w-11`) schnitt vorausgefüllte Nachkommawerte wie "62.5" visuell auf "62" ab (der tatsächliche Wert war korrekt, nur nicht vollständig sichtbar) — behoben durch Verbreiterung auf `w-14`, weiterhin kein horizontaler Overflow bei 375px.

## Phase 25: Offline-Sync fachlich fertiggestellt (roadmap2.md P0.4) ✅

- [x] **Drei konkrete Lücken im bestehenden Offline-Sync (aus Phase 4/22) geschlossen**
  - **Konzept:** Aus `docs/roadmap2.md`: "Offline-Sync fachlich fertigstellen – Offline-Trainings zuverlässig und vollständig synchronisieren." Die Grundmechanik (lokal-zuerst schreiben, Mutation-Queue, Sync bei Reconnect) existierte bereits für Sätze (Phase 4) und Trainings-Sessions (Phase 22) — beim Review fielen drei konkrete Lücken auf, die "zuverlässig und vollständig" noch nicht ganz erfüllten.
  - **Lücke 1 — die Trainings-Session-Queue war für das "X ausstehend"-Badge unsichtbar:** `workoutSessionSync.ts` schrieb offline gestartete/pausierte/beendete Sessions zwar zuverlässig in ihre eigene Pending-Queue, meldete das aber nie an `useSyncStore` — das Badge in `AppShell` kannte nur die Satz-Queue. Neues `offline/syncCounts.ts` mit einer `refreshSyncCounts()`-Funktion als gemeinsame Quelle der Wahrheit (summiert `pendingMutations` + `pendingSessionMutations`), von beiden Sync-Modulen nach jeder Queue-Änderung aufgerufen statt jedes Modul führt seine eigene Hälfte des Sync-Stores.
  - **Lücke 2 — kein periodischer Retry, nur bei `online`-Events.** Ein `online`-Event feuert ausschließlich bei einem echten Offline→Online-Übergang. Schlug eine Synchronisierung aus einem anderen Grund fehl (Backend kurz nicht erreichbar, ein einzelner fehlgeschlagener Request), während der Browser durchgehend "online" blieb, blieb die Queue bis zur nächsten lokalen Mutation oder einem App-Reload hängen — nicht "zuverlässig". Beide Sync-Module bekamen einen zusätzlichen `setInterval`, der alle 60 Sekunden bei `navigator.onLine` einen Flush-Versuch auslöst (harmlos, wenn die Queue bereits leer ist).
  - **Lücke 3 — vom Server endgültig abgelehnte Mutationen verschwanden spurlos.** Ein `ApiError` (z. B. Validierung, `404` nach anderweitigem Löschen) führte bisher zu `console.error` + stillem Löschen aus der Pending-Queue — aus Nutzersicht verschwand ein geloggter Satz oder eine Session-Änderung einfach, ohne jede Spur. Neue `failedMutations`-Tabelle (Dexie-Version 3) speichert Art, Operation und Fehlergrund; ein neues rotes "X fehlgeschlagen"-Badge in `AppShell` (analog zum bestehenden "X ausstehend") macht den Datenverlust sichtbar statt ihn zu verstecken.
  - End-to-end verifiziert: ein offline geloggter Satz im Plan-Tagebuch zeigt sofort das "ausstehend"-Badge, das nach Reconnect + erfolgreichem Sync wieder verschwindet (per IndexedDB-Zähler bestätigt: `pendingMutations` 0 nach Sync); eine gezielt injizierte, dauerhaft fehlschlagende Mutation wandert nach einem Flush korrekt von `pendingMutations` in `failedMutations` (Zähler 0 → 1 bestätigt) und das "fehlgeschlagen"-Badge erscheint.

## Phase 26: Datenkonflikte definiert (roadmap2.md P0.5, letzter P0-Punkt) ✅

- [x] **Konfliktpolitik: jüngste Aktion gewinnt, mit zwei konkret gefixten Lücken**
  - **Konzept:** Aus `docs/roadmap2.md`: "Datenkonflikte definieren – Verhalten bei parallelen/Offline-Änderungen festlegen." Reine Politik-Definition, keine Neuarchitektur — die meisten Fälle waren durch die bestehende Idempotenz- und Soft-Delete-Mechanik implizit bereits sinnvoll gelöst, mussten nur explizit gemacht (und an zwei Stellen korrigiert) werden.
  - **`WorkoutLog`: jüngste Aktion gewinnt, Löschen schlägt ein verspätetes Update.** Ein `update` auf eine Zeile, die anderswo bereits gelöscht wurde (`deletedAt` gesetzt), findet die Zeile über `findOwnedWorkoutLog` nicht mehr (dort wird explizit `deletedAt: null` gefiltert) und schlägt mit `404` fehl — dank Phase 25 landet dieser fehlgeschlagene Sync-Versuch jetzt sichtbar im "fehlgeschlagen"-Badge statt spurlos zu verschwinden. Zwei parallele Updates auf dieselbe Zeile: das zeitlich letzte, das den Server erreicht, gewinnt (kein Versionsfeld, keine Merge-Logik) — für eine Ein-Personen-App mit gelegentlichem Multi-Geräte-Einsatz ausreichend, ein waschechtes CRDT/Merge-System wäre für diesen Anwendungsfall Überengineering.
  - **`WorkoutSession`: echte Lücke gefunden und gefixt — zwei Geräte konnten gleichzeitig eine offene Session erzeugen.** Startet Gerät A offline eine Session und Gerät B (unwissend von A) ebenfalls, landen beide `create`-Mutationen mit unterschiedlichen `clientId`s in der Queue und syncen beide erfolgreich — ohne Gegenmaßnahme das Ergebnis: zwei gleichzeitig "offene" (ACTIVE/PAUSED) Sessions, was die "höchstens eine offene Session"-Annahme des restlichen Systems (Dashboard-UI, `getOpenWorkoutSession`) stillschweigend verletzt. `createWorkoutSession` schließt jetzt in einer Transaktion jede andere noch offene Session desselben Nutzers automatisch ab (`status: ABORTED`), bevor die neue angelegt wird — dieselbe "jüngste Aktion gewinnt"-Politik wie bei `WorkoutLog`.
  - **`WorkoutSession`: zweite Lücke — eine verspätete Status-Änderung konnte eine bereits abgeschlossene Session wiederbeleben.** Schließt Gerät A eine Session ab (`COMPLETED`), während Gerät B offline noch eine Pause dafür in der Queue hatte, hätte diese verspätete `PAUSED`-Mutation die längst beendete Session zurück auf "offen" gesetzt. `updateWorkoutSessionStatus` behandelt einen bereits terminalen Zustand (`COMPLETED`/`ABORTED`) jetzt als endgültig: eine nachträgliche Status-Änderung wird als folgenloses No-op behandelt (nicht als Fehler — die Session ist einfach schon entschieden, kein Grund für ein "fehlgeschlagen"-Badge).
  - End-to-end per Skript verifiziert: Session A wird automatisch auf `ABORTED` gesetzt, sobald Session B erzeugt wird, `getOpenWorkoutSession` liefert danach korrekt nur B zurück; eine `PAUSED`-Anfrage gegen eine bereits `COMPLETED`-Session bleibt unverändert `COMPLETED`.

## Phase 27: Dashboard finalisiert — Fortschritt & Ziele (roadmap2.md P1.1) ✅

- [x] **Log-Tabelle auf "heute" begrenzt, kompakte Ziele-Karte ergänzt**
  - **Konzept:** Aus `docs/roadmap2.md`: "Dashboard finalisieren – Heutiges Training, Fortschritt und Ziele übersichtlich." Zwei konkrete Lücken identifiziert: die Log-Tabelle unten auf dem Dashboard zeigte unbegrenzt die komplette Trainings-Historie (kein Datumsfilter), und Ziele tauchten auf dem Dashboard überhaupt nicht auf — nur auf der separaten `/goals`-Seite sichtbar.
  - **Umgesetzt:** `WorkoutLogPage` filtert `logs` jetzt clientseitig auf den aktuellen UTC-Kalendertag (gleiche Konvention wie Wasser/Tages-Challenge/Cardio), bevor sie an `WorkoutLogTable` gehen — Filterung auf Darstellungsebene, nicht in `fetchAndCacheWorkoutLogs`/der Offline-Sync-Schicht, damit die zukünftige "Workout-Historie"-Ansicht (separater P1-Punkt) weiterhin auf demselben, unveränderten Cache aufbauen kann. Neue Überschrift "Heute" über der Tabelle, angepasster Leertext ("Heute noch keine Sätze protokolliert."). Neue `GoalsProgressCard`: zeigt bis zu vier offene (nicht erreichte) Ziele mit schlankem Fortschrittsbalken (`currentValue`/`targetValue`, wiederverwendet dieselbe Berechnung wie `GoalCard` auf `/goals`), "+N weitere Ziele"-Link bei mehr, rendert `null` ohne offene Ziele — gleiches "leer heißt unsichtbar"-Muster wie `DailyChallengeCard`/`CurrentPlanCard`.
  - End-to-end verifiziert: Dashboard zeigt korrekt nur die Ziele-Karte mit beiden seed-Zielen (inkl. aus der Log-Historie abgeleitetem `currentValue` für ein Übungs-Ziel), die "Heute"-Tabelle zeigt nur die heute geloggten Sätze, ältere Sätze aus früheren Tagen verschwinden korrekt aus der Dashboard-Ansicht; kein horizontaler Overflow bei 375px.
  - **Nachbesserung (Praxis-Feedback):** Der automatisch erkannte aktive Tag im Plan-Tagebuch (`CurrentPlanCard`) war bisher fest — sollte man aus irgendeinem Grund mit Tag 2 statt Tag 1 anfangen wollen (z. B. Tag 1 schon anderweitig erledigt, oder einfach Lust auf eine andere Übung), gab es keine Möglichkeit, das zu übersteuern; die Fortschritts-Punkte waren reine Anzeige. Jetzt klickbar: ein Tap auf einen Punkt zeigt dessen Tag im Tagebuch, unabhängig vom automatisch erkannten aktiven Tag — funktioniert auch dann, wenn bereits alle Tage dieser Woche abgeschlossen sind (statt nur der Erfolgsmeldung bleiben die Punkte klickbar und lassen jeden Tag erneut aufrufen). Die manuelle Auswahl bleibt bestehen, auch wenn sich der automatisch erkannte Tag durch neues Loggen ändert — kein Zurückspringen mitten beim Ausfüllen. Nebenbei die Navigation "Log" in "Dashboard" umbenannt, da das der etabliert genutzte Name für diese Seite ist.
  - **Nachbesserung 2 (Discoverability):** Die klickbaren Punkte aus der ersten Nachbesserung waren als reine 6px hohe Balken kaum als Umschalter erkennbar — funktional korrekt, aber niemand fand sie, um gezielt auf Tag 2 oder 3 zu wechseln. Ersetzt durch eine beschriftete Tab-Leiste ("Tag 1"/"Tag 2"/"Tag 3", gleiches Muster wie `PhaseTabs` auf `/plan`), ausgewählter Tag violett hervorgehoben, abgeschlossene Tage mit ✓-Häkchen markiert. Gleiche zugrundeliegende `selectedDayIndex`-Logik wie zuvor, nur die Darstellung wurde geändert. End-to-end verifiziert (Playwright, 3-Tage-Split Push/Pull/Beine): alle drei Tabs anklickbar, Header und Tabelleninhalt wechseln korrekt zwischen Push/Pull/Beine, abgeschlossene Tage zeigen ✓, kein horizontaler Overflow bei 375px.

## Phase 28: Fortschrittsansicht abgerundet (roadmap2.md P1.2) ✅

- [x] **Neue Seite `/progress`: Gewicht, Körperdaten, Kraft, Volumen, PRs, Zeiträume**
  - **Konzept:** Aus `docs/roadmap2.md`: "Fortschrittsansicht abrunden – Gewicht, Körperdaten, Kraft, Volumen, PRs und Zeiträume." Körperkomposition und Trainingsdaten existierten bereits (`BodyCompositionEntry`, `WorkoutLog`), aber verstreut über `/nutrition` (nur eine Karte, keine Zeitreihe) und die tägliche Log-Tabelle — nirgends eine zusammenfassende, zeitraum-gefilterte Fortschrittsansicht.
  - **Umgesetzt:** Reine Frontend-Auswertung, kein neuer Backend-Code — sowohl `useBodyCompositionEntries()` als auch `useWorkoutLogs()` liefern bereits die komplette (Body-Composition: bis zu 60 Einträge; Workout-Logs: über den bestehenden Offline-Cache) Historie, gefiltert wird clientseitig nach dem gewählten Zeitraum. Neue `RangeTabs`-Komponente (visuell identisch zu `PhaseTabs`) mit vier Optionen (4 Wochen/3 Monate/1 Jahr/Gesamt), treibt alle drei Karten auf der Seite einheitlich. Drei Karten: `WeightProgressCard` (Sparkline-Verlauf, Delta seit Zeitraum-Beginn, neuester Körperfett-Wert), `StrengthProgressCard` (pro Übung der Satz mit dem höchsten geschätzten 1RM im Zeitraum — wiederverwendet `estimateOneRepMax` aus Phase 20 —, sortiert nach zuletzt trainiert statt nach absolutem Rekord, damit die Liste "woran arbeitest du gerade" statt einer starren All-Time-Bestenliste zeigt), `VolumeProgressCard` (Σ Gewicht × Wiederholungen im Zeitraum plus Trend gegenüber der direkt vorangegangenen, gleich langen Periode — bei "Gesamt" bewusst ohne Trend, da es keine sinnvolle Vorperiode gibt).
  - **Kein neuer Chart-Dependency:** `Sparkline.tsx` ist eine selbstgebaute SVG-Polyline (skaliert per `viewBox`, keine Achsen/Legende) statt Recharts/D3 — für eine einzelne Trendlinie in einer Ein-Personen-App unnötiges Gewicht.
  - **Neutrale Trend-Pfeile statt Gut/Schlecht-Farbcodierung beim Gewicht** — bewusst kein Grün-für-Abnahme/Rot-für-Zunahme wie man es naiv erwarten könnte: eine Gewichtszunahme ist für manche Nutzer exakt das Ziel, die Richtung allein lässt sich nicht bewerten. Gleiche neutrale ↑/↓/→-Konvention wie `BodyCompositionCard`s bestehender `trendArrow`.
  - End-to-end verifiziert: Sparkline zeigt den korrekten Trend über simulierte ~200 Tage Körperkomposition-Historie, Kraft-Karte listet die vier trainierten Übungen mit korrektem Gewicht/Wdh./≈1RM, Volumen-Karte zeigt plausible Summen samt Vorperioden-Trend; Umschalten zwischen "3 Monate" und "Gesamt" ändert alle drei Karten korrekt (weniger Datenpunkte/kleinere Werte bei kürzerem Zeitraum, "Gesamt" zeigt keinen Vorperioden-Trend mehr); kein horizontaler Overflow bei 375px; "Fortschritt" korrekt im Hamburger-Menü erreichbar.

## Phase 29: Progress-Fotos komplettiert — Datum ergänzt (roadmap2.md P1.3) ✅

- [x] **Fehlende Datums-Eingabe beim Foto-Upload ergänzt**
  - **Konzept:** Aus `docs/roadmap2.md`: "Progress-Fotos komplettieren – Aufnahme, Upload, Datum, Galerie und Vorher/Nachher." Bei genauerer Prüfung waren vier der fünf Teile bereits vollständig aus Phase 12/20 (Kamera mit Ghost-Overlay, Datei-Upload, Galerie-Grid mit Datum pro Foto, freie Vorher/Nachher-Auswahl per Dropdown) — die eine echte Lücke: das Backend akzeptierte bereits ein eigenes `takenAt`-Feld beim Upload (`progressPhoto.routes.ts` liest es optional aus den Multipart-Feldern, `saveUploadedPhoto` reicht es durch), aber `ProgressPhotosCard.tsx` zeigte nie ein Datumsfeld und rief `upload.mutateAsync` immer ohne `takenAt` auf — ein bereits fertig verdrahtetes Feature, das nirgends in der UI ankam.
  - **Umgesetzt:** Ein `<input type="date">` (Default: heute, `max` auf heute gedeckelt — kein Foto "aus der Zukunft") über den Upload-Aktionen, dessen Wert sowohl beim Kamera- als auch beim Datei-Upload als `takenAt` mitgeschickt wird — nützlich vor allem, um ältere Fotos (z. B. beim Import einer bestehenden Kamerarolle) mit ihrem echten Aufnahmedatum statt dem Upload-Zeitpunkt einzutragen. Setzt sich nach jedem erfolgreichen Upload automatisch auf "heute" zurück, damit ein zurückdatierter Wert nicht versehentlich beim nächsten, eigentlich aktuellen Foto hängen bleibt.
  - **Bewusst keine Möglichkeit, das Datum eines bereits hochgeladenen Fotos nachträglich zu ändern** — es gibt keine `PATCH /progress-photos/:id`-Route, und für den seltenen Korrekturfall (falsches Datum erwischt) ist Löschen + erneutes Hochladen mit dem richtigen Datum einfacher als ein komplett neuer Bearbeiten-Mechanismus nur für dieses eine Feld.
  - End-to-end verifiziert: ein mit zurückdatiertem Datum (15.01.2026) hochgeladenes Foto erscheint korrekt mit diesem Datum in der Galerie, das Datumsfeld springt nach dem Upload zurück auf das heutige Datum, kein horizontaler Overflow bei 375px.

## Phase 30: Push-Einstellungen fertiggestellt — individuell konfigurierbar (roadmap2.md P1.4) ✅

- [x] **Drei einzeln umschaltbare Reminder-Typen statt einem Alles-oder-nichts-Schalter**
  - **Konzept:** Aus `docs/roadmap2.md`: "Push-Einstellungen fertigstellen – Erinnerungen individuell aktivierbar und konfigurierbar." Der bestehende `PushReminderCard` bot nur einen einzigen Subscribe/Unsubscribe-Schalter, betitelt "Erinnerung bei Phasenwechsel" — tatsächlich sendet dieselbe Browser-Push-Subscription aber auch die Supplement- und die wöchentliche Fortschrittsfoto-Erinnerung, ohne dass die Karte das je erwähnte oder eine Möglichkeit bot, nur eine der drei Arten abzuschalten. Eine echte Lücke, kein reines UI-Problem: `sendNotificationToUser` sendet bedingungslos an jede Subscription des Nutzers, unabhängig davon, welcher der drei Scheduler sie ausgelöst hat.
  - **Umgesetzt:** Drei neue `User`-Felder (`remindPhaseChange`/`remindSupplements`/`remindProgressPhoto`, alle `@default(true)` — bestehende Abonnenten behalten ihr bisheriges "alles an"-Verhalten, bis sie aktiv etwas abwählen). `GET`/`PATCH /push/settings` zum Lesen/Ändern. Alle drei Scheduler (`trainingPlan.service.ts`s `rotateAllDuePlans`, `supplement.service.ts`s `checkAndSendReminders`, `progressPhoto.service.ts`s `sendDueReminders`) prüfen jetzt vor dem `sendNotificationToUser`-Aufruf das jeweilige Flag — die eigentliche fachliche Aktion (Phasenwechsel, Supplement-Tracking, Foto-Erinnerungs-Fälligkeit) läuft immer unverändert weiter, nur der Push wird unterdrückt. `PushReminderCard` (Name unverändert gelassen, Inhalt umgebaut — gleiches Muster wie `CurrentPlanCard`, das von einer reinen Anzeige zum Tagebuch wurde, ohne umbenannt zu werden) zeigt jetzt drei Checkboxen unter dem Haupt-Schalter, nur sichtbar, sobald tatsächlich abonniert (eine Präferenz für eine Benachrichtigungsart zu zeigen, die noch gar nicht zugestellt werden kann, wäre nur Rauschen).
  - **Supplement-Erinnerung: `lastRemindedOn` rückt auch bei unterdrückter Benachrichtigung vor** — "heute schon geprüft" ist unabhängig davon, ob der Push tatsächlich zugestellt wurde; würde das Feld bei Unterdrückung nicht vorrücken, würde derselbe Supplement-Eintrag bei jedem weiteren Scheduler-Tick des Tages erneut (wirkungslos) geprüft.
  - **Kein Live-Browser-Test der eigentlichen Checkbox-UI** — `usePushSubscription` wartet auf `navigator.serviceWorker.ready`, aber der Vite-Dev-Server liefert in keinem Modus eine Service-Worker-Datei aus (`registerSW.js`/`sw.js` existieren nur im Produktions-Build), wodurch die Karte im Dev-Modus dauerhaft bei `status: "loading"` hängen bleibt und `null` rendert — eine bereits vor dieser Änderung bestehende Einschränkung der Dev-Umgebung, nicht durch diese Änderung verursacht. Stattdessen verifiziert: `GET`/`PATCH /push/settings` per `curl` (Speichern und Persistenz bestätigt), sowie alle drei Scheduler-Gates per Skript direkt gegen die Service-Funktionen (Supplement- und Foto-Erinnerung mit deaktiviertem bzw. aktiviertem Flag, `sent`-Zähler entsprechend 0 bzw. ≥1; Trainingsplan-Rotation strukturell identisch gebaut und typgeprüft, aber ohne beobachtbaren Seiteneffekt testbar, da im Testkonto keine echte Subscription hinterlegt ist).

## Phase 31: Workout-Historie vervollständigt (roadmap2.md P1.5) ✅

- [x] **Neue Seite `/history`: vergangene Trainings nach Tag durchsuchbar, editierbar**
  - **Konzept:** Aus `docs/roadmap2.md`: "Workout-Historie vervollständigen – Vergangene Trainings ansehen und bearbeiten." Das Dashboard (`WorkoutLogPage`, seit Phase 27) zeigt bewusst nur den heutigen Tag; eine separate Ansicht für die Vergangenheit war explizit als offener Folgepunkt vermerkt, existierte aber nirgends — weder Route noch Nav-Eintrag. Backend unterstützte bereits `GET /workout-logs?from=&to=&exerciseId=`, wurde vom Frontend aber nie genutzt.
  - **Umgesetzt:** Neue `WorkoutHistoryPage` unter `/history`, im Hamburger-Menü zwischen "Dashboard" und "Übungen" verlinkt. Nutzt denselben `useWorkoutLogs()`-Hook wie das Dashboard — der Offline-Cache (`fetchAndCacheWorkoutLogs`) hält ohnehin schon die komplette Historie lokal vor (für Offline-Nutzung unverzichtbar), sodass kein neuer Netzwerk-Call nötig war; stattdessen client-seitig nach UTC-Kalendertag gruppiert (`groupByDay`, absteigend sortiert) und mit "Heute"/"Gestern"/vollem Datum beschriftet. Übungs-Filter per Dropdown (`useExercises()`). Bearbeiten/Löschen pro Satz über exakt dieselbe `WorkoutLogTable`/`WorkoutLogFormDialog`-Kombination wie auf dem Dashboard — funktioniert dadurch identisch, unabhängig vom Tag.
  - **Fenstern statt echter Pagination (erste Fassung, seither ersetzt — siehe Nachbesserung unten):** Die aus `docs/roadmap2.md` als Scaling-Sorge identifizierte unbegrenzte Fetch-Historie ist eine bewusste, vorbestehende Architekturentscheidung des Offline-First-Ansatzes (die lokale Dexie-Kopie muss vollständig sein, damit Offline-Bearbeitung überhaupt funktioniert) und wurde nicht angetastet. Die erste Fassung rendere anfangs nur die letzten 14 Tages-Gruppen mit "Weitere Tage laden"-Button für den Rest.
  - End-to-end verifiziert (Playwright, `test@example.com`): Hamburger-Menü zeigt "Historie", Navigation dorthin funktioniert; ein neu geloggter Satz erscheint sofort unter "Heute", Bearbeiten (Gewicht geändert) und Löschen funktionieren direkt von der Historie-Seite aus identisch zum Dashboard; mit bereits vorhandenen Testdaten (Mai–August 2026) zeigt die Seite korrekt nach Tag gruppierte Einträge samt "Weitere Tage laden"; Übungsfilter-Dropdown zeigt "Alle Übungen" plus alle Übungen; kein horizontaler Overflow bei 375px.
  - **Nachbesserung (Praxis-Feedback): Kalender statt scrollender Tagesliste, Übungen pro Tag als aufklappbare Gruppen.** Die anfängliche "Weitere Tage laden"-Liste zeigte trotzdem sofort alle Sätze jedes geladenen Tages auf einmal — bei mehreren Übungen pro Tag lief die Seite genau in die Flut, die vermieden werden sollte. Ersetzt durch einen Monats-Kalender (`HistoryCalendar`, Montag-first-Grid, Vor/Zurück-Navigation, "weiter" gesperrt ab dem aktuellen Monat): Tage mit protokollierten Sätzen sind hervorgehoben und anklickbar, alle anderen deaktiviert. Ein Klick auf einen Tag zeigt darunter dessen Übungen als eigene, standardmäßig eingeklappte `ExerciseLogGroup`-Kacheln (Kopfzeile: Übungsname + Satzanzahl) — erst beim Aufklappen erscheint die Satz-Tabelle mit Uhrzeit (da die Gruppierung nach Übung die vorherige rein chronologische Reihenfolge aufhebt, macht ein Zeitstempel pro Satz den Ablauf innerhalb der Übung trotzdem nachvollziehbar), Wdh., kg und Bearbeiten/Löschen. Damit rendert immer nur maximal ein Kalendermonat plus die Kacheln eines einzelnen Tages — unabhängig davon, wie viele Monate an Historie insgesamt vorliegen; die alte "Weitere Tage laden"-Pagination entfällt vollständig, da der Kalender das Browsing-Problem strukturell löst statt nur zu verzögern. Der Übungsfilter bleibt erhalten und schränkt jetzt zusätzlich ein, welche Kalendertage als "hat Einträge" markiert sind.
  - End-to-end nachverifiziert (Playwright): Kalender zeigt korrekt hervorgehobene Trainingstage; eingeklappte Übungsgruppen zeigen keine Uhrzeit-Spalte (kein Flooding); Aufklappen zeigt Uhrzeit/Satz/Wdh./kg-Tabelle mit Bearbeiten/Löschen; Monatsnavigation (Zurück-Pfeil) wechselt Label und Kalenderinhalt korrekt; Klick auf einen hervorgehobenen Tag zeigt dessen Übungsgruppen; Übungsfilter schränkt die hervorgehobenen Kalendertage sichtbar ein; kein horizontaler Overflow bei 375px.

## Phase 32: Übungsverwaltung finalisiert (roadmap2.md P1.6) ✅

- [x] **Anlegen/Bearbeiten/Deaktivieren im Frontend verdrahtet, `isActive`-Feld ergänzt**
  - **Konzept:** Aus `docs/roadmap2.md`: "Übungsverwaltung finalisieren – Übungen anlegen, bearbeiten, deaktivieren und korrekt verwenden." Backend hatte bereits vollständiges CRUD (`POST`/`PATCH`/`DELETE /exercises`), aber das Frontend rief nie etwas außer `GET` auf — keine "+ Übung"-UI, `ExerciseDetailPage` rein lesend. Für "deaktivieren" gab es weder Datenbankfeld noch Endpunkt: `DELETE` war ein Hard-Delete, vom Datenbank-FK (`RESTRICT`) ohnehin blockiert, sobald eine Übung in einem WorkoutLog/PlanExercise/Goal referenziert wird — es gab also gar keinen Weg, eine bereits benutzte Übung aus zukünftiger Verwendung zurückzuziehen.
  - **Umgesetzt:** Neues `Exercise.isActive Boolean @default(true)`-Feld (Migration `20260829014235_add_exercise_is_active`). `listExercises` filtert standardmäßig auf `isActive: true`, es sei denn `includeInactive=true` wird explizit übergeben — da jeder bestehende Übungs-Picker (Workout-Log-Dialog, Plan-Übungs-Dialog, Ziel-Dialog) `GET /exercises` ohne Parameter aufruft, verschwindet eine deaktivierte Übung dadurch automatisch aus jeder "korrekten Verwendung", ohne dass einer dieser drei Call-Sites etwas von `isActive` wissen muss. Neue `ExerciseFormDialog`-Komponente (gleiches Bottom-Sheet-Muster wie `WorkoutLogFormDialog`) für Anlegen und Bearbeiten, wiederverwendet auf `/exercises` ("+ Übung"-Button) und `/exercises/:id` ("Bearbeiten"-Link). Detailseite bekommt zusätzlich Deaktivieren/Aktivieren- und Löschen-Buttons; die Bibliotheksseite eine "Auch inaktive Übungen anzeigen"-Checkbox samt "Inaktiv"-Badge auf Karte und Detailseite.
  - **Hard-Delete bleibt bestehen, aber nur noch für wirklich unbenutzte Übungen** — die Fehlermeldung bei `P2003` (FK-Konflikt) verweist jetzt explizit auf "deaktivieren statt löschen", damit der Konflikt nicht als undurchsichtiger 409 endet, sondern den eigentlich richtigen nächsten Schritt nennt.
  - End-to-end verifiziert (Playwright): vollständiger Zyklus Anlegen → auf Bibliotheksseite sichtbar → Öffnen der Detailseite → Bearbeiten (Name geändert, Änderung erscheint sofort) → Deaktivieren (Detailseite zeigt "Inaktiv"-Badge, Button wechselt zu "Aktivieren") → aus der Bibliothek standardmäßig verschwunden, aber über die "Auch inaktive"-Checkbox wieder sichtbar → aus dem Übungs-Picker im Trainings-Log-Dialog korrekt ausgeschlossen → Reaktivieren (Badge verschwindet) → Löschen (zurück auf `/exercises`, Katalog wieder im Ausgangszustand). Kein horizontaler Overflow bei 375px.

## Phase 33: Ziele vollständig gemacht (roadmap2.md P1.7, letzter roadmap2.md-P1-Punkt) ✅

- [x] **Automatischer Abschluss für WEIGHT/REPS-Ziele + Bearbeiten-Dialog für Zielwert/-datum**
  - **Konzept:** Aus `docs/roadmap2.md`: "Ziele vollständig machen – Ziele erstellen, Fortschritt und Abschluss sauber behandeln." Anlegen, Fortschrittsanzeige und die Trennung offen/erreicht existierten bereits vollständig; zwei echte Lücken blieben: `achievedAt` wechselte nie automatisch, selbst wenn `currentValue` den Zielwert längst über-/erreicht hatte (nur der manuelle "Als erreicht markieren"-Button), und es gab keine Möglichkeit, Zielwert oder Zieldatum eines bestehenden Ziels zu ändern (Backend unterstützte `PATCH /goals/:id` bereits vollständig dafür, das Frontend rief es nur für den Erreicht-Toggle auf).
  - **Umgesetzt:** Neues `autoAchieveIfDue` in `goal.service.ts`, aufgerufen nach jedem `computeCurrentValue` in allen drei Routen (`GET`/`POST`/`PATCH /goals`) — sobald der abgeleitete Wert den Zielwert erstmals erreicht, wird `achievedAt` serverseitig gesetzt, ohne dass ein Nutzer aktiv etwas tun muss. Bewusst einseitig: einmal gesetzt, wird es durch einen späteren Rückgang nie wieder zurückgenommen. `GoalFormDialog` bearbeitet jetzt auch bestehende Ziele (Art und Übung bleiben unveränderlich und werden im Bearbeiten-Modus nur als Text angezeigt, exakt wie es `updateGoalSchema` serverseitig ohnehin vorschreibt) — neuer "Bearbeiten"-Button auf `GoalCard`, Dialogzustand nach oben in `GoalsPage` gezogen.
  - **Auto-Abschluss bewusst auf WEIGHT/REPS beschränkt — beim Testen einen echten Bug in der ersten Fassung gefunden und korrigiert:** Die erste Implementierung prüfte `currentValue >= targetValue` für alle Zieltypen. Für BODYWEIGHT ist das falsch: ein Zielgewicht von 75kg kann "abnehmen bis 75" oder "zunehmen bis 75" bedeuten, und aus den Daten allein lässt sich die Richtung nicht ableiten — beim End-to-End-Test flippte dadurch ein Abnehm-Ziel (Zielwert 75, aktuelles Gewicht 82) fälschlich auf "erreicht", obwohl der Nutzer noch nicht abgenommen hatte. Für WEIGHT/REPS ist "mehr ist Fortschritt" dagegen immer eindeutig (mehr Gewicht gestemmt, mehr Wiederholungen geschafft), deshalb bleibt der Auto-Abschluss auf diese beiden beschränkt; BODYWEIGHT und CUSTOM bleiben wie zuvor rein manuell umschaltbar.
  - End-to-end verifiziert (Playwright + direkte API-Checks gegen `test@example.com`): ein neues WEIGHT-Ziel mit bereits unterschrittenem Zielwert erscheint sofort unter "Erreicht" mit Zeitstempel; ein WEIGHT-Ziel mit unerreichbarem Zielwert bleibt offen und zeigt den korrekten Fortschrittsbalken; Bearbeiten ändert Zielwert sichtbar, Art/Übung werden dabei als reiner Text angezeigt statt editierbar; ein BODYWEIGHT-Ziel mit `currentValue` über dem Zielwert bleibt nach dem Fix korrekt unangetastet (`achievedAt: null`); kein horizontaler Overflow bei 375px.

Mit Phase 33 ist die vollständige `docs/roadmap2.md`-P1-Liste (7/7 Punkte) abgeschlossen.

## Phase 34: Produktfokus — Wasser-Tracker und statische Supplement-/Ernährungs-Tipps entfernt (roadmapv2_additionals.md P0.7) ✅

- [x] **Wasser-Tracker komplett entfernt, Supplement-Wecker bewusst erhalten, statische Tipps-Inhalte entfernt**
  - **Konzept:** Aus `roadmapv2_additionals.md` (P0.7 "Produktfokus – statische Features entfernen"): "Entfernen: Water Tracker, Supplement Tipps. Begründung: Beide Features erzeugen zusätzliche Navigation, UI-Komplexität und Wartungsaufwand, liefern aber keinen ausreichenden dynamischen Mehrwert." Explizit vom Nutzer präzisiert: Supplements nicht komplett entfernen, sondern nur die Referenzliste — der eigentliche Wecker/Reminder-Mechanismus (Name + Uhrzeit + Push-Erinnerung) bleibt bestehen, da er echten dynamischen Wert liefert (persönliche, planbare Erinnerung), anders als die statische Referenzliste.
  - **Umgesetzt — Wasser (vollständig, alle Schichten):** Backend-Modul `water/` (Routes/Service/Types) gelöscht, `waterRoutes`-Registrierung aus `app.ts` entfernt, `WaterLog`-Modell und `User.waterTargetMlOverride`/`waterLogs`-Relation aus dem Schema entfernt (Migration `20260829142000_remove_water_tracker`, droppt Tabelle + Spalte), `water.schema.ts` aus `packages/shared` entfernt. Frontend: `WaterCard.tsx`, `useWater.ts`, `water.api.ts` gelöscht, "Wasser"-Tab aus `NutritionPage` entfernt (nicht mehr in `TABS`, ungültiger `?tab=wasser`-Query-Param fällt sauber auf den Rechner-Tab zurück statt zu crashen, da `TabKey`-Auflösung bereits vor dieser Änderung defensiv war).
  - **Umgesetzt — Supplements (nur die Referenzliste, nicht der Wecker):** `SupplementReferenceList.tsx` und die zugehörigen statischen Daten `supplementReference.ts` gelöscht — das war inhaltlich die "Supplement Tipps" aus der Roadmap. Unangetastet: `Supplement`-Modell, das komplette Backend-Modul (CRUD + minütlicher Scheduler `checkAndSendReminders`), `SupplementCard.tsx` (Name + Uhrzeit anlegen/pausieren/löschen — das *ist* der Wecker), `useSupplements.ts`, `supplement.api.ts`, `remindSupplements`-Push-Flag. Die Karte funktioniert exakt wie vorher.
  - **Umgesetzt — Tipps:** Der bisherige "Tipps"-Tab auf `/nutrition` (statische `NUTRITION_TIPS`-Liste plus die jetzt entfernte Supplement-Referenzliste) komplett aus `NutritionPage` entfernt, `nutritionTips.ts` gelöscht. `NutritionPage` hat jetzt drei statt fünf Tabs: Rechner, Körper, Supplements.
  - **Bewusst nicht angetastet:** `bodyWaterPercent` (Körperwasseranteil als Body-Composition-Metrik) ist ein komplett anderes Feature als der Trink-Tracker und blieb unverändert — reine Namensähnlichkeit ("Wasser"), keine inhaltliche Überschneidung.
  - End-to-end verifiziert (Playwright + direkte Checks, `test@example.com`): `/nutrition` zeigt korrekt nur noch drei Tabs, kein "Wasser", kein "Tipps"; Supplement-Erinnerungskarte weiterhin voll funktionsfähig (Anlegen/Löschen eines Test-Eintrags erfolgreich), keine Referenzliste mehr darauf; `?tab=wasser` fällt sauber auf den Rechner-Tab zurück statt zu crashen; `GET /api/water` liefert jetzt 404 statt 200; `pnpm typecheck`/`pnpm build` in Backend, Frontend und `packages/shared` sauber; kein horizontaler Overflow bei 375px.

---

# Teil 2 – Roadmap 3: Fitnesstracker

Quelle: Wünsche des Nutzers (P0, höchste Priorität) und das strenge PWA-Review vom 19.10.2026
(P1–P4). Reihenfolge innerhalb einer Priorität = empfohlene Umsetzungsreihenfolge.

---

## P0 – Nutzerwünsche (an allererster Stelle)

### P0.1 Plan im Fokusmodus anpassen

- [x] **Übungen direkt im Training ändern.** Im Fokusmodus („Training starten“) eine Übung des
  heutigen Tages austauschen, hinzufügen, entfernen und in der Reihenfolge verschieben, ohne den
  Fokusmodus zu verlassen.
- [x] **Austausch-Vorschläge.** Beim Tauschen werden Alternativen mit gleicher Hauptmuskelgruppe
  und erlaubtem Equipment angeboten (siehe P0.2), z. B. wenn ein Gerät belegt ist.
- [x] **Nur heute oder dauerhaft.** Beim Ändern wählen, ob die Änderung nur für diese Einheit gilt
  oder in den Plan (Phase + Trainingstag) übernommen wird.
- [x] Bereits geloggte Sätze bleiben unverändert; Fortschritt, „Letztes Mal“ und PR-Erkennung
  beziehen sich auf die tatsächlich trainierte Übung.
- [x] **Offline-fähig** wie das übrige Training: Die Änderung wird lokal gespeichert und
  synchronisiert, sobald wieder Netz da ist.

### P0.2 KI-Plan-Generator: Split und Equipment abfragen

- [x] **Bevorzugten Split abfragen.** Der Fragebogen fragt aktiv nach dem Split (z. B.
  Ganzkörper, Ober-/Unterkörper, Push/Pull/Beine, Bro-Split, „egal – KI entscheidet“), statt ihn
  nur aus der Trainingshäufigkeit abzuleiten (`SPLIT_TEMPLATES` in `promptBuilder.ts`). Die
  Auswahl wird gespeichert und bei der nächsten Generierung vorbelegt.
- [x] **Erlaubtes Equipment als Mehrfachauswahl** statt der drei Pauschalwerte
  `homegym | dumbbells | fullgym`:
  - Geräte/Maschinen
  - Kurzhanteln
  - Langhantel (inkl. SZ-Stange)
  - Kabelturm
  - Ohne Geräte (Körpergewicht)
  - optional: Kettlebells, Bänder, Medizinball, Gymnastikball, Foam Roller, Sonstiges
- [x] **Ausschlüsse ausdrücklich abfragen** („Mit welchen Mitteln möchtest du keine Übungen?“).
  Ausgeschlossenes Equipment wird hart herausgefiltert: im Kandidatenkatalog vor dem Prompt
  und zusätzlich in der Validierung der KI-Antwort, damit die KI nichts davon vorschlagen kann.
- [x] **Standard für alle neuen Fragebögen:** nur Geräte, Kurzhanteln, Langhantel, Kabelturm und
  Körpergewicht. **Keine** Übungen mit Gymnastikball (`exercise ball`), Medizinball
  (`medicine ball`) oder ähnlichem Kleingerät.
- [x] Equipment-Präferenz gilt auch für die Austausch-Vorschläge aus P0.1. (Tages-Challenge ist
  ohnehin gerätefrei, Ziel-Vorschläge beziehen sich nur auf bereits trainierte Übungen.)

### P0.3 Dehnübungen ohne Partner

- [x] **Partner-Dehnübungen streichen.** Dehnübungen, für die zwei Personen nötig sind (im
  free-exercise-db-Katalog z. B. Namen mit „Partner“ / „with partner“ / „assisted“), werden aus der
  Dehnplan-Auswahl (`stretching.service.ts`, `stretchSelection.ts`), der Daily-Dehnroutine und
  der KI-Dehnplan-Erstellung ausgeschlossen.
- [x] Bestehende Dehnpläne bereinigen (Migration oder einmaliges Neu-Erzeugen betroffener Tage).
- [x] Test: Kein Partner-Stretch landet mehr in einem generierten oder vorgeschlagenen Plan.

### P0.4 KI-Plan-Generator: Qualität und Kontrolle

- [x] **Ausgewogener Übungskatalog für den Prompt.** Bisher gingen die ersten 150 Übungen in
  Datenbank-Reihenfolge an die KI (bei „Vollausgestattetes Studio“ praktisch A–C; Beinpresse,
  Latzug, Rudern am Kabel, Klimmzüge, Rumänisches Kreuzheben fehlten). Neu: je Muskelgruppe
  eine feste Anzahl, bevorzugt Grundübungen und bereits geloggte Übungen.
- [x] **KI-Zusatzinfos speichern statt verwerfen:** Wiederholungsbereich, Ziel-RIR, Satzpause,
  Technik-Hinweis und Alternativübung je Plan-Übung; Begründung des Plans anzeigen. Die
  Satzpause startet den Pausen-Timer, die Alternative dient dem Übungstausch (P0.1).
- [x] **Vorschau vor dem Übernehmen.** Der generierte Plan ist zuerst ein Entwurf: übernehmen,
  verwerfen oder einzelne Tage neu generieren. Der vorherige Plan bleibt einmal
  wiederherstellbar.
- [x] **Fragebogen-Antworten speichern** und beim nächsten Mal vorbelegen (bisher jedes Mal
  „Homegym“ + „Anfänger“).
- [x] **Antwort prüfen:** Übungsanzahl je Tag, keine Duplikate am selben Tag; fehlende Einträge
  aus dem Katalog passend zum Tagesfokus auffüllen.
- [x] **Startgewicht vorschlagen** aus den Bestleistungen der letzten 8 Wochen.

---

## P1 – Kritisch (Kernnutzen im Studio)

### P1.1 Mobile Darstellung bei großer Schrift/Anzeigegröße ✅

- [x] Bei schmalem Viewport (~320 px, z. B. große System-Schrift nach Android-Update) lief jede
  Seite seitlich über. Behoben: Kopfzeile schrumpft, einspaltige Grids mit `grid-cols-1`,
  Wochen-Kacheln skalieren. Verifiziert bei 300–412 px.
- [x] Regressionsschutz: E2E-Test, der alle Seiten bei 320 px auf `scrollWidth <= innerWidth`
  prüft.

### P1.2 Training offline kaltstarten

- [x] React-Query-Cache in IndexedDB persistieren (`PersistQueryClientProvider` +
  Async-Storage-Persister, `gcTime` ≥ 24 h). Mindestens Plan, Wochenstatus, Übungen des Plans,
  Cardio- und Dehnplan.
- [x] E2E-Test: App offline frisch öffnen → Training starten → Satz loggen → online → Sync.

### P1.3 Bildschirm im Training wach halten, Pausen-Timer bei Sperrbildschirm

- [x] Screen Wake Lock (`navigator.wakeLock`) im Fokusmodus, bei `visibilitychange` neu
  anfordern.
- [x] Pausen-Ende bei gesperrtem Bildschirm melden: beim Start der Pause einen verzögerten Push
  serverseitig planen, bei Abbruch/±15 s stornieren bzw. verschieben.

### P1.4 Gelöschte Sätze verschwinden auf allen Geräten

- [x] `fetchAndCacheWorkoutLogs` gleicht ab: lokal synchronisierte Zeilen (`id !== null`), die
  der Server nicht mehr liefert und die nicht in der Pending-Queue stehen, werden entfernt.
- [x] Danach Delta-Sync (siehe P2.1). (`bulkPut` statt einzelner `put` ist schon umgesetzt.)

---

## P2 – Hoch (Performance, Robustheit, Installierbarkeit)

### P2.1 Delta-Sync statt komplette Historie

- [x] `GET /workout-logs?updatedSince=…` plus Tombstones für Löschungen; `bulkPut` statt
  einzelner `put`-Aufrufe.

### P2.2 Code-Splitting

- [x] Routen mit `React.lazy` laden (aktuell ein einziger JS-Chunk mit ca. 780 KB). Ui-Kit,
  Kamera, KI-Generator, Körperanalyse zuerst auslagern. Ergebnis: JS beim ersten Laden der Login-Seite
  796 → 379 KB (−52 %), Weg bis zum Dashboard rund 470 KB; Vendor-Pakete getrennt, damit App-Updates
  weniger Daten ziehen.

### P2.3 Caddy: Cache- und Security-Header

- [x] `Cache-Control: no-cache` für `/sw.js`, `/index.html`, `/manifest.webmanifest`.
- [x] `Cache-Control: public, max-age=31536000, immutable` für `/assets/*`.
- [x] CSP, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- [x] ~~Cloudflare-Caching für `sw.js` prüfen~~ Entfällt (Entscheidung des Nutzers).

### P2.4 Manifest vervollständigen

- [x] `lang: "de"` (Build erzeugt derzeit `"en"`), `id`.
- [x] `shortcuts`: „Training starten“, „Daily“, „Fortschritt“.
- [x] `screenshots` (schmal + breit) für den erweiterten Android-Installationsdialog.
- [x] `apple-touch-icon` in 180×180. Dabei aufgefallen: Die PWA-Icons waren ein blaues Platzhalter-Quadrat und
  passten nicht zum App-Logo — jetzt aus dem Logo erzeugt (`scripts/generate-pwa-icons.mjs`).

### P2.5 Dauerhafter Speicher

- [x] `navigator.storage.persist()` nach dem Login anfordern, damit offline geloggte, noch nicht
  synchronisierte Sätze nicht vom Browser gelöscht werden.

---

## P3 – Bedienung und Effizienz

- [x] **Satz loggen mit einem Tap:** Speichern-Button als größte, daumennahe Fläche;
  Gewichts-Schrittweite je Übung merken (2,5 / 5 kg); RIR als Auswahl 0–4 statt Eingabefeld.
- [x] **Progressionsvorschlag in der Satzzeile** (Logik aus Phase 24 sichtbar machen), z. B.
  „Heute: 82,5 kg × 8 (+2,5)“.
- [x] **Untere Tab-Leiste** auf dem Handy (Heute · Training · Fortschritt · Plan · Mehr) statt
  Hamburger-Menü mit zehn Einträgen; Tagebuch und Historie zusammenlegen.
- [x] **App-Badge** (`navigator.setAppBadge`) für offene Session bzw. nicht synchronisierte Sätze.
- [x] ~~**Aktionen in Benachrichtigungen**, z. B. Supplement-Erinnerung direkt mit „Genommen“
  bestätigen.~~ Entfällt (Entscheidung des Nutzers): keine Einnahme-Erfassung geplant.
- [x] Eigenen Timer-Sound als Blob in IndexedDB statt als Data-URL im localStorage speichern.
- [x] Skeleton der App-Shell statt „Lädt…“ beim Offline-Kaltstart (`ProtectedRoute`).

---

## P3b – KI-Generator Ausbau

- [x] Alle drei Rotationsphasen in einem Durchgang generieren; Hauptübungen bleiben über die
  Phasen gleich, nur Sätze/Wiederholungen/Tempo wechseln.
- [x] Plateau-Erkennung (aus den Ziel-Vorschlägen) nutzen: stagnierende Übungen durch Varianten
  ersetzen.
- [x] Cardio und Dehnen im selben Fragebogen planen.

---

## P4 – Fehlende Funktionen

- [x] **Plattenrechner** in der Satzzeile (welche Scheiben pro Seite).
- [x] **Automatische Aufwärmsätze** (z. B. 40/60/80 % des Arbeitsgewichts), zählen nicht ins
  Volumen und nicht als PR.
- [x] **Notiz pro Übung/Satz** (z. B. Sitzeinstellung, Beschwerden), im Training sichtbar.
- [x] **Wochenvolumen pro Muskelgruppe** (Sätze pro Muskel) auf der Fortschrittsseite.
- [x] **Körpergewicht schnell erfassen** vom Dashboard, mit gleitendem 7-Tage-Mittel.
- [x] **Health-Integration** (Health Connect bzw. Import aus Apple Health): Import von Gewicht und Körperfett aus Export-Dateien (Apple Health, Samsung Health, Google/CSV). Eine direkte Anbindung ist aus einer Web-App nicht möglich.
- [x] **Trainingszusammenfassung teilen** (`navigator.share`).
- [x] **Kalender-Heatmap der Trainingstage + Streak** auf dem Dashboard.
- [x] **Geschätzter Kalorienverbrauch pro Übung** (aus Gewicht, Größe, Alter, Geschlecht sowie Wdh. und Gewicht
  der Sätze) im Training, im Tagebuch und in der Historie.
- [x] **Info-Bereich „Berechnungen & Quellen“** (Einstellungen) mit Formel, Eingaben und Herkunft jeder Berechnung
  sowie (i)-Knöpfe an den berechneten Werten.

---

# Teil 3 – Roadmap 2: TODO vor Hardening

🔴 P0 – Kritisch

☑ Trainingsablauf vollständig machen – Start, Sätze, Pause, Abbruch, Fortsetzen und Abschluss zuverlässig. (Als Buttons umgesetzt, offline-fähig wie das Satz-Logging — siehe ARCHITECTURE.md/ROADMAP.md.)
☑ Trainingsplan & Rotation finalisieren – Phasenwechsel, 8-Wochen-Zyklus, Pausen und Neustart eindeutig. (Pausieren/Fortsetzen/Phase neu starten als Buttons — siehe ARCHITECTURE.md/ROADMAP.md.)
☑ Progressionslogik festlegen – Klare Regeln für Steigerung, Fehlversuche und Deloads. (Aufbau/Negativ: Gewicht, Muskelausdauer: Wdh. — Vorschlag + Prefill im Plan-Tagebuch, siehe ARCHITECTURE.md/ROADMAP.md.)
☑ Offline-Sync fachlich fertigstellen – Offline-Trainings zuverlässig und vollständig synchronisieren. (Periodischer Retry, fehlgeschlagene Mutationen werden sichtbar statt still verworfen, Session-Queue jetzt auch im "ausstehend"-Badge — siehe ARCHITECTURE.md/ROADMAP.md.)
☑ Datenkonflikte definieren – Verhalten bei parallelen/Offline-Änderungen festlegen. (Policy: jüngste Aktion gewinnt; zwei parallel gestartete Sessions werden automatisch aufgelöst; Löschen schlägt ein verspätetes Update — siehe ARCHITECTURE.md/ROADMAP.md.)

🟠 P1 – Wichtig

☑ Dashboard finalisieren – Heutiges Training, Fortschritt und Ziele übersichtlich. (Log-Tabelle auf heute begrenzt, kompakte Ziele-Karte mit Fortschrittsbalken ergänzt — siehe ARCHITECTURE.md/ROADMAP.md.)
☑ Fortschrittsansicht abrunden – Gewicht, Körperdaten, Kraft, Volumen, PRs und Zeiträume. (Neue Seite `/progress` mit Zeitraum-Filter, reine Frontend-Auswertung bestehender Daten — siehe ARCHITECTURE.md/ROADMAP.md.)
☑ Progress-Fotos komplettieren – Aufnahme, Upload, Datum, Galerie und Vorher/Nachher. (Aufnahme/Upload/Galerie/Vorher-Nachher waren schon fertig — Lücke war "Datum": Upload-Plumbing akzeptierte bereits ein eigenes Datum, aber die UI zeigte nie ein Datumsfeld, jetzt ergänzt — siehe ARCHITECTURE.md/ROADMAP.md.)
☑ Push-Einstellungen fertigstellen – Erinnerungen individuell aktivierbar und konfigurierbar. (Drei Reminder-Typen (Phasenwechsel/Supplements/Foto) einzeln umschaltbar statt einem Alles-oder-nichts-Schalter — siehe ARCHITECTURE.md/ROADMAP.md.)
☑ Workout-Historie vervollständigen – Vergangene Trainings ansehen und bearbeiten. (Neue Seite `/history`, nach Tag gruppiert, Übungsfilter, Bearbeiten/Löschen — siehe ROADMAP.md Phase 31 / ARCHITECTURE.md)
☑ Übungsverwaltung finalisieren – Übungen anlegen, bearbeiten, deaktivieren und korrekt verwenden. (Anlegen/Bearbeiten-Dialog, neues `isActive`-Feld statt Hard-Delete, Picker filtern automatisch — siehe ROADMAP.md Phase 32 / ARCHITECTURE.md)
☑ Ziele vollständig machen – Ziele erstellen, Fortschritt und Abschluss sauber behandeln. (Auto-Abschluss für Gewicht/Wiederholungen-Ziele, Bearbeiten-Dialog für Zielwert/-datum — siehe ROADMAP.md Phase 33 / ARCHITECTURE.md; damit P1 vollständig)

🟡 P2 – Abrunden

☑ Wasser-Tracking finalisieren – Tagesziel, Eingabe und Verlauf.
☑ Supplement-Tracking finalisieren – Einnahmen, Status und Erinnerungen.
☑ Daily Challenge abrunden – Anzeige, Erledigung und Verlauf.
☑ Ernährungsrechner abrunden – Eingaben, Berechnung und Zielwerte.
☑ Export/Backup prüfen – Persönliche Daten sicher exportierbar machen.
☑ Empty/Error/Loading States – Alle zentralen Ansichten sauber behandeln.
☑ Mobile UX finalisieren – Touch-Bedienung und schnelle Eingaben optimieren.

🟢 P3 – Optional

☒ AI-Übungsvorschläge – Komfortfeature. (verworfen, nicht geplant)
☐ Wearables/Health-Integrationen – Nach Feature Freeze.
☐ Erweiterte Statistiken – Nur bei echtem Mehrwert.
☐ Social Features – Nicht vor Hardening nötig.

🏁 Feature Freeze

☑ Keine neuen großen Features – Danach nur Fehlerbehebung/Stabilisierung.
☑ Kernflows komplett testen – Login → Dashboard → Training → Abschluss → Historie → Fortschritt.
☑ Offline-Kernflow testen – Offline erfassen → online gehen → Sync kontrollieren.

---

# Teil 4 – Roadmap v2: Ergänzungen

## Leitprinzip

Die App soll sich von einer Feature-Sammlung zu einem fokussierten, persönlichen Trainingsbegleiter entwickeln.

Der Fokus liegt auf:
- schneller und angenehmer Nutzung während des Trainings
- zuverlässiger Offline-Nutzung
- Schutz und Eigentum der persönlichen Daten
- intelligenter Auswertung vorhandener Trainingsdaten
- personalisierten Features statt generischer Fitness-Features
- hoher technischer Qualität und langfristiger Wartbarkeit

## P0 — Foundation & Stabilität

Ziel: Die technische Basis absichern, bevor neue größere Features entwickelt werden.

### P0.1 CI Pipeline einführen

GitHub Actions als zentrale CI-Plattform etablieren.

Bei jedem Push:
- Lint
- Typecheck
- Unit Tests
- Build

Bei Pull Requests:
- Integration Tests
- Playwright E2E Tests
- Offline-Sync Tests
- Build Verification

Branch Protection für main:
- Pull Request erforderlich
- alle Required Checks müssen erfolgreich sein
- Branch muss aktuell sein
- keine offenen Review-/Conversation-Probleme

Ziel: main ist jederzeit buildbar, getestet und deploybar.

### P0.2 Deployment Pipeline

Nach erfolgreichem Merge auf main:
- CI erfolgreich
- Docker Build
- Deployment
- Health Check

Deployment erfolgt nur bei erfolgreicher CI.

### P0.3 Offline-Sync UX

Der bestehende Offline-Sync muss transparent sein.

Anzeigen:
- Online
- Offline
- Synchronisierung läuft
- Anzahl ausstehender Änderungen
- Synchronisierung fehlgeschlagen

Bei Fehlern:
- verständliche Fehlermeldung
- Retry-Möglichkeit
- keine stillen Fehler

Ziel: Der Nutzer soll jederzeit verstehen, ob seine Daten sicher gespeichert und synchronisiert sind.

### P0.4 Kritische Offline E2E Tests

Automatisierte Tests für:
- Login
- Offline gehen
- Workout erstellen
- Workout bearbeiten
- App neu laden
- lokale Daten prüfen
- Online gehen
- Synchronisierung
- Server-State prüfen

Zusätzliche Szenarien:
- mehrere Offline-Änderungen
- Mutation Coalescing
- Create + Delete offline
- Sync Fehler
- Retry
- App Reload während Pending Mutations

### P0.5 Progress Photo Security Review
- Zugriff nur für berechtigte Nutzer
- keine öffentlich erratbaren URLs
- Authorization vor Bildzugriff
- MIME-Type Validation
- File Size Limits
- Image Dimension Limits
- EXIF Metadata entfernen
- sicheres echtes Delete

Optional:
- serverseitige Image-Komprimierung
- WebP/AVIF Konvertierung

### P0.6 PWA Update Flow
- neue Version erkennen
- Update-Banner anzeigen
- Nutzer entscheidet über Reload
- kein automatisches Reload während aktivem Workout

### P0.7 Produktfokus – statische Features entfernen

Entfernen:
- Water Tracker
- Supplement Tipps

Begründung: Beide Features erzeugen zusätzliche Navigation, UI-Komplexität und Wartungsaufwand, liefern aber keinen ausreichenden dynamischen Mehrwert.

Ziel: Weniger Features, aber stärkere Features.

## P1 — Core Training Experience

Ziel: Das eigentliche Trainingserlebnis deutlich verbessern.

### P1.1 Workout Flow optimieren
- Previous Performance direkt sichtbar
- letzte Werte sinnvoll vorausfüllen
- möglichst wenige Interaktionen
- schnelle Gewichtsanpassung
- schnelle Rep-Anpassung
- Sets schnell hinzufügen
- Sets schnell löschen
- klare visuelle Struktur während aktivem Workout

Leitfrage: Wie schnell kann ein Nutzer einen Satz loggen?

### P1.2 Timer verbessern

Das bestehende frei konfigurierbare Timer-Konzept bleibt bestehen.

Keine festen automatischen Pausenzeiten, da Pausenzeiten:
- übungsabhängig
- trainingszielabhängig
- personenabhängig

Ergänzen:
- optionale Vibration bei Timer-Ende
- optionaler Sound
- zuverlässiges Verhalten bei App-Wechsel

### P1.3 PR Detection

Automatisch erkennen:
- Weight PR
- Rep PR
- Estimated 1RM PR
- Volume PR

Die Anzeige soll motivierend, aber nicht aufdringlich sein.

### P1.4 Progress Intelligence

Vorhandene Trainingsdaten besser nutzen:
- Exercise Progress Charts
- Trainingsvolumen-Trends
- Progress über Zeit
- Konsistenz
- Stagnation erkennen
- Training Frequency

Ziel: Die App soll nicht nur Daten speichern, sondern dem Nutzer helfen, diese zu verstehen.

### P1.5 Smart Goal Suggestions

Goal Suggestions von einer statischen Progressionslogik zu einem datenbasierten Modell weiterentwickeln.

Berücksichtigen:
- Exercise Type
- bisherige Progression
- Trainingsfrequenz
- Trainingsvolumen
- Rep Range
- Plateaus
- bisherige Zielerreichung

Mögliche Zielstufen:
- Konservativ
- Realistisch
- Ambitioniert

Wichtig: Zunächst regelbasiert entwickeln. Kein AI-Zwang.

### P1.6 Export & Backup

Mindestens:
- JSON Full Backup
- CSV Workout Export

Mögliche Exportbereiche:
- Workouts
- Goals
- Body Metrics
- Training Plans
- Settings

Ziel: Persönliche Trainingsdaten sollen nicht ausschließlich an die App gebunden sein.

### P1.7 Notification Preferences

Notifications bleiben vollständig personalisierbar.

Bereiche:

Training:
- Planwechsel
- Workout Reminder

Progress:
- Personal Records
- Goal Achievements

Challenges:
- Daily Challenges

System:
- Sync Errors
- wichtige App Updates

Der Nutzer entscheidet selbst, welche Kategorien aktiviert sind.

### P1.8 Plan-aware Daily Challenges

Daily Challenges werden nicht generisch erzeugt.

Sie sollen sich orientieren an:
- aktuellem Trainingsplan
- aktueller Trainingsphase
- geplanten Übungen
- Trainingshistorie
- aktueller Progression

Mögliche Kategorien:
- Technique
- Progression
- Volume
- Consistency
- optional Recovery

Challenge Rotation:
- aktuelle Challenge
- 1–2 Rotationen verfügbar
- neue Challenge muss weiterhin zum Trainingsplan passen

Wichtig: Die Rotation darf nicht komplett zufällig sein. Alle Alternativen müssen zum aktuellen Trainingskontext passen.

## P2 — Quality & Polish

Ziel: Die App langfristig technisch und UX-seitig weiter verbessern.

### P2.1 Lighthouse CI

Automatisierte Qualitätschecks für:
- Performance
- Accessibility
- Best Practices

Performance Regressionen sollen sichtbar werden.

### P2.2 Accessibility Audit

Prüfen:
- Screenreader Unterstützung
- Kontrast
- Focus States
- Icon Labels
- Keyboard Navigation
- Bottom Sheets
- Modals
- Reduced Motion

Ziel: Alle zentralen Trainingsflows sollen möglichst zugänglich sein.

### P2.3 Performance Optimierung

Analysieren und optimieren:
- Bundle Size
- Route Code Splitting
- Lazy Loading
- Image Loading
- Image Compression
- Caching
- Rendering Performance

Besonders priorisieren:
- Workout Screen
- Dashboard
- Exercise Library

### P2.4 Trainingsplan-Rotation UX

Automatische Planwechsel nicht vollständig ohne Nutzerkontrolle durchführen.

Möglichkeiten:
- Phase wechseln
- Phase eine Woche verlängern

Ziel: Automatisierung mit Nutzerkontrolle kombinieren.

## Langfristige Architektur-Richtung

Die App bleibt Account-basiert.

Der Account ermöglicht:
- Backup
- Multi-Device Sync
- Datenwiederherstellung
- Push Notifications

Die lokale Datenbank bleibt jedoch zentral für die User Experience.

Leitprinzip:

Local-first UX + Account-based Cloud Sync.

## Zielbild

Die App soll langfristig kein generischer Fitness-Hub sein.

Nicht: Eine App mit möglichst vielen Fitness-Features.

Sondern: Ein persönlicher Trainingsbegleiter, der meine Trainingsdaten versteht, meinen Fortschritt sichtbar macht und mich während des Trainings möglichst wenig aufhält.

## Prioritätenübersicht

P0 — FOUNDATION
- GitHub Actions CI
- Branch Protection
- Deployment Pipeline
- Offline Sync UI
- Offline E2E Tests
- Progress Photo Security
- PWA Update Flow
- Water + Supplement Features entfernen

P1 — CORE VALUE
- Workout UX
- Timer Vibration
- PR Detection
- Progress Intelligence
- Smart Goal Suggestions
- Export / Backup
- Notification Preferences
- Plan-aware Daily Challenges
- 1–2 Challenge Rotations

P2 — QUALITY & POLISH
- Lighthouse CI
- Accessibility
- Performance Optimierung
- Plan Rotation UX

## Grundsatz für zukünftige Features

Bevor ein neues Feature entwickelt wird, sollte es diese Frage beantworten:

Verbessert es das Training, das Verständnis des Fortschritts oder die langfristige Motivation anhand persönlicher Daten?

Wenn nicht, sollte kritisch geprüft werden, ob es wirklich in die App gehört.

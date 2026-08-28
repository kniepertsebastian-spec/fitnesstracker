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

<!-- ROADMAP_FITNESSTRACKER.md -->
# Roadmap & Refactoring: Fitnesstracker

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
# Feature-Roadmap: Fitnesstracker

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
  - **Konzept:** Aus `roadmap2.md`: "Trainingsablauf vollständig machen – Start, Sätze, Pause, Abbruch, Fortsetzen und Abschluss zuverlässig." Nach Absprache bewusst schlank gehalten — reicht als Buttons, keine Pflicht, Sätze nur innerhalb einer laufenden Session loggen zu können.
  - **Umgesetzt:** Neues `WorkoutSession`-Modell (`clientId` für Offline-Idempotenz wie bei `WorkoutLog`, `status`-Enum `ACTIVE`/`PAUSED`/`COMPLETED`/`ABORTED`, `startedAt`/`endedAt`) — bewusst **kein** `sessionId` auf `WorkoutLog`: das Loggen eines Satzes bleibt unabhängig davon, ob eine Session offen ist, die Session läuft parallel dazu, ist keine Voraussetzung fürs bestehende "+ Satz". `GET /workout-sessions/open` liefert die aktuell offene Session (höchstens eine gleichzeitig pro Nutzer), `POST /workout-sessions` startet (idempotent per `clientId`, gleiches Upsert-Muster wie `createWorkoutLog`), `PATCH /workout-sessions/:id` setzt den Status (setzt `endedAt`, sobald der Status `COMPLETED`/`ABORTED` wird). Frontend: `WorkoutSessionBar` oben auf dem Dashboard — "Training starten" ohne offene Session, sonst Status + "Pause"/"Fortsetzen"/"Abschließen"/"Abbrechen".
  - **Offline-Sync als eigenes, kleineres Pendant zu `workoutLogSync.ts`** statt Erweiterung der bestehenden Log-Sync-Queue um einen zweiten Mutationstyp — eigene Dexie-Tabellen (`workoutSessions`, `pendingSessionMutations`, neue Dexie-Version 2 in `offline/db.ts`), eigenes, aber deutlich kleineres `offline/workoutSessionSync.ts` (nur `create`/`update`, kein `delete` — eine Session wird nie gelöscht, nur beendet). Gleiche Grundmuster wie beim Satz-Logging: lokal-zuerst schreiben, dann synchron in die Mutation-Queue einreihen und sofort zu flushen versuchen; ein Offline-Start bekommt sofort eine lokale `id: null`-Zeile und ist voll bedienbar (Pause/Abbrechen/Abschließen funktionieren offline genauso), der Sync zum Server passiert beim nächsten `online`-Event. Gewählt statt einer gemeinsamen, kind-parametrisierten Queue, um die bereits funktionierende, getestete Log-Sync-Logik nicht anzufassen.
  - End-to-end verifiziert: Start→Pause→Reload (Server-Persistenz bestätigt)→Fortsetzen läuft wie erwartet; offline Abbrechen einer laufenden Session aktualisiert die UI sofort; offline eine neue Session starten funktioniert sofort; nach Reconnect+Reload ist die offline gestartete Session serverseitig vorhanden (Sync bestätigt); kein horizontaler Overflow bei 375px, auch mit allen drei Aktions-Buttons gleichzeitig sichtbar.

## Phase 23: Trainingsplan & Rotation — Pausen und Neustart (roadmap2.md P0.2) ✅

- [x] **Pausieren/Fortsetzen/Phase neu starten als Buttons auf `/plan`**
  - **Konzept:** Aus `roadmap2.md`: "Trainingsplan & Rotation finalisieren – Phasenwechsel, 8-Wochen-Zyklus, Pausen und Neustart eindeutig." Phasenwechsel und der 8-Wochen-Zyklus existierten bereits (`rotatePhaseIfDue`/`rotateAllDuePlans`); gefehlt hat, den Rotations-Countdown pausieren zu können (z. B. Verletzung/Urlaub) und die aktuelle Phase explizit neu zu starten.
  - **Umgesetzt:** Neues `TrainingPlan.pausedAt`-Feld (nullable). `rotatePhaseIfDue` überspringt eine pausierte Plan komplett (liefert `nextRotationOn: null`), der Scheduler filtert pausierte Pläne bereits in der SQL-Query raus. `POST /training-plan/pause` setzt `pausedAt` (idempotent — ein zweites Pausieren verschiebt den Zeitpunkt nicht), `POST /training-plan/resume` verschiebt `phaseStartedOn` exakt um die pausierte Dauer nach vorne (`phaseStartedOn += (jetzt - pausedAt)`), damit die verbleibende Zeit bis zur Rotation erhalten bleibt statt durch die Pause stillschweigend aufgezehrt zu werden — 10 Tage pausiert und wieder fortgesetzt heißt exakt 10 Tage später wieder dran, per Skript verifiziert. `POST /training-plan/restart-phase` setzt `phaseStartedOn` auf den Montag der aktuellen Woche zurück (`mostRecentMonday`, gleiche Normalisierung wie beim initialen Plan-Anlegen), ohne `currentPhase` oder die Historie anzufassen — kein Phasenwechsel wurde ja tatsächlich abgeschlossen — und hebt eine laufende Pause automatisch mit auf.
  - **`nextRotationOn` ist jetzt `string | null`** im DTO (`null` während einer Pause) — `/plan` zeigt "pausiert seit …" statt eines nächsten Wechsel-Datums, sobald `pausedAt` gesetzt ist. Keine Bestätigungs-Dialoge für "Phase neu starten", obwohl es den Fortschritt der aktuellen Phase zurücksetzt — konsistent mit dem Rest der App, die nirgends `window.confirm` für destruktive Aktionen nutzt (z. B. "Löschen" in der Log-Tabelle, "Abbrechen" bei der Trainings-Session).
  - End-to-end verifiziert: Pausieren zeigt sofort "pausiert seit HH…" statt des Wechsel-Datums und übersteht einen Reload; Fortsetzen zeigt wieder ein nächstes Wechsel-Datum; Phase neu starten setzt "Seit" korrekt auf den aktuellen Montag zurück; ein Skript-Test mit künstlich zehn Tage zurückdatiertem `pausedAt` bestätigt die exakte 10-Tage-Verschiebung beim Fortsetzen; kein horizontaler Overflow bei 375px mit allen Buttons sichtbar.

## Phase 24: Progressionslogik — Steigerung, Fehlversuche, Deloads (roadmap2.md P0.3) ✅

- [x] **Gewichts-/Wiederholungs-Vorschlag im Plan-Tagebuch, phasenabhängig**
  - **Konzept:** Aus `roadmap2.md`: "Progressionslogik festlegen – Klare Regeln für Steigerung, Fehlversuche und Deloads." Nach Absprache: nur Aufbau (Gewicht) sollte ursprünglich betroffen sein, Muskelausdauer/Negativ eher über Wiederholungen — beim genaueren Blick auf die bestehende Phasen-Definition (`promptBuilder.ts`s `PHASE_GUIDANCE`: Negativ = 4-6 Wdh., exzentrische Überlastung, nicht Ausdauer) stellte sich heraus, dass Negativ vom Wiederholungsbereich her eher zu Aufbau passt als zu Muskelausdauer (15-25 Wdh.) — auf Nachfrage entschieden: Aufbau **und** Negativ progressieren über Gewicht, nur Muskelausdauer über Wiederholungen.
  - **Umgesetzt:** `computeProgression` (`planWeekStatus.service.ts`) vergleicht die letzten zwei geloggten Sätze einer Übung (unabhängig von der Woche — Fortschritt braucht die volle Historie, nicht nur "diese Woche") gegen deren Ziel-Wiederholungen (`PlanExercise.targetReps`, sonst ein Phasen-Default: Aufbau 10, Muskelausdauer 20, Negativ 5 — Mittelwerte aus `PHASE_GUIDANCE`). Klare Regeln: Ziel erreicht → Steigerung (Gewichts-Modus: +2,5kg; Wdh.-Modus: +2 Wdh., gleiches Gewicht); Ziel verfehlt ("Fehlversuch") → gleiches Gewicht/gleiche Ziel-Wdh. nochmal; zweimal in Folge beim selben Gewicht verfehlt → Deload (-10 %, auf 2,5kg gerundet). Ergebnis (`ProgressionSuggestion`, neues Feld `progression` auf `PlanDiaryExerciseDto`) fließt direkt in die Plan-Tagebuch-Zeile (`CurrentPlanCard.tsx`): eine kurze Subtitle-Zeile unter dem Übungsnamen ("↑ 62.5kg", "= 40kg", "Deload → 35kg") und die Wdh./kg-Felder sind mit dem Vorschlag vorausgefüllt statt leer — wer einfach nur bestätigt, trainiert automatisch nach der Regel, ohne selbst rechnen zu müssen.
  - **Batch-Query pro Übung statt einer gedeckelten Gesamtabfrage** (`fetchRecentSetsByExercise`): für jede der (meist sechs) Übungen des aktiven Tages werden die letzten zwei Sätze einzeln per `take: 2` abgefragt (parallel via `Promise.all`), statt eine einzige `take`-begrenzte Abfrage über alle Übungen zu teilen — bei ungleich verteiltem Logging (eine Übung viel öfter trainiert als eine andere) liefert Letzteres sonst für die selten trainierte Übung keine oder falsche Historie.
  - **Kein Vorschlag ohne jede Historie** (`progression: null`) — eine frisch zum Plan hinzugefügte Übung zeigt leere Felder wie bisher, kein erfundener Startwert.
  - End-to-end verifiziert (per Skript direkt gegen `getWeeklyPlanStatus` sowie live im Browser): zwei Fehlversuche beim selben Gewicht lösen korrekt einen Deload aus (z. B. 40kg → 35kg), ein erreichtes Ziel schlägt korrekt eine Gewichtssteigerung vor (20kg → 22,5kg), Muskelausdauer schlägt bei erreichtem Ziel eine Wiederholungssteigerung statt einer Gewichtssteigerung vor: die Werte erscheinen korrekt vorausgefüllt in den Tagebuch-Feldern. Dabei eine echte UI-Lücke gefunden und gefixt: das kg-Feld (`w-11`) schnitt vorausgefüllte Nachkommawerte wie "62.5" visuell auf "62" ab (der tatsächliche Wert war korrekt, nur nicht vollständig sichtbar) — behoben durch Verbreiterung auf `w-14`, weiterhin kein horizontaler Overflow bei 375px.

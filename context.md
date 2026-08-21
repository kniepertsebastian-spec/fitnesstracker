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
  Bottom-Nav-Schrift auf `text-xs` reduziert, als "Ernährung" als fünfter Tab dazukam.
- **Profil & Ernährungsrechner**: `/nutrition`-UI, Mifflin-St-Jeor-Formel für BMR/TDEE +
  Protein-Ziel nach Ziel (Abnehmen/Halten/Aufbauen), berechnete Werte nie gespeichert, immer aus
  den Profil-Feldern neu berechnet. Statische Ernährungstipps-Liste. End-to-end getestet: beide
  Formel-Zweige (männlich/weiblich), Persistenz, Neuberechnung nach Bearbeitung (Alter 25→31 senkte
  BMR exakt um die erwarteten 30 kcal).
- **Wasser-Tracking**: Karte auf `/nutrition` (kein eigener Nav-Tab, bewusst — siehe
  `ARCHITECTURE.md`), Antippen für ±ml, Zielvorschlag aus Profilgewicht (35 ml/kg) oder
  Standardwert (2500 ml), manuell überschreibbar (setzt Profil voraus), nullgefüllter
  7-Tage-Verlauf. End-to-end getestet: Zielableitung, Klemmen bei 0, Override
  setzen/löschen, 409 ohne Profil.
- **Tages-Challenge**: Karte auf `/` (Training-Log), 3 zufällige Bodyweight-Übungen aus dem
  bereits importierten Übungskatalog (`equipment = "body only"`, Keyword-Filter gegen
  Bank/Klimmzugstange/etc.), Zufalls-Zielwerte (10/15/20/25 Wdh.), Antippen zum Hochzählen,
  verlinkt auf die echte Übungs-Detailseite. Zufälligkeit passiert genau einmal pro Tag
  (`@@unique([userId, date, exerciseId])`), wiederholte Aufrufe liefern dieselbe Auswahl.
  End-to-end getestet: Idempotenz über mehrere GETs, Wdh. hinzufügen, Übertreffen des Ziels ohne
  Deckel, Klemmen bei 0.
- **Supplement-Erinnerungen & Referenzliste**: Karten auf `/nutrition` — eigene Supplements mit
  Name+Uhrzeit, tägliche Push-Erinnerung zur lokalen Wanduhrzeit (Zeitzone vom Browser erfasst,
  nicht UTC — siehe `ARCHITECTURE.md` für die Begründung), Scheduler-Tick jede Minute, statische
  Referenzliste (Kreatin, Whey, Koffein, Beta-Alanin, Citrullin-Malat, Vitamin D, Omega-3,
  Ashwagandha, BCAA, Testosteron-Booster, Fatburner, Glutamin) mit Wirksamkeits-Einordnung.
  End-to-end getestet: Reminder-Matching gegen echte aktuelle lokale Zeit in zwei verschiedenen
  Zeitzonen (Treffer/Fehltreffer/deaktiviert korrekt unterschieden), kein Doppel-Versand
  innerhalb derselben Minute, CRUD, Zeitformat-Validierung.
- **`/nutrition` als Tab-Seite**: Segmented-Control (`PageTabs`, generisch/wiederverwendbar)
  schaltet zwischen Rechner/Wasser/Körper/Supplements/Tipps um, aktiver Tab als URL-Query-Param
  (`?tab=…`) statt reiner Komponenten-State — direkt verlinkbar, echtes Browser-Vor-/Zurück.
  Auf Nutzerwunsch nachgerüstet, nachdem die Seite durch das Stapeln aller Karten unübersichtlich
  lang geworden war. Siehe `ARCHITECTURE.md`.
- **Körperkomposition-Tracking**: fünfter `/nutrition`-Tab ("Körper") — manuelle Waagen-Werte
  (Gewicht Pflicht, Körperfett-%/Muskelmasse/Wasseranteil optional) als Verlauf, Trend-Pfeil
  gegenüber letztem Wert, geschlechtsabhängige Körperfett-Einordnung (nur bei hinterlegtem
  Profil). Schließt die Phase-3-Lücke bei `Goal.type = BODYWEIGHT` — `currentValue` wird jetzt
  aus dem letzten erfassten Gewicht abgeleitet statt permanent `null` zu sein. End-to-end
  getestet: CRUD, Trend-Pfeile, und die Goal-Integration (neue Messung → bestehendes
  BODYWEIGHT-Ziel zeigt sofort den aktuellen Wert).
- **Design (Violett-Akzent + Space Grotesk/Manrope + eigene `ink`-Neutralpalette)**: siehe
  `ARCHITECTURE.md` — committed, siehe unten.
- **Navigation umgebaut**: feste Bottom-Nav-Leiste (fünf Tabs) ersetzt durch ein
  Hamburger-Menü oben links (`AppShell.tsx`) — auf Nutzerwunsch, schließt automatisch bei
  Navigation/Klick außerhalb/Escape, aktiver Menüpunkt weiterhin violett hervorgehoben,
  Trainingsplan-Phase weiterhin neben "Plan" sichtbar. Kein neues Datenmodell, reines
  Frontend-Layout. End-to-end per Playwright getestet: Öffnen/Schließen, Navigation aus dem Menü
  heraus, Auto-Close bei Routenwechsel und bei Klick außerhalb, kein horizontaler Overflow bei
  375px.
- **Automatische Ziel-Vorschläge**: neue "Vorschläge"-Sektion oben auf `/goals` — bis zu 5
  vorgeschlagene WEIGHT-Ziele für Übungen mit ≥ 3 geloggten Sätzen und ohne bereits offenes
  WEIGHT-Ziel dafür, Zielwert = Bestwert + 5 % (min. +1 kg, auf 0,5 kg gerundet), Zieldatum aus
  einer festen konservativen Rate (0,25 kg/Woche) statt linearer Extrapolation der eigenen
  (oft durch Anfänger-Anfangsgewinne unrealistisch optimistischen) Historie. Ein-Klick
  "Übernehmen" ruft einfach das bestehende `POST /goals` mit den Vorschlagswerten auf; der
  Vorschlag verschwindet danach automatisch aus der Liste. End-to-end getestet: Vorschlag aus 3
  geloggten Sätzen korrekt berechnet (Bestwert 65 kg → Ziel 68,5 kg, Zieldatum 14 Wochen später),
  Mindest-Satzanzahl-Filter (1 Satz erzeugt keinen Vorschlag), Ausschluss nach Annahme
  (Vorschlag verschwindet, sobald das Ziel existiert), Browser-UI (Karte, Übernehmen-Button,
  Ziel erscheint danach in der normalen Zielliste mit Fortschrittsbalken).
- **Fortschritts-Fotos**: neuer Abschnitt im "Körper"-Tab auf `/nutrition` — Upload (Kamera
  direkt via `capture="environment"` oder Dateiauswahl), Galerie mit Lösch-Funktion,
  Vorher/Nachher-Vergleich über zwei Auswahllisten. Dateien liegen auf der Platte unter
  `UPLOADS_DIR` (nie über eine öffentliche URL erreichbar, nur über eine authentifizierte
  Stream-Route), Frontend zeigt sie über authentifizierte Blob-Fetches an. Wöchentliche
  Push-Erinnerung (täglicher Scheduler-Tick, feuert ab 7 Tagen seit dem letzten Foto). End-to-end
  getestet: Upload/Abruf/Löschen per curl (inkl. Byte-für-Byte-Vergleich der hoch- und
  heruntergeladenen Datei, 401 ohne Auth, 404 bei fremder ID, Mime-Type-Ablehnung,
  Datei-Löschung von der Platte), Erinnerungs-Logik direkt gegen ein rückdatiertes Test-Foto
  verifiziert (10 Tage alt → als überfällig erkannt), Browser-UI per Playwright (Upload, Galerie
  mit echten Bildern, Vorher/Nachher-Ansicht, Löschen, kein horizontaler Overflow bei 375px).
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
- Aktiver Branch: `main`, Phasen 1–5, 8, 9, 10, 11, 12, 14 + Design (Violett/Fonts/ink-Palette)
  committed und gepusht (`dbbee42`, `dbd75cd`, `4d4de32`, `2f79f4a`, `5cf3cde`, `7b7aef7`,
  `3b07941`, `6fb2b9b`, `2b80d54`, `db44828`, `e879225`)
- Bisherige Commits: Foundation (Monorepo/Auth/Tracking-Tabelle) → Übungs-API mit Import →
  Übungsbibliothek-UI/Trainingsplan-Rotation/Ziele (Phasen 1-3) → Offline-first Trainings-Tabelle
  (Phase 4) → Push-Benachrichtigungen (Phase 5) → Profil & Ernährungsrechner (Phase 8) →
  Wasser-Tracking (Phase 9) → Tages-Challenge (Phase 14) → Supplement-Erinnerungen &
  Referenzliste + `/nutrition`-Tab-Umbau (Phase 10) → Design-Umstellung (Violett-Akzent,
  Space Grotesk/Manrope, eigene `ink`-Neutralpalette) → Körperkomposition-Tracking (Phase 11) →
  Fortschritts-Fotos (Phase 12) — Phase 13 (Automatische Ziel-Vorschläge) ist fertig, aber
  **noch nicht committed**, siehe unten. Danach sind nur noch Phase 6 (Claude-API-UI) und
  Phase 7 (Politur & VPS-Deployment) offen. **Mehrsprachigkeit** (DE/EN/ES/NL/RU)
  wurde ebenfalls angefragt, laut Nutzer aber nicht eilig ("kann warten") — noch nicht begonnen,
  keine Roadmap-Phase dafür angelegt. Größerer Umbau: praktisch jede Komponente hat aktuell
  hartcodierten deutschen Text direkt im JSX, plus mehrere Absätze Fließtext (Ernährungstipps,
  Supplement-Referenzliste, Körper-Kennzahlen-Erklärungen), wo Übersetzungsqualität besonders
  zählt — braucht i18next (oder vergleichbar) + systematische String-Extraktion über den ganzen
  Frontend-Code, kein kleiner Task.

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
GET    /goals/suggestions       # bis zu 5 vorgeschlagene WEIGHT-Ziele (siehe Phase 13)
POST   /goals                   # exerciseId Pflicht bei type WEIGHT/REPS
PATCH  /goals/:id               # targetValue/targetDate/achievedAt
DELETE /goals/:id

GET    /push/vapid-public-key   # publicKey: null, falls VAPID nicht konfiguriert
POST   /push/subscribe
DELETE /push/subscribe

GET    /profile                 # null, falls noch kein Profil angelegt
PUT    /profile                 # immer Vollersatz, inkl. bmr/tdee/targetCalories/targetProteinG

GET    /water                   # heute + Zielwert + 7-Tage-Verlauf (nullgefüllt)
POST   /water/log                # { amountMl }, positiv oder negativ, bei 0 geklemmt
PUT    /water/target             # { targetMl: number|null }, 409 falls kein Profil existiert

GET    /daily-challenge                # legt bei Bedarf 3 Zufalls-Übungen für heute an
POST   /daily-challenge/:id/reps       # { delta }, bei 0 geklemmt, kein Deckel nach oben

GET    /supplements
POST   /supplements                    # { name, reminderTime, timeZone }
PATCH  /supplements/:id                # name/reminderTime/timeZone/enabled
DELETE /supplements/:id

GET    /body-composition               # letzte 60 Messungen, neueste zuerst
POST   /body-composition               # weightKg Pflicht, Rest optional
PATCH  /body-composition/:id
DELETE /body-composition/:id

GET    /progress-photos                # Metadaten-Liste, neueste zuerst — nie Dateiname/Pfad
POST   /progress-photos                # multipart, Feld "file" (+ optional "takenAt")
GET    /progress-photos/:id/file       # authentifizierter Datei-Stream, 404 bei fremder ID
DELETE /progress-photos/:id            # löscht DB-Zeile + Datei auf der Platte
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
- `Profile` — Eingaben für den Ernährungsrechner + `waterTargetMlOverride` (siehe oben, fertig)
- `WaterLog` — Tages-Running-Total pro Nutzer (siehe oben, fertig)
- `DailyChallengeItem` — Tages-Challenge-Übungen + Fortschritt (siehe oben, fertig)
- `Supplement` — Erinnerungsliste + Zeitzone + letzter Versand (siehe oben, fertig)
- `BodyCompositionEntry` — Waagen-Messungen als Verlauf (siehe oben, fertig)
- `ProgressPhoto` — Metadaten für auf der Platte gespeicherte Vergleichsfotos (siehe oben, fertig)

## Bekannte Lücken

- **Kein Video** in der importierten Übungsbibliothek — `free-exercise-db` liefert nur Bilder,
  keine kostenlose Quelle mit Video gefunden. `videoUrl` bleibt leer bis manuell gepflegt oder
  eine neue Quelle angebunden wird.
- **Keine Frontend-UI** mehr offen außer Claude-API-Integration (Phase 6) — Backend/Datenmodell
  dafür ist vorbereitet, siehe `ROADMAP.md`. Phasen 1–5, 8, 9, 10, 11, 12, 13 und 14 sind fertig,
  siehe oben. Nur noch Phase 6 (Claude-API-UI) und Phase 7 (Politur & VPS-Deployment) offen.
- **Tages-Challenge-Übungsauswahl ist unvollständig gefiltert** — `equipment = "body only"` im
  importierten Katalog schließt nicht zuverlässig aus, dass eine Übung trotzdem eine Bank,
  Klimmzugstange o. Ä. voraussetzt. Ein Keyword-Filter auf den Namen mildert das, ist aber eine
  Heuristik, keine Garantie — kein Bug, absichtlich nicht weiter aufwendig gelöst, siehe
  `ARCHITECTURE.md`.
- **`Goal.type = CUSTOM` hat weiterhin keine berechnete Kennzahl** — bewusst ein manueller
  "Als erreicht markieren"-Toggle statt eines Absolutwerts, weil es keine passende Datenquelle
  gibt (im Gegensatz zu BODYWEIGHT, das seit Phase 11 aus `BodyCompositionEntry` abgeleitet
  wird). Kein Bug, siehe `ARCHITECTURE.md`.
- **Keine Mehrsprachigkeit** — komplette App ist hartcodiert Deutsch, keine i18n-Infrastruktur.
  Angefragt für DE/EN/ES/NL/RU, aber laut Nutzer nicht eilig, siehe oben unter "Branch & Repo".
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

## Laufende Dev-Umgebung (Stand dieser Session)

Auf Nutzerwunsch läuft aktuell ein **dauerhafter** (nicht nach der Session abgebauter)
Dev-Stack, damit die App vom eigenen Handy/Laptop im selben Netz aus geöffnet werden kann:

- Postgres via `docker run` (Name `fitnesstracker-postgres-dev`, benanntes Volume
  `fitnesstracker_dev_pgdata`, Port 5433), Backend via `tsx watch` auf Port 3001, Frontend via
  `vite --host` auf Port 5173 — erreichbar unter `http://192.168.178.20:5173` (LAN-IP dieser
  Maschine)
- `frontend/vite.config.ts` zeigt deshalb aktuell auf `http://localhost:3001` statt des
  committeten Default-Werts `3000` — **uncommitted, absichtlich**, nicht versehentlich stehen
  gelassen. Vor einem echten Commit/Push zurück auf `3000` setzen oder bewusst draufschauen,
  falls diese Abweichung stört.
- Test-Login: `test@example.com` / `testpassword123`, Übungskatalog bereits importiert
- PWA-only-Features (Installieren, Offline-Sync, Push-Subscribe) funktionieren über die
  Klartext-LAN-URL nicht — Secure-Context-Pflicht der Browser, nicht app-seitig behebbar ohne
  echtes HTTPS-Deployment (Phase 7)
- **Firewall (`ufw`)** auf dieser Maschine blockiert standardmäßig externe Verbindungen zu neu
  geöffneten Ports — der Nutzer musste `sudo ufw allow 5173/tcp` (und `3001/tcp`, `80/tcp` für
  das separate `finanzplaner`-Projekt) selbst ausführen, da kein passwortloses `sudo` verfügbar
  ist
- Nebenbei auch den `finanzplaner`-Frontend-Container (`../finanzplaner/finanzplaner`,
  `docker compose up -d --build frontend`) gebaut und gestartet, unabhängiges Projekt, Port 80

## Nächster sinnvoller Schritt

Phase 13 (Automatische Ziel-Vorschläge) ist fertig, aber **noch nicht committed** —
Arbeitsverzeichnis hat uncommitted Changes (siehe `git status`; `frontend/vite.config.ts`
weiterhin bewusst mit angepasstem Proxy-Ziel für die laufende Dev-Umgebung, siehe unten — vor
einem echten Commit auf `3000` zurücksetzen oder bewusst mitcommitten). Damit ist die gesamte
auf Nutzerwunsch angehängte Feature-Liste (Phasen 8–14) fertig — nur noch Phase 6 (Claude-API-UI)
und Phase 7 (Politur & VPS-Deployment) aus der ursprünglichen Roadmap sind offen. Mehrsprachigkeit
(DE/EN/ES/NL/RU) ist angefragt, aber explizit zurückgestellt ("kann warten") — nicht von selbst
anfangen, erst wenn der Nutzer danach fragt. Beiläufige Frage zu Play-Store/App-Store-Vertrieb
wurde nur informativ beantwortet, kein Arbeitsauftrag.

# Architektur

## Warum dieser Stack

**PostgreSQL** als Datenbank: Die Domäne ist klar relational — Nutzer, Übungen, Trainingsplan-Phasen,
Workout-Logs und Ziele hängen über Fremdschlüssel zusammen, und Abfragen wie "alle Sätze einer
Übung im aktuellen Trainingszyklus" profitieren von echten Joins und Indizes. Postgres läuft
trivial in Docker auf einem eigenen VPS, braucht keine externen Managed-Dienste und hat mit Prisma
exzellente TypeScript-Unterstützung.

**Backend: Fastify + TypeScript + Prisma.** Fastify statt NestJS, weil das Projekt von einer Person
gepflegt wird — weniger Ceremony, aber trotzdem eine saubere Plugin-Architektur für Auth/DB/JWT.
Zod validiert Requests und wird über `packages/shared` mit dem Frontend geteilt, damit Backend und
Frontend nie aus dem Tritt geraten (ein Schema, zwei Verwendungen).

**Frontend: React + TypeScript + Vite**, Tailwind CSS (mobile-first, da die App primär im Studio auf
dem Handy genutzt wird), TanStack Query fürs Server-State-Handling, React Hook Form + Zod für
Formulare, `vite-plugin-pwa` für die installierbare PWA-Hülle (Manifest, Service Worker, Icons).

**Auth**: JWT-Access-Token (15 min, im Speicher gehalten, nie in localStorage) + Refresh-Token als
httpOnly-Cookie, dessen Hash (nicht der Klartext) in der DB liegt — damit lassen sich Sessions
serverseitig widerrufen und Refresh-Token-Reuse erkennen. Registrierung ist über ein `SETUP_TOKEN`
geschützt, weil die App auf einem offen erreichbaren VPS läuft, aber nur für einen einzigen Nutzer
gedacht ist.

**Monorepo**: pnpm Workspaces (`backend/`, `frontend/`, `packages/shared/`) — ein Schema-Package
für Zod-Schemas/Typen, die beide Seiten brauchen.

**Reverse Proxy: Caddy statt Nginx** — automatisches HTTPS via Let's Encrypt aus einem 5-Zeilen
Caddyfile. Caddy dient das gebaute Frontend und proxied `/api/*` zum Backend, beides same-origin —
das eliminiert CORS in Produktion komplett, was für Cookie-basierte Auth wichtig ist.

## Übungs-Import (fertig)

Übungen von Hand pflegen skaliert nicht — stattdessen zieht ein Adapter-Mechanismus komplette
Kataloge aus externen, frei verfügbaren Quellen und schreibt sie idempotent (Upsert by
`source`+`sourceId`) in die eigene DB. Jede Quelle implementiert nur ein kleines Interface
(`backend/src/modules/exercises/sources/types.ts`):

```ts
interface ExerciseSourceAdapter {
  name: string;
  fetchExercises(): Promise<ImportedExercise[]>;
}
```

und wird in `sources/index.ts` registriert — Route und Service kennen die konkrete Quelle nicht,
sie rufen nur `POST /api/exercises/import { source: "<name>" }` auf. So lassen sich beliebig viele
weitere Quellen ("von verschiedenen Stellen gezogen") ergänzen, ohne bestehenden Code anzufassen.

**Aktuell angebundene Quelle: [free-exercise-db](https://github.com/yuhonas/free-exercise-db)**
— ein offener, gemeinfreier Datensatz (Unlicense) mit 870+ Übungen: Name, Ausführungsschritte,
Ziel-/Hilfsmuskeln, Equipment, Kategorie und Referenzbilder. Kein API-Key, kein Rate-Limit. Import
via `POST /api/exercises/import {"source":"free-exercise-db"}` dauert lokal getestet ~3 Sekunden
für den kompletten Katalog.

**Bekannte Lücke: kein Video.** Weder diese noch andere kostenlos/offen recherchierten Quellen
(z. B. wger.de, das primär Bilder liefert) stellen durchgehend Ausführungsvideos bereit. `videoUrl`
bleibt für importierte Übungen leer — entweder manuell nachpflegen (`PATCH /api/exercises/:id`)
oder eine künftige Quelle/Integration ergänzt das automatisiert.

Manuell angelegte Übungen (`POST /api/exercises`) bekommen `source: "manual"` und eine generierte
`sourceId`, damit dieselbe Upsert-Logik einheitlich für beide Fälle gilt. Löschen einer Übung ist
über eine Fremdschlüssel-Prüfung abgesichert (`409 Conflict`), solange noch Workout-Logs oder Ziele
darauf verweisen — auch weich gelöschte Logs (`deletedAt` gesetzt) zählen dabei mit, weil sie für
den künftigen Offline-Sync als Tombstones erhalten bleiben müssen.

## Übungsbibliothek-UI (fertig)

Browse-/Such-UI (`/exercises`) plus Detailansicht (`/exercises/:id`), aufbauend auf der in Phase 0
gebauten Übungs-API. Ein paar Entscheidungen, die beim Umbau von "gecappte Liste" zu "durchsuchbare
Bibliothek" getroffen wurden:

- **Pagination statt hartem 200er-Cap.** `GET /exercises` akzeptierte bisher nur `search` und
  brach nach 200 Treffern ab — für eine Bibliothek mit 870+ Einträgen wären so über zwei Drittel
  des Katalogs für die Nutzerin unsichtbar geblieben. Jetzt liefert der Endpunkt `{ items, total }`
  mit `page`/`pageSize` (Default weiterhin 200, damit das bestehende Übungs-Dropdown im
  Trainings-Log-Formular — das die volle Liste ungefiltert lädt — unverändert funktioniert); die
  Bibliotheks-UI selbst fragt bewusst kleinere Seiten (`pageSize=30`) ab und lädt per
  "Mehr laden"-Button nach (TanStack Querys `useInfiniteQuery`). Kein automatisches
  Infinite-Scroll, weil ein expliziter Button auf einer Liste mit potenziell 870 Einträgen weniger
  überraschend ist als ungewolltes Nachladen beim Scrollen.
- **Muskelgruppe/Equipment sind Freitext, kein Enum.** Beide Felder kommen aus dem
  `free-exercise-db`-Import als beliebige Strings (`primaryMuscles`/`secondaryMuscles` als Array,
  `equipment` als einzelner String) — ein festes Enum hätte bei jeder neuen Importquelle mit
  abweichender Taxonomie brechen können. Die Filter-Dropdowns bekommen ihre Optionen daher nicht
  aus einer festen Liste, sondern aus einem eigenen Endpunkt `GET /exercises/facets`, der die
  tatsächlich in der DB vorkommenden Werte dedupliziert zurückgibt (in JS, nicht per SQL
  `DISTINCT` — Postgres dedupliziert `DISTINCT` nicht auf Array-Elementen; bei ~870 Zeilen ist das
  günstig genug, um es nicht zu optimieren).
- **Muskelgruppen-Filter matcht primär ODER sekundär**, weil beim Stöbern nach z. B. "biceps" auch
  Übungen relevant sind, bei denen der Bizeps nur unterstützend beansprucht wird (z. B. Rudern).
  Mehrere Filter (Suche + Muskelgruppe + Equipment) kombinieren sich dagegen als UND — das
  entspricht dem Verhalten, das man von Browse-Filtern erwartet.
- **Detailansicht als eigene Route, kein Dialog** (anders als das Trainings-Log-Formular, das ein
  Bottom-Sheet ist) — ein "Übung öffnen" ist eine Ansicht zum Lesen/Verweilen, keine kurze
  Formulareingabe, und eine echte Route gibt der Nutzerin die native Zurück-Geste/den
  Browser-Verlauf statt eines Overlays, das weggetippt werden muss.

## Trainingsplan-Rotation (fertig)

Die 8-Wochen-Rotation (Aufbau → Muskelausdauer → Negativ → Aufbau, immer montags) läuft über
`GET /training-plan` plus einen eigenen Hintergrund-Tick, nicht rein UI-getrieben:

- **`phaseStartedOn` ist immer ein Montag** (00:00 UTC), damit "+8 Wochen" wieder exakt auf einen
  Montag fällt, ohne Wochentags-Drift über viele Rotationen hinweg. Ein neuer Plan startet daher
  am Montag der aktuellen Woche, nicht am Erstellungsdatum selbst.
- **Rotation holt beliebig viele verpasste Zyklen nach**, statt nur einmal zu prüfen — läuft der
  Server z. B. mehrere Monate nicht, schließt `rotatePhaseIfDue` beim nächsten Tick jede
  überfällige 8-Wochen-Periode einzeln als eigenen `TrainingPlanPhaseHistory`-Eintrag ab, bis die
  aktuelle Phase wieder stimmt (end-to-end getestet: 10 nachgeholte Zyklen in einem Rutsch).
- **Zwei unabhängige Auslöser statt nur "on demand"**: `GET /training-plan` rotiert lazy beim
  Abruf (damit die UI nie eine veraltete Phase zeigt), zusätzlich läuft ein Fastify-Plugin
  (`trainingPlan.scheduler.ts`) mit einem `setInterval`-Tick alle 6h + einmal beim Boot, der
  alle überfälligen Pläne rotiert — unabhängig davon, ob gerade jemand die App öffnet. Das ist
  bewusst so gebaut, weil Phase 5 (Push-Erinnerungen) an genau diesen Rotationsevent andocken
  soll ("Erinnerung bei Trainingsplan-Wechsel"); eine rein lazy Lösung hätte dafür keinen Haken.
- **`@@unique([trainingPlanId, startedOn])`** auf `TrainingPlanPhaseHistory` plus
  `skipDuplicates: true` beim Insert schützt vor doppelten Verlaufs-Einträgen, falls Scheduler-Tick
  und ein Request denselben überfälligen Zeitraum gleichzeitig rotieren — bei einer Ein-Personen-
  App ein Rand-Rand-Fall, aber ein Unique Index ist billig genug, um ihn trotzdem nicht offen zu
  lassen (gleiche Idempotenz-Idee wie bei `WorkoutLog.clientId` und `Exercise.source+sourceId`).
- Kein separater "Phase manuell wechseln"-Endpunkt — die Rotation ist bewusst rein zeitgesteuert,
  wie in der Roadmap beschrieben; ein manueller Override kann bei Bedarf später ergänzt werden.

## Ziele (fertig)

Vier Ziel-Arten über ein einzelnes `Goal`-Modell (`type: WEIGHT | REPS | BODYWEIGHT | CUSTOM`),
CRUD über `/goals`. Die interessante Design-Frage war nicht das CRUD selbst, sondern wie
"Fortschritt" pro Ziel-Art berechnet wird:

- **WEIGHT/REPS sind an eine Übung gebunden** (`exerciseId` Pflichtfeld, per Zod-`refine`
  erzwungen) und ihr Fortschritt wird **automatisch aus vorhandenen Daten hergeleitet** — der
  bisherige Bestwert (`MAX(weightKg)` bzw. `MAX(reps)`) aus den `WorkoutLog`-Einträgen zur
  selben Übung. Kein neues Datenmodell nötig, kein manuelles Nachtragen: die Trainings-Tabelle
  aus Phase 0 liefert die Zahl bereits.
- **BODYWEIGHT/CUSTOM haben keinen Ziel-Fortschritt aus vorhandenen Daten** — es gibt (bewusst)
  kein Körpergewichts-Log in diesem Datenmodell, "Ziel: 75 kg Körpergewicht" hat also nichts,
  wogegen automatisch verglichen werden könnte. Statt dafür eigens ein neues Tracking-Feature zu
  bauen (das die Roadmap nicht verlangt), ist "erreicht" für diese beiden Typen ein expliziter,
  manueller Toggle (`PATCH /goals/:id { achievedAt }`) — derselbe Endpunkt, den WEIGHT/REPS-Ziele
  ebenfalls nutzen können, falls die berechnete Zahl mal nicht ausreicht.
- **`achievedAt` wird nie automatisch gesetzt.** Auch wenn `currentValue >= targetValue` für ein
  WEIGHT/REPS-Ziel, markiert die API das Ziel nicht selbst als erreicht — die UI zeigt den
  Fortschrittsbalken nur als Signal, das "Als erreicht markieren" bleibt eine bewusste
  Nutzer-Aktion. Ein Read-Handler, der nebenbei Schreiboperationen auslöst, wäre unerwartetes
  Verhalten (anders als die Trainingsplan-Rotation, die ganz bewusst als zeitgesteuerter
  Hintergrund-Prozess und nicht als Read-Nebeneffekt gebaut ist, siehe oben).
- **Typ und Übung sind nach dem Anlegen unveränderlich** — `PATCH` erlaubt nur `targetValue`,
  `targetDate`, `achievedAt`. Ein Ziel "umzuwidmen" (andere Übung, anderer Typ) ist im Kern ein
  neues Ziel; dafür gibt es Löschen + Neuanlegen statt einer Sonderfall-Logik im Update-Pfad.

## Offline-first + Sync (fertig)

Da die App explizit auf dem iPhone als installierte PWA laufen soll, scheidet die native
Background-Sync-API des Browsers aus — sie wird von iOS Safari nicht (zuverlässig) unterstützt.
Stattdessen: IndexedDB via Dexie.js als lokaler Store (`frontend/src/offline/db.ts`), ein eigener
Sync-Manager (`frontend/src/offline/workoutLogSync.ts`) beobachtet `online`/`offline`-Events und
flusht die Mutations-Queue, sobald wieder eine Verbindung besteht.

**Nur die Trainings-Tabelle ist offline-fähig**, nicht Übungsbibliothek/Plan/Ziele — das deckt den
eigentlichen Anwendungsfall ("Satz protokollieren, während im Kraftraum kein Empfang ist") ohne
den Umfang auf Daten auszuweiten, die primär zu Hause mit Verbindung durchsucht/gepflegt werden.

- **`clientId` statt `id` als stabile lokale Identität.** Eine offline angelegte Zeile hat noch
  keine Server-`id` (die vergibt Postgres erst beim ersten erfolgreichen `POST`) — trotzdem muss
  sie sofort bearbeitbar/löschbar sein. Der lokale Cache nutzt daher durchgehend `clientId` als
  Schlüssel (`id: string | null` bis zur Sync), und `PATCH`/`DELETE /workout-logs/:id` akzeptieren
  jetzt zusätzlich die `clientId` als Identifier (`findOwnedWorkoutLog` in
  `workoutLog.service.ts`) — eine kleine, gezielte Backend-Änderung, ohne die schon
  idempotent-by-`clientId` gebaute `POST`-Route anzufassen.
- **Mutations-Queue statt Direktschreiben**, mit Koaleszenz pro `clientId`: mehrere Edits an einer
  noch nicht synchronisierten Zeile verschmelzen zu einer Mutation mit den aktuellsten Werten,
  statt jeden Zwischenstand einzeln nachzuspielen (end-to-end verifiziert: Anlegen + Bearbeiten
  offline blieb bei einer ausstehenden Mutation, der Server sah nie den Zwischenwert). Ein
  `delete` auf eine Zeile mit noch nicht synchronisiertem `create` verwirft die Mutation komplett
  — dem Server gibt es nichts mitzuteilen.
- **Cache-then-network beim Lesen**: `fetchAndCacheWorkoutLogs` versucht zuerst das Netzwerk,
  merged das Ergebnis in den Dexie-Cache (außer für Zeilen mit noch ausstehender lokaler Mutation
  — die würde ein Hintergrund-Refresh sonst mit veralteten Serverdaten überschreiben) und liest
  danach immer aus dem Cache. Offline heißt hier einfach: der Netzwerk-Schritt schlägt fehl, der
  Rest der Funktion läuft unverändert weiter.
- **Zwei Stolperfallen, die erst beim echten Offline-Testen auffielen** (nicht beim Typecheck):
  - TanStack Query pausiert Mutations standardmäßig komplett, solange der Browser offline ist
    (`networkMode: "online"`), statt `mutationFn` überhaupt aufzurufen — obwohl die eigenen
    Mutation-Funktionen rein lokale Dexie-Schreibvorgänge sind und dafür keine Netzwerkverbindung
    brauchen. Ohne `networkMode: "always"` auf den Workout-Log-Hooks wäre "offline einen Satz
    speichern" wortwörtlich nie ausgeführt worden — kein Fehler, einfach stillschweigend nie
    passiert.
  - Ein `onSuccess: () => queryClient.invalidateQueries(...)` nach einer Mutation lässt
    `mutateAsync` auf den (bei fehlendem Netz erfolglosen) Refetch warten, bevor es sich auflöst
    — der Speichern-Dialog wäre offline hängengeblieben, statt sofort zu schließen. Der Fix:
    Mutations aktualisieren den Query-Cache direkt aus dem lokalen Dexie-Stand
    (`queryClient.setQueryData`, nie ein Refetch), sowohl direkt nach einer lokalen Änderung als
    auch nach jedem Sync-Schritt im Hintergrund-Flush — dafür ist der `QueryClient` jetzt ein
    Singleton-Modul (`frontend/src/queryClient.ts`) statt in `main.tsx` erzeugt, damit auch der
    `online`-Event-Handler außerhalb von React darauf zugreifen kann.

## Push-Benachrichtigungen (fertig)

Web Push mit VAPID-Keys — funktioniert auf iOS 16.4+ bei zum Homescreen hinzugefügten PWAs. Der
Trainingsplan-Scheduler aus Phase 2 löst beim Rotieren einer überfälligen Phase eine
Push-Benachrichtigung aus ("Trainingsplan-Wechsel: Neue Phase: Muskelausdauer").

- **Push bleibt komplett inert ohne konfiguriertes VAPID-Schlüsselpaar** (`VAPID_PUBLIC_KEY` /
  `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`) — gleiches Muster wie `CLAUDE_API_KEY`: kein
  Boot-Fehler, `GET /push/vapid-public-key` liefert einfach `publicKey: null`, das Frontend zeigt
  dann "Server hat noch keinen VAPID-Schlüssel konfiguriert" statt eines kaputten Buttons.
- **Nur der Hintergrund-Tick löst die Push aus, nicht das lazy Rotieren** beim Öffnen von
  `/plan` (`rotateAllDuePlans` vs. `getCurrentTrainingPlan`, siehe Trainingsplan-Abschnitt oben)
  — eine Push für einen Phasenwechsel, den man gerade selbst durch Öffnen der Seite ausgelöst
  hat, wäre eine sinnlose Benachrichtigung über etwas, das man schon sieht.
- **Abgelaufene Subscriptions werden automatisch entfernt**: schlägt `webpush.sendNotification`
  mit 404/410 fehl (der Push-Service kennt den Endpoint nicht mehr — z. B. Browser-Neuinstallation
  oder abgelaufene Registrierung), wird die `PushSubscription`-Zeile gelöscht statt bei jedem
  künftigen Rotationsevent erneut erfolglos zugestellt zu werden. End-to-end verifiziert: eine
  absichtlich ungültige Subscription wurde beim Zustellversuch korrekt aus der DB entfernt (der
  Zustellversuch selbst ging als echter HTTPS-Request an Googles FCM-Infrastruktur raus).
- **Service Worker um `push`/`notificationclick` erweitert, ohne die Cache-Strategie
  anzufassen**: `vite-plugin-pwa`s `generateSW`-Modus (aktuell verwendet) bietet keinen Hook für
  eigene Event-Listener im generierten Service Worker. Umstieg auf `injectManifest` hätte bedeutet,
  die komplette Precache-Registrierung und die bestehende `NetworkOnly`-Regel für `/api/**` von
  Hand nachzubauen — stattdessen lädt der generierte SW eine eigene, reine JS-Datei
  (`frontend/public/push-sw.js`) per Workbox-Option `importScripts` nach; Vite kopiert sie
  unverändert ins Build-Output, keine TypeScript-/Bundling-Pipeline nötig für dieses eine File.
- **`pushManager.subscribe()` ließ sich in dieser Sandbox nicht live verifizieren** — Chromium
  meldet `AbortError: Registration failed - push service not available`, weil kein echter
  Push-Dienst (Google FCM) für die Browser-seitige Registrierung erreichbar ist. Das ist eine
  Umgebungs-Einschränkung des Testcontainers, keine Einschränkung der App: `Notification.
  requestPermission()`, die VAPID-Key-Konvertierung und der Request an `pushManager.subscribe()`
  laufen nachweislich korrekt (isoliert getestet), nur die Registrierung beim echten Push-Dienst
  kann headless/ohne Netzwerkzugriff auf Google-Infrastruktur nicht abgeschlossen werden. Auf
  einem echten Gerät/Browser mit Internetzugang betrifft das nicht.

## Profil & Ernährungsrechner (fertig)

Kalorien-/Proteinbedarf nach Mifflin-St-Jeor, `GET`/`PUT /profile`.

- **Berechnete Werte werden nie gespeichert**, nur die Eingaben (Gewicht/Größe/Alter/Geschlecht/
  Aktivitätslevel/Ziel). `bmr`/`tdee`/`targetCalories`/`targetProteinG` sind reine Funktionen
  dieser Felder und werden bei jedem `GET` neu berechnet (`calculateNutrition` in
  `profile.service.ts`) — dieselbe Überlegung wie bei der Trainingsplan-Rotation: lieber einmal
  mehr rechnen als eine gespeicherte Zahl riskieren, die nach einer Bearbeitung nicht mehr zu den
  Eingaben passt.
- **`PUT` statt `PATCH`**, weil die Felder nur zusammen einen Sinn ergeben — "nur das Gewicht
  aktualisieren" ist im Kern trotzdem ein vollständiges neues Profil, kein Teil-Update wie bei
  `Goal.targetValue`.
- **Mifflin-St-Jeor statt Harris-Benedict**, weil die neuere Formel in modernen Validierungsstudien
  über einen breiteren BMI-Bereich hinweg zuverlässiger ist. Aktivitätsmultiplikatoren und die
  Kalorien-/Protein-Anpassung pro Ziel (Abnehmen/Halten/Aufbauen) sind bewusst konservative
  Literatur-Standardwerte (z. B. ~500 kcal Defizit fürs Abnehmen, kein aggressiveres "Fortgeschritten"-
  Preset) — mehr Personalisierung würde hier vor allem mehr Fehlerquellen bedeuten, nicht mehr
  Nutzen.
- **Ernährungstipps sind eine statische, kuratierte Liste** (`frontend/src/data/nutritionTips.ts`),
  kein Aufruf einer externen API oder der (noch deaktivierten) Claude-Integration — ehrlicher über
  das, was es ist (feste Auswahl, keine Personalisierung), als ein API-Call vorzutäuschen, der
  keine zusätzliche Frische/Individualisierung liefern würde. Gleiche Überlegung soll für die
  Supplement-Referenzliste aus Phase 10 gelten.

## Wasser-Tracking (fertig)

Täglicher Zähler + kurzer Verlauf, als Karte auf der bestehenden `/nutrition`-Seite statt eines
eigenen Bottom-Nav-Tabs.

- **Bottom-Nav bleibt bewusst bei fünf Einträgen gedeckelt.** Jede weitere Roadmap-Phase (9-13:
  Wasser, Supplements, Körperkomposition, Fortschritts-Fotos, …) würde sonst einen eigenen Tab
  beanspruchen — bei einem 375px-Bildschirm und fünf Tabs ist mit `text-xs` gerade noch Luft,
  ein sechster/siebter Tab ginge zulasten der Lesbarkeit oder würde Zoom-out erzwingen, genau das
  Gegenteil von der beim Mobile-Layout verfolgten Linie (siehe "Bekannte Stolperfallen"). Neue,
  thematisch verwandte Mini-Features werden stattdessen als Karte in eine bestehende, passende
  Seite genestet — hier: wassernah zur Ernährung.
- **Tagesziel-Override lebt auf `Profile`, nicht in einer eigenen Tabelle.** Eine eigene
  `WaterSettings`-Tabelle nur für ein nullable Int hätte mehr Modell-Overhead erzeugt, als es
  wert ist; die Kehrseite ist, dass ein eigenes Wasserziel ohne bestehendes Ernährungsprofil
  nicht gesetzt werden kann (`409 Conflict`, klar kommuniziert), weil sich sonst die
  Pflichtfelder von `Profile` (Gewicht/Größe/Alter/Geschlecht) mit Platzhaltern hätten befüllen
  lassen müssen, nur um das Override-Feld unterzubringen — ein schlechterer Trade als die
  Einschränkung.
- **`WaterLog` ist ein Tages-Running-Total, kein Event-Log.** Eine Zeile pro Nutzer und
  Kalendertag (UTC), pro Antippen per `upsert` erhöht/verringert, statt einer Zeile pro Tipp —
  nichts in der Roadmap braucht Zeitpunkte einzelner Schlucke, nur "wie viel heute" und ein
  kurzer Tagesverlauf. Undo (`-250 ml`) klemmt bei 0, statt einen negativen Tageswert zuzulassen.
- **Verlauf wird immer nullgefüllt zurückgegeben** (`getHistory` in `water.service.ts`) — exakt
  `days` Einträge, auch für Tage ohne geloggtes Wasser, damit die Verlaufsansicht nie Lücken hat.

## Claude-API-Integration (Roadmap-Phase)

Für effiziente Übungsauswahl und Zielsetzung, hinter dem Flag `CLAUDE_API_ENABLED` — bleibt
deaktiviert, bis ein API-Key hinterlegt ist, blockiert also nicht den Rest der Roadmap.

## Datenmodell

Siehe [`backend/prisma/schema.prisma`](./backend/prisma/schema.prisma). Bereits vollständig
angelegt (auch für Modelle ohne UI in dieser Phase), damit spätere Phasen additiv bleiben und keine
Breaking-Migrationen nötig werden:

- `User`, `RefreshToken` — Auth
- `Exercise` — Name, Beschreibung, Video-/Bild-URLs, Equipment, Muskelgruppen, `source`/`sourceId`
  für idempotenten Import (Bibliotheks-UI mit Detailansicht: siehe oben, fertig)
- `WorkoutLog` — Satz/Wiederholungen/Gewicht/Übung, `clientId` für Offline-Idempotenz, Soft-Delete
- `TrainingPlan` + `TrainingPlanPhaseHistory` — 8-Wochen-Rotation (siehe oben, fertig)
- `Goal` — Zielsetzung (siehe oben, fertig)
- `PushSubscription` — Web-Push-Abos (siehe oben, fertig)
- `Profile` — Eingaben für den Ernährungsrechner (siehe oben, fertig)

## Bekannte Stolperfallen (bereits berücksichtigt)

- Fastify-Plugin-Reihenfolge: Prisma/JWT/Cookie-Plugins sind mit `fastify-plugin` (`fp()`)
  gewrappt, damit ihre Decorations nicht durch Fastifys Encapsulation verloren gehen.
- Prisma `Decimal` wird vor der JSON-Antwort explizit in `Number` konvertiert
  (`workoutLog.types.ts`), sonst serialisiert es sich nicht sauber.
- `POST /workout-logs` ist ein `upsert` by `clientId`, kein `create` — ein wiederholter Submit
  (heute genutzt von der Offline-Sync-Queue, siehe oben) gibt den bestehenden Datensatz mit `200`
  zurück statt einen Unique-Constraint-Fehler zu werfen.
- Der Service Worker cached API-Antworten nie (`NetworkOnly` für `/api/**`), damit nach einem
  Deploy niemand einen veralteten Workout-Log aus dem Cache sieht.
- iOS Safari kennt kein `beforeinstallprompt` — jede zukünftige "Installieren"-UI muss die manuelle
  Share-→-Zum-Home-Bildschirm-Anleitung zeigen, kein Chrome-Style-Install-Button.
- **Layout passt sich per Design an die Telefonbreite an, statt Zoom-out zu erzwingen.**
  `index.html` setzt `width=device-width, initial-scale=1` (plus `viewport-fit=cover` für die
  iPhone-Notch), und jede Ansicht ist mobile-first mit Tailwind gebaut: Inhalte, die nicht passen,
  brechen innerhalb ihrer Zelle um oder scrollen vertikal (natürlicher Dokument-Scroll, keine
  fixen Höhen) statt horizontal zu überlaufen. Über alle Hauptseiten inkl. Trainings-Tabelle mit
  echten Daten bei 375px Breite (iPhone SE, die schmalste gängige Breite) und `deviceScaleFactor:
  3` verifiziert: `document.documentElement.scrollWidth` überschreitet nirgends `clientWidth`.

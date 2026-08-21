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

**Design**: Akzentfarbe Violett (Tailwind `violet-*`, ersetzt das ursprüngliche `sky-*`), eigene
`ink-*`-Neutralpalette statt Tailwinds `slate-*` als Hintergrund/Rahmen-Farbe — dieselben
Helligkeitsstufen wie `slate` (50-950), aber mit violettem statt blaugrauem Farbton (HSL-Basis
260° statt ~215°, siehe `tailwind.config.js`). Ein eigener, zur Akzentfarbe passender
Neutralton wurde bewusst einer weiteren Standard-Graupalette (`zinc`/`neutral`/`stone`)
vorgezogen — sonst bleibt es "Standard-Grau + farbiger Akzent", das generische
Template-Muster, nur mit anderer Akzentfarbe. `Space Grotesk` für Überschriften (`h1`-`h3`) +
`Manrope` für Fließtext statt System-Sans überall — beide via Google Fonts in `index.html`
eingebunden, `fontFamily.sans`/`fontFamily.heading` in `tailwind.config.js`. PWA-Manifest-Farben
(`theme_color`/`background_color`) und der `theme-color`-Meta-Tag sind auf denselben Ton
(`#1a1622`, `ink-900`) abgestimmt. Bewusste Abkehr vom "generischen AI-Dashboard-Look"
(Slate/Blau/Inter-Kombination), auf Nutzerwunsch.

**Auth**: JWT-Access-Token (15 min, im Speicher gehalten, nie in localStorage) + Refresh-Token als
httpOnly-Cookie, dessen Hash (nicht der Klartext) in der DB liegt — damit lassen sich Sessions
serverseitig widerrufen und Refresh-Token-Reuse erkennen. Registrierung ist über ein `SETUP_TOKEN`
geschützt, weil die App auf einem offen erreichbaren VPS läuft, aber nur für einen einzigen Nutzer
gedacht ist.

**Monorepo**: pnpm Workspaces (`backend/`, `frontend/`, `packages/shared/`) — ein Schema-Package
für Zod-Schemas/Typen, die beide Seiten brauchen.

**Reverse Proxy: Caddy statt Nginx** — dient das gebaute Frontend und proxied `/api/*` zum
Backend, beides same-origin, was CORS in Produktion komplett eliminiert (wichtig für
Cookie-basierte Auth). Läuft seit dem Mini-PC-Deployment (Phase 7, siehe unten) rein intern auf
`:80` ohne eigenes ACME/HTTPS — TLS terminiert bei Cloudflare, nicht bei Caddy, siehe
"Mini-PC-Deployment" weiter unten.

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

## Automatische Ziel-Vorschläge (fertig)

Erweitert die Ziele-Funktion um `GET /goals/suggestions` — bis zu 5 vorgeschlagene WEIGHT-Ziele
für Übungen, die der Nutzer tatsächlich trainiert.

- **Feste konservative Progressionsrate statt linearer Extrapolation der eigenen Historie.** Die
  naheliegendste Herangehensweise wäre, die Steigerungsrate aus den eigenen `WorkoutLog`-Daten
  zu berechnen (Regression über die bisherigen Bestwerte) und linear fortzuschreiben. Das wurde
  bewusst verworfen: die ersten Wochen/Monate beim Krafttraining zeigen typischerweise
  "Anfänger-Anfangsgewinne" (schnelle Steigerungen, die sich nicht halten lassen) — eine lineare
  Extrapolation davon würde ein unrealistisch nahes Zieldatum vorschlagen und damit genau das
  Problem erzeugen, das die Roadmap explizit vermeiden wollte ("Deadline darf nicht unmöglich
  sein"). Stattdessen: eine feste, literaturüblich konservative Rate von 0,25 kg/Woche
  (≈ 1 kg/Monat) für alle Übungen — einfacher als eine Übungskategorie-spezifische Modellierung
  (Grundübung vs. Isolationsübung), aber sicher auf der vorsichtigen Seite, ähnlich wie die
  bewusst einfachen Formeln bei Mifflin-St-Jeor (BMR) oder dem 35-ml/kg-Wasserziel an anderer
  Stelle in dieser App.
- **Mindestens 3 geloggte Sätze pro Übung, bevor überhaupt ein Vorschlag entsteht.** Ein einzelner
  ungewöhnlich schwerer (oder leichter) Satz sollte nicht die Grundlage für ein automatisch
  generiertes Ziel sein — ohne dieses Minimum würde ein einmaliger Testversuch mit hohem Gewicht
  sofort einen (falsch) sehr ambitionierten Vorschlag erzeugen.
- **Bereits offene WEIGHT-Ziele für dieselbe Übung schließen einen Vorschlag aus**, um Dopplungen
  zu vermeiden — sonst würde derselbe Vorschlag jedes Mal neu erscheinen, obwohl der Nutzer
  bereits ein Ziel dafür gesetzt hat.
- **Kein eigener "Vorschlag annehmen"-Endpunkt und kein Tracking, welche Vorschläge schon gezeigt
  wurden.** Ein Vorschlag ist reine, zustandslos berechnete Anzeige-Information; "annehmen"
  bedeutet einfach, die vorgeschlagenen Werte an das bestehende `POST /goals` zu schicken — genau
  wie ein manuell eingetragenes Ziel. Der Vorschlag verschwindet danach von selbst aus der Liste,
  weil jetzt ein offenes WEIGHT-Ziel für diese Übung existiert (siehe Punkt oben) — kein
  Extra-Zustand nötig, den man sonst mit dem echten Ziel synchron halten müsste.

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

- **Bottom-Nav blieb bewusst bei fünf Einträgen gedeckelt** (historische Entscheidung — die
  Bottom-Nav selbst wurde später durch ein Hamburger-Menü ersetzt, siehe
  "Navigation: Hamburger-Menü statt Bottom-Nav" weiter unten; die hier getroffene
  Karten-statt-Tab-Strukturentscheidung gilt aber unverändert weiter). Jede weitere Roadmap-Phase
  (9-13: Wasser, Supplements, Körperkomposition, Fortschritts-Fotos, …) hätte sonst einen eigenen
  Tab beansprucht — bei einem 375px-Bildschirm und fünf Tabs war mit `text-xs` gerade noch Luft,
  ein sechster/siebter Tab wäre zulasten der Lesbarkeit gegangen oder hätte Zoom-out erzwungen,
  genau das Gegenteil von der beim Mobile-Layout verfolgten Linie (siehe "Bekannte
  Stolperfallen"). Neue, thematisch verwandte Mini-Features wurden stattdessen als Karte in eine
  bestehende, passende Seite genestet — hier: wassernah zur Ernährung.
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

## Tages-Challenge (fertig)

Ein tägliches Mini-Workout aus 3 zufälligen Bodyweight-Übungen ("Liegestütze 0/20"), als Karte
auf der Trainings-Log-Seite (`/`).

- **Keine neue Übungs-Datenquelle** — die Auswahl kommt aus dem bereits importierten
  `Exercise`-Katalog (`equipment = "body only"`, `category IN (strength, plyometrics)`), nicht
  aus einer eigenen statischen Liste. Das bedeutet: mehr Auswahl (der aktuelle Katalog liefert
  ~88 passende Übungen) und jede Challenge-Übung verlinkt auf ihre echte Detailseite
  (`/exercises/:id`) mit Bild und Ausführungsbeschreibung — ein Nebeneffekt der Wiederverwendung,
  kein Zusatzaufwand.
- **Zufälligkeit passiert genau einmal pro Tag, nicht bei jedem Lesen.** `GET /daily-challenge`
  legt beim ersten Aufruf des Tages 3 Übungen mit Zufalls-Zielwerten (10/15/20/25 Wdh.) an;
  jeder weitere Aufruf am selben Tag liefert exakt dieselbe Auswahl zurück (`@@unique([userId,
  date, exerciseId])` verhindert ohnehin Duplikate). Ohne das würde ein Seiten-Reload eine neue
  Challenge auswürfeln und den bisherigen Fortschritt praktisch verwerfen.
- **`equipment = "body only"` ist unvollständig als "wirklich überall, ohne Geräte"-Filter** —
  einige so getaggte Übungen im importierten Katalog setzen trotzdem eine Bank, eine
  Klimmzugstange oder Ähnliches voraus (z. B. "Bench Dips", "Hanging Pike"). Ein
  Keyword-Filter auf den Übungsnamen (bench/hanging/wall/chair/box/step/dip) reduziert das
  spürbar, ist aber ausdrücklich eine Bestenfalls-Heuristik, keine Garantie — eine
  vollständige Lösung bräuchte eine manuell kuratierte Teilmenge oder ein eigenes
  "wirklich geräte-frei"-Flag im Datenmodell, was für den Nutzen in dieser Phase nicht
  gerechtfertigt war.
- **Kein Deckel nach oben beim Wiederholungszähler** — mehr als das Tagesziel zu schaffen ist ein
  gutes Ergebnis, kein Fehlerfall, im Gegensatz zum Klemmen bei 0 nach unten (ein zu großzügiges
  Undo soll nicht in einen negativen Wert laufen).

## Supplement-Erinnerungen & Referenzliste (fertig)

Eigene Supplement-Liste mit täglicher Push-Erinnerung zur eingestellten Uhrzeit, plus eine
statische Referenzliste — beides als Karten auf `/nutrition`.

- **Erinnerungs-Uhrzeit ist lokale Wanduhrzeit, nicht UTC — das ist die zentrale
  Design-Entscheidung dieser Phase.** Alle anderen Tages-Grenzen in dieser App (Wasser-Reset,
  Trainingsplan-Rotation) laufen in UTC, weil eine Verschiebung um ein paar Stunden dort niemand
  bemerkt. Eine Supplement-Erinnerung, die zur falschen Stunde ankommt, wäre dagegen ein
  offensichtlicher, störender Bug — das Feature existiert ja gerade, damit man es nicht vergisst,
  zu einer bestimmten Uhrzeit. Deshalb erfasst das Frontend beim Anlegen
  `Intl.DateTimeFormat().resolvedOptions().timeZone` (die IANA-Zeitzone des Browsers, z. B.
  `"Europe/Berlin"`) und speichert sie zusammen mit `reminderTime` ("HH:MM" in dieser Zeitzone).
- **Der Scheduler-Tick vergleicht rein über `Intl.DateTimeFormat`**, ohne
  Zeitzonen-Bibliothek (`getLocalDateAndTime` in `supplement.service.ts`) — Node bringt
  IANA-Zeitzonen-Unterstützung bereits eingebaut mit, eine zusätzliche Abhängigkeit wie
  `date-fns-tz` wäre für "formatiere `Date` als lokale Uhrzeit in Zeitzone X" unnötig gewesen.
  End-to-end verifiziert: eine Erinnerung, deren `reminderTime` exakt der aktuellen lokalen Zeit
  in `Europe/Berlin` entsprach, feuerte; eine zweite mit `Asia/Tokyo` und bewusst abweichender
  Zeit feuerte nicht; eine deaktivierte mit sonst treffender Zeit feuerte ebenfalls nicht; ein
  zweiter Tick in derselben Minute löste keinen Doppel-Versand aus.
- **Tick-Intervall 1 Minute statt der 6 Stunden beim Trainingsplan-Scheduler** — dort reicht
  gröbere Auflösung, weil Rotationen nur alle 8 Wochen fällig werden und ein paar Stunden Verzug
  irrelevant sind; eine Uhrzeit-genaue Erinnerung braucht dagegen minutengenaue Prüfung. Für eine
  Ein-Personen-App ist ein Tick pro Minute ressourcenmäßig vernachlässigbar.
- **`lastRemindedOn` ist ein String ("YYYY-MM-DD" in der lokalen Zeitzone), kein `DateTime
  @db.Date`** — direkter String-Vergleich mit dem Ergebnis von `Intl.DateTimeFormat` spart eine
  Hin- und Rück-Konvertierung zwischen Date-Objekt und Zeitzonen-lokalem Kalendertag, ohne
  Informationsverlust, weil dieses Feld ausschließlich für den Gleichheitsvergleich "schon heute
  erinnert?" gebraucht wird, nie für Sortierung oder Arithmetik.
- **Supplement-Referenzliste ist statisch, kein Live-Scraping** — dieselbe Begründung wie die
  Ernährungstipps aus Phase 8: eine ehrliche feste Liste ist besser als ein API-Call, der keine
  echte Aktualität oder Personalisierung liefern würde.

### `/nutrition` als Tab-Seite statt einer langen Karten-Kette

Mit Profil-Rechner, Wasser, Supplements und Tipps/Referenz auf einer Seite gestapelt wurde
`/nutrition` unangenehm lang zu scrollen — vier unabhängige Karten, von denen zu jedem Zeitpunkt
meist nur eine tatsächlich interessiert. Statt einer fünften Karte oder eines weiteren
Bottom-Nav-Tabs (der Cap bei fünf Einträgen galt zu diesem Zeitpunkt noch, siehe
Wasser-Tracking-Abschnitt oben) gibt es jetzt eine Segmented-Control (`PageTabs`, `components/layout/PageTabs.tsx`) direkt
unter der Überschrift, die zwischen den (mittlerweile fünf) Bereichen umschaltet — nur ein Abschnitt ist
gleichzeitig sichtbar.

- **Der aktive Tab ist ein URL-Query-Param (`?tab=wasser`), keine reine Komponenten-State** —
  damit ist jeder Abschnitt direkt verlinkbar (z. B. könnte eine künftige Supplement-Push-Notification
  direkt auf `/nutrition?tab=supplements` verweisen statt nur auf `/nutrition`) und
  Browser-Vor-/Zurück wechselt zwischen Tabs statt zwischen Seiten.
- **`PageTabs` ist bewusst generisch gehalten** (Tab-Liste + aktiver Key + Change-Handler als
  Props), nicht `/nutrition`-spezifisch — falls eine andere Seite künftig ähnlich viele
  unabhängige Karten ansammelt, lässt sich dasselbe Muster ohne Kopieren wiederverwenden.

## Körperkomposition-Tracking (fertig)

Manuelle Waagen-Werte über Zeit, als fünfter Tab auf `/nutrition`.

- **Kein Upsert-by-Day wie bei `WaterLog`** — `BodyCompositionEntry` ist ein reiner Log
  (`POST` legt immer eine neue Zeile an), weil eine Waagen-Messung kein Tages-Running-Total ist:
  man wiegt sich mal mehrmals am Tag, mal wochenlang gar nicht.
- **Schließt die in Phase 3 dokumentierte Lücke bei `Goal.type = BODYWEIGHT`.** Der
  Architektur-Hinweis aus Phase 3 begründete das fehlende `currentValue` explizit damit, dass es
  "kein Körpergewichts-Log in diesem Datenmodell" gibt — das stimmt seit dieser Phase nicht mehr,
  also nutzt `computeCurrentValue` in `goal.service.ts` jetzt den jeweils letzten erfassten Wert
  aus `BodyCompositionEntry` für BODYWEIGHT-Ziele.
- **Körperfett-Einordnung ist geschlechtsabhängig und nur bei hinterlegtem Profil sichtbar** —
  die üblichen Fitness-Kategorien (z. B. ACE) unterscheiden sich deutlich zwischen Männern und
  Frauen; ohne bekanntes Geschlecht lieber gar keine Kategorie zeigen als eine zu raten.
- **Kein automatischer Scale-Import** — siehe Begründung in `ROADMAP.md` Phase 11 (Dateiformate
  variieren stark zwischen Herstellern; ein Adapter für ein konkretes Gerät kann bei Bedarf
  später nach dem `ExerciseSourceAdapter`-Muster aus Phase 0 ergänzt werden).

## Fortschritts-Fotos (fertig)

Private "Spiegel-Fotos" zum Vorher/Nachher-Vergleich, als eigener Abschnitt im "Körper"-Tab auf
`/nutrition`, neben `BodyCompositionCard`.

- **Speicherung auf dem eigenen VPS-Dateisystem statt Cloud-Storage** — die Roadmap schließt
  explizit externe Managed-Dienste aus (siehe "Warum dieser Stack" oben); `@fastify/multipart`
  nimmt den Upload entgegen, die Datei landet unter `UPLOADS_DIR` (Default `./uploads`, relativ
  zum Backend-Package-cwd — konsistent mit jedem anderen relativen Pfad in diesem Projekt, z. B.
  den Prisma-Migrations-Pfaden) mit einem generierten UUID-Dateinamen statt dem
  Original-Dateinamen. In Produktion braucht das ein eigenes benanntes Docker-Volume
  (`uploads:/app/backend/uploads` in `docker-compose.prod.yml`), da der Prod-Container — anders
  als der Dev-Container — das Repo nicht bindmountet; ohne dieses Volume würden Fotos bei jedem
  Deploy verloren gehen, genau wie `pgdata` für Postgres.
- **Authentifizierte Serving-Route statt öffentlichem Static-Verzeichnis.** `GET
  /progress-photos/:id/file` prüft Eigentümerschaft vor dem Streamen (404 statt 403 bei fremder
  ID, um nicht zu verraten, dass die ID überhaupt existiert) — ein `express.static`-artiger
  öffentlicher Pfad wäre hier falsch, weil jeder mit der URL sonst private Körperfotos sehen
  könnte. Das DTO (`ProgressPhotoDto`) enthält deshalb auch nie den Dateinamen oder Pfad, nur
  `id` + `takenAt`.
- **Frontend braucht authentifizierte Blob-Fetches statt `<img src="/api/...">`.** Ein normales
  `<img>`-Tag kann keinen `Authorization`-Header mitschicken; `ProgressPhotoImage.tsx` holt das
  Bild stattdessen über eine neue `apiFetchBlob()`-Funktion in `client.ts` und zeigt es via
  `URL.createObjectURL()` an, mit Revoke beim Unmount/ID-Wechsel gegen Object-URL-Leaks. Der
  Upload selbst läuft über eine ebenfalls neue `apiUpload()`-Funktion (FormData-Body statt
  JSON, kein `Content-Type`-Header von Hand gesetzt, damit der Browser die Multipart-Boundary
  korrekt setzt) — beide neuen Funktionen teilen sich denselben 401-Refresh-Retry wie `apiFetch`.
- **Erinnerungs-Kadenz aus dem neuesten Foto abgeleitet, kein eigenes Tracking-Feld.** Der
  tägliche Scheduler-Tick (`progressPhoto.scheduler.ts`, nach dem Muster aus
  `supplement.scheduler.ts`) vergleicht für jeden Nutzer `takenAt` des neuesten Fotos (oder
  `User.createdAt`, falls noch keins existiert) gegen "≥ 7 Tage her". Bewusst kein
  `lastRemindedOn`-Feld wie bei Supplements: einmal überfällig, wiederholt sich die Erinnerung
  an jedem weiteren Tag bis zum nächsten Upload — für eine wöchentliche Kadenz reicht das, im
  Gegensatz zur exakten Einmal-pro-Tag-Anforderung eines Supplement-Reminders zu einer festen
  Uhrzeit.

## Navigation: Hamburger-Menü statt Bottom-Nav (fertig)

Die feste Bottom-Nav-Leiste (fünf Tabs, siehe historische Begründung im
Wasser-Tracking-Abschnitt oben) wurde durch ein Hamburger-Menü oben links ersetzt, auf
Nutzerwunsch ("warum sind die Kapitel unten? setze diese nach oben oder in ein
Drei-Strich-Dropdown").

- **Drei-Strich-Dropdown statt fester Tab-Leiste oben** — dem Nutzer explizit als Alternative
  zur Wahl gestellt (siehe Frage/Antwort in der Session); ein Dropdown hält den Header schlank
  und gibt der eigentlichen Seite mehr vertikalen Platz, eine feste horizontale Tab-Leiste hätte
  auf 375px-Breite mit fünf Labels erneut denselben Platzdruck erzeugt, der ursprünglich zum
  Fünf-Tabs-Cap der alten Bottom-Nav geführt hatte.
- **Der historische "Bottom-Nav bleibt bei fünf Einträgen gedeckelt"-Grund (siehe
  Wasser-Tracking-Abschnitt) gilt mechanisch nicht mehr** — ein Dropdown-Menü hat kein
  Breiten-Problem bei mehr Einträgen. Die bereits getroffenen Entscheidungen, Wasser/Supplements/
  Körperkomposition/Fortschritts-Fotos als Karten bzw. `/nutrition`-Tabs statt eigener
  Top-Level-Seiten zu bauen, wurden trotzdem **nicht** rückgängig gemacht: die inhaltliche
  Bündelung ("alles rund um Ernährung an einem Ort") ist weiterhin die bessere Informations­
  architektur, unabhängig vom Platzargument, das sie ursprünglich mit ausgelöst hat.
  `PageTabs` innerhalb von `/nutrition` bleibt unverändert bestehen.
- **Menü schließt automatisch bei Navigation, Klick außerhalb und Escape** — kein Zustand, den
  man sonst versehentlich offen stehen lassen könnte; State lebt lokal in `AppShell.tsx`
  (`useState` + ein `mousedown`-Listener auf `document`), kein globaler Store nötig für ein rein
  UI-lokales offen/geschlossen.
- **Der aktive Menüpunkt wird weiterhin hervorgehoben** (`NavLink`s `isActive`, gleiche
  Violett-Farbe wie vorher in der Bottom-Nav) und die Trainingsplan-Phase (z. B. "Aufbau") steht
  weiterhin neben "Plan" — reine Verschiebung der bestehenden Elemente in ein neues Layout, keine
  Funktionsänderung.

## Mini-PC-Deployment (Phase 7, in Arbeit)

Statt eines eigenen VPS läuft die Produktion auf einem privaten Mini-PC im Heimnetz
(Hostname `pwa01`, Debian 13, hinter Router-NAT) — derselbe Rechner soll insgesamt vier PWAs
hosten, nicht nur diese. Das hat zwei Konsequenzen gegenüber der ursprünglichen
"ein VPS, ein Caddy, Ports 80/443 direkt gebunden"-Annahme:

- **Geteilter Edge-Reverse-Proxy statt eigenem Caddy pro App auf 80/443.** Nur ein Prozess kann
  Host-Port 80/443 belegen; vier unabhängige `docker-compose.prod.yml`-Stacks mit jeweils eigenem
  Caddy auf denselben Host-Ports würden kollidieren. Dieses Repos Caddy bleibt (dient weiterhin
  same-origin Frontend+API, siehe oben), bindet aber keine Host-Ports mehr, sondern lauscht nur
  noch auf `:80` innerhalb eines geteilten externen Docker-Netzwerks namens `edge`
  (`docker network create edge`, einmalig pro Maschine, außerhalb dieses Repos angelegt). Jede der
  vier Apps bekommt einen `container_name` (hier: `fitnesstracker-caddy`), über den sie im
  `edge`-Netz adressierbar ist.
- **Cloudflare Tunnel statt Port-Forwarding/DNS-A-Record.** Der Mini-PC hängt hinter einem
  Heimrouter (NAT, keine feste öffentliche IP) — Port-Forwarding wäre fragil (dynamische IP,
  potenzielles CGNAT) und würde die Heim-IP offenlegen. Ein `cloudflared`-Container (nicht Teil
  dieses Repos, eine Ebene darüber, gemeinsam für alle vier PWAs) hält stattdessen eine
  ausgehende Verbindung zu Cloudflare offen; TLS terminiert bei Cloudflare, nicht auf dem Mini-PC.
  Cloudflares "Public Hostname"-Routing bildet `<subdomain>.<domain>` auf
  `http://fitnesstracker-caddy:80` im `edge`-Netz ab — kein offener Inbound-Port am Router nötig.
  Deshalb auch keine eigene ACME/Let's-Encrypt-Logik mehr in diesem Repos Caddyfile (siehe oben).
- **Host-Firewall (`ufw`) trotzdem sinnvoll**, obwohl der Tunnel keinen Inbound-Port braucht:
  Verteidigung in der Tiefe für alles andere auf der Maschine (z. B. versehentlich exponierte
  Dev-Ports). Da nichts außer dem Tunnel-Container selbst einen Host-Port published, kann `ufw`
  hier `default deny incoming` + `allow` nur für SSH fahren, ohne den öffentlichen Zugriffspfad
  überhaupt zu berühren.
- **Dedizierter Deploy-User `claude` auf dem Mini-PC** (Mitglied der `docker`-Gruppe, kein
  `sudo`), damit Claude Code das Deployment direkt per SSH durchführen/prüfen kann. Zugangsdaten
  liegen außerhalb des Repos, siehe `context.md`.

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
- `Profile` — Eingaben für den Ernährungsrechner + `waterTargetMlOverride` (siehe oben, fertig)
- `WaterLog` — Tages-Running-Total pro Nutzer (siehe oben, fertig)
- `DailyChallengeItem` — Tages-Challenge-Übungen + Fortschritt (siehe oben, fertig)
- `Supplement` — Erinnerungsliste + Zeitzone + letzter Versand (siehe oben, fertig)
- `BodyCompositionEntry` — Waagen-Messungen als Verlauf (siehe oben, fertig)
- `ProgressPhoto` — Metadaten für auf der Platte gespeicherte Vergleichsfotos (siehe oben, fertig)

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

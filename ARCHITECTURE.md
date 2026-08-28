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

## Plan auf der Startseite & Plan-Export/Import (fertig)

- **`CurrentPlanCard` wiederverwendet bestehende Hooks statt neuer Endpunkte.** Die Karte auf `/`
  lädt einfach `useTrainingPlan()` (für `currentPhase`) und `usePlanExercises(currentPhase)` (für
  die zugewiesenen Übungen) — dieselben Hooks, die auch `/plan` benutzt. `usePlanExercises` bekam
  dafür einen optionalen `{ enabled }`-Parameter, weil die Phase erst nach dem Laden des Plans
  bekannt ist und die Query bis dahin nicht feuern soll (React-Hooks-Regeln verbieten einen
  bedingten Hook-Aufruf). Rendert `null`, solange kein Plan oder keine Übungen vorhanden sind —
  gleiches Muster wie `DailyChallengeCard`.
- **Export liefert immer den ganzen Plan (alle drei Phasen), nicht nur die gerade offene.** "Meinen
  Plan exportieren" heißt die komplette Rotation sichern, nicht zufällig nur die Phase, die im
  UI-Tab gerade ausgewählt ist.
- **Kein CSV-/XML-Parser als Dependency.** Das Zeilenformat ist klein und fest (`phase`,
  `exerciseName`, `targetSets`, `targetReps`, `order`) — ein waschechter XML-Parser (mit DTD-/
  Entity-Handling) wäre für fünf flache Tags sowohl unnötiger Umfang als auch unnötige
  XXE-Angriffsfläche. Stattdessen liest `planExport.format.ts` XML per Tag-Extraktion
  (`<entry>…</entry>`-Blöcke, dann simple Regex pro Feld) und CSV per eigenem
  Zeichen-für-Zeichen-Tokenizer (nicht zeilenbasiertes Split, damit ein Feld mit eingebettetem
  Newline die Zeilenzuordnung nicht durcheinanderbringt) — beide mit Escaping/Unescaping für
  Sonderzeichen (`&`, `<`, `>`, `"`, Komma, Newline), end-to-end gegen Übungsnamen mit Kommas,
  Anführungszeichen, `&` und Umlauten getestet.
- **Import matched Übungen über den Namen, nicht über `exerciseId`.** Eine UUID aus einem Export
  ist beim erneuten Import (auf derselben oder einer anderen Instanz) nicht zuverlässig gültig;
  der Name (zuerst `nameDe`, sonst `name`, ohne Groß-/Kleinschreibung) ist die einzige stabile
  Referenz auf den bestehenden, kuratierten Übungskatalog. Bewusst **kein** automatisches Anlegen
  unbekannter Übungen beim Import — der Katalog soll kuratiert bleiben, ein Tippfehler im Namen
  soll nicht klammheimlich eine neue Übung erzeugen. Stattdessen landet jede nicht gefundene Zeile
  als Klartext-Fehlermeldung in der Import-Antwort (`{ created, updated, errors }`), der Rest der
  Datei wird trotzdem verarbeitet — ein Format- oder Tippfehler in einer Zeile soll nicht den
  ganzen Import verwerfen.
- **Bestehende Phase/Übung-Kombinationen werden nur in `targetSets`/`targetReps` aktualisiert, nie
  in `order`** — sonst würde ein erneuter Import (z. B. eines älteren Backups) die aktuelle
  Reihenfolge der Übungen durcheinanderwürfeln, obwohl der Nutzer nur Ziel-Sätze/-Wiederholungen
  ändern wollte. Neue Einträge übernehmen dagegen die relative Reihenfolge aus der `order`-Spalte
  der Importdatei (Sortierung vor dem Einfügen) und werden ans Ende der jeweiligen Phase
  angehängt — gleiche Anhänge-Logik wie beim manuellen Anlegen über `createPlanExercise`.
- **Export/Import teilen sich einen `format`-Query-Parameter statt getrennter Routen pro Format**
  (`GET /plan-exercises/export?format=…`, `POST /plan-exercises/import?format=…`) — ein Format ist
  eine Variante derselben Operation, keine eigene Ressource. Import läuft über
  `@fastify/multipart` (bereits global registriert für die Fortschritts-Fotos aus Phase 12),
  Download im Frontend über denselben `apiFetchBlob`-Mechanismus wie beim Foto-Abruf plus einem
  clientseitig erzeugten Object-URL-Link zum Auslösen des Browser-Downloads.

## Workout-Komfort: Auto-Timer, Ghost-Overlay, RIR/1RM, Supersätze (Phase 20, fertig)

- **Auto-Start des Rest-Timers ist eine reine Geräte-Einstellung, kein Server-Feld.** `autoStartEnabled`/`autoStartSeconds` leben im bestehenden `timerStore` (Zustand), aber jetzt hinter `zustand/middleware`s `persist` mit `partialize` — nur die beiden Einstellungen überleben einen Reload, `remainingSeconds`/`isRunning` bewusst nicht, weil ein laufendes `setInterval` ohnehin nicht über einen Seitenreload hinweg fortgesetzt werden kann/soll. Der Timer startet nur beim **Anlegen** eines neuen Satzes (`WorkoutLogFormDialog`), nicht beim Bearbeiten — das Fixen eines Tippfehlers in einem alten Satz ist kein "ich habe gerade trainiert"-Moment.
- **Ghost-Overlay-Kamera nutzt `getUserMedia` + Canvas-Snapshot statt eines nativen `<input type="file" capture>`.** Der bisherige Datei-Input (Phase 12) delegiert an die native Kamera-App des Betriebssystems, die keinen Weg bietet, ein zweites Bild transparent einzublenden. `ProgressPhotoCamera.tsx` zeigt stattdessen eine eigene `<video>`-Live-Vorschau, legt das zuletzt hochgeladene Foto (per bestehendem `apiFetchBlob`-Muster aus Phase 12 geladen) als `opacity`-gesteuertes `<img>` darüber und "fotografiert" durch Zeichnen des aktuellen Video-Frames auf einen `<canvas>` (`canvas.toBlob` → `File` → derselbe Upload-Pfad wie beim Datei-Input). Ein Regler steuert die Overlay-Deckkraft live. **Bewusster Fallback:** schlägt `getUserMedia` fehl (verweigerte Berechtigung, kein Gerät, kein Browser-Support), zeigt die Karte eine Meldung und der bestehende Datei-Input bleibt vollständig nutzbar — die neue Funktion ist eine Ergänzung, kein Ersatz, der die App auf Geräten ohne Kamera-Zugriff unbenutzbar machen könnte. In dieser Sandbox ohne echte Kamera end-to-end mit Chromiums `--use-fake-device-for-media-stream`/`--use-fake-ui-for-media-stream`-Flags verifiziert (echte Video-Vorschau, sichtbarer Overlay, Aufnahme→Upload→Galerie) sowie der Fallback-Pfad separat ganz ohne diese Flags (reale Verweigerung mangels Kamera-Hardware), beide Male ohne Absturz.
- **1RM-Schätzung ist reine Frontend-Berechnung, kein neues Datenfeld.** `estimateOneRepMax` (Mittelwert aus Epley und Brzycki) rechnet direkt aus bereits vorhandenem `weightKg`/`reps` — anders als RIR, das eine echte neue Nutzereingabe ist (`WorkoutLog.rir`, nullable, Migration `20260826200000_add_workout_log_rir_and_superset`) und deshalb ein Datenbankfeld braucht. Die Aufwärmpyramide (`buildWarmupPyramid`, 40/60/80/90 % des im Formular eingegebenen Zielgewichts) ist ebenfalls rein clientseitig und wird nirgends gespeichert — eine generische Vorschlagsformel, kein personalisiertes Programm.
- **RIR/≈1RM landen als Subtitle-Zeile unter dem Übungsnamen, nicht als eigene Tabellenspalten.** Der erste Versuch fügte zwei neue Spalten hinzu — das drückte die Tabelle bei 375px Breite über den verfügbaren Platz hinaus (`document.documentElement.scrollWidth > clientWidth`, per Playwright verifiziert) und verletzte damit die in "Bekannte Stolperfallen" weiter unten dokumentierte Regel, dass Inhalt bei zu wenig Platz umbricht statt horizontal zu überlaufen. Die Lösung folgt dem bereits etablierten Subtitle-Muster (z. B. `PlanExerciseList`s "3 × 10" unter dem Übungsnamen) statt neuer Spalten — Tabellenbreite bleibt bei den ursprünglichen fünf Spalten, kein Overflow mehr (`scrollWidth === clientWidth` bei 375px nach dem Fix verifiziert).
- **Supersatz-Gruppierung ist rein visuell, keine Timer-Logik.** `WorkoutLog.supersetGroupId` ist eine client-generierte UUID nach demselben Muster wie `clientId` (Identität wird beim Anlegen auf dem Client entschieden, nicht nachträglich vom Server abgeleitet) — im Formular wählbar zwischen "Einzeln", "Neue Gruppe" (neue UUID) und "Zu letzter" (wiederverwendet die zuletzt in diesem Tab erzeugte Gruppen-ID, gespeichert in einer Modul-Variable, die einen vollständigen Seiten-Reload bewusst nicht übersteht — eine neue Session beginnt sauber ohne "Geister-Gruppe"). Die Tabelle bündelt gleiche Gruppen über einen aus der Gruppen-ID deterministisch abgeleiteten farbigen linken Rahmen (kleine feste Palette, kein Kollisionsrisiko mit der violetten Akzentfarbe der App). Bewusst **nicht** gebaut: eine automatische Rest-Timer-Unterdrückung innerhalb einer laufenden Superset-Runde — dafür müsste die App wissen, wie viele Übungen zu einer Gruppe gehören, bevor die Gruppe fertig ist, was die Roadmap nicht spezifiziert; die bestehende manuelle Pause-Taste deckt den Fall ab.

## KI-Trainingsplan-Generator, BYOK (Phase 19, fertig)

- **BYOK statt eigenem, gehostetem KI-Zugang.** Anders als das ursprünglich in der Roadmap vorgesehene, nie aktivierte `CLAUDE_API_ENABLED`/`CLAUDE_API_KEY`-Flag (Phase 6 — ein einzelner, vom Betreiber bereitgestellter Schlüssel) trägt hier jeder Nutzer seinen eigenen API-Key für einen von vier Anbietern ein. Das passt besser zur Ein-Personen/Multi-App-Natur dieses Deployments (siehe Mini-PC-Deployment weiter unten) als ein zentral finanzierter KI-Zugang, und macht die Wahl des Anbieters (inkl. kostenloser Kontingente wie Geminis Free Tier) zur Entscheidung der Nutzerin statt des Betreibers.
- **Ein universeller Client für vier Anbieter, weil alle vier eine OpenAI-kompatible Chat-Completions-Form sprechen.** `aiClient.ts` unterscheidet nur Basis-URL und Default-Modell pro Anbieter (`PROVIDER_CONFIG`) — OpenAI und Groq sind es nativ, OpenRouter proxied selbst im OpenAI-Format, und Google bietet für Gemini eine eigene OpenAI-kompatible Oberfläche (`/v1beta/openai/chat/completions`) an. Ein einziger `callChatCompletion`-Aufruf mit `Authorization: Bearer <key>` reicht für alle vier, keine vier separaten SDKs/Client-Implementierungen nötig.
- **API-Keys werden AES-256-GCM-verschlüsselt gespeichert, mit demselben "inert ohne Config"-Muster wie VAPID/`CLAUDE_API_KEY`.** Der neue, optionale `AI_SETTINGS_ENCRYPTION_KEY` (32 Byte, hex-kodiert, per `openssl`/`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` erzeugbar) ist beim Boot nicht erforderlich — fehlt er, antworten `/ai-settings` mit `configured: false` statt der Server crasht oder das Feature stillschweigend unsicher wird. `lib/crypto.ts` speichert `iv:authTag:ciphertext` (alle hex) als ein einzelnes String-Feld statt dreier Spalten — GCMs Auth-Tag sorgt dafür, dass eine Entschlüsselung mit falschem Schlüssel **fehlschlägt**, statt stillschweigend Datenmüll zu liefern (end-to-end mit einem absichtlich falschen Schlüssel verifiziert). `GET /ai-settings` gibt nie den entschlüsselten Key zurück, nur `hasApiKey`/`provider`/`model`.
- **Catalog-Constraint als zweischichtige Verteidigung, nicht nur ein Prompt-Hinweis.** Der System-Prompt listet ausschließlich die tatsächlich angebotenen Übungs-IDs (`ID | Name | Equipment | Muskelgruppen`) und verlangt striktes JSON via `response_format: { type: "json_object" }` — echtes `json_schema`-Constraining ist über alle vier Anbieter/Modelle hinweg noch nicht einheitlich genug unterstützt, um sich allein darauf zu verlassen. Die eigentliche Durchsetzung passiert danach: Zod validiert Form und Wertebereiche (`targetSets`/`targetReps`/`order`), und zusätzlich wird jede zurückgegebene `exerciseId` gegen die Menge der im Prompt tatsächlich angebotenen Katalog-IDs geprüft — eine syntaktisch gültige, aber halluzinierte UUID (die Zod allein durchließe) wird verworfen, statt später beim Schreiben in `PlanExercise` einen Fremdschlüssel-Fehler zu produzieren oder (schlimmer) eine falsche Übung zu speichern. End-to-end gegen einen lokalen Stub-Provider verifiziert: eine Mischantwort aus einer echten und einer erfundenen ID behält nur die echte.
- **Katalog-Auswahl für den Prompt ist gedeckelt und kontextabhängig, nicht der volle 870+-Übungskatalog.** `selectCatalogSubset` filtert beim Cold-Start nach Kategorie (`strength`/`plyometrics`/`olympic weightlifting`/`strongman`) und dem im 4-Schritte-Modal gewählten Equipment (Homegym/Kurzhanteln/Vollstudio → passende `Exercise.equipment`-Tags, "Vollstudio" = kein Filter). Beim Warm-Start werden zuerst die tatsächlich vom Nutzer trainierten Übungen aufgenommen (nach Häufigkeit sortiert, in JS statt per Prisma-`orderBy` auf einem Aggregat — robuster als sich auf eine unsichere Aggregat-`orderBy`-Syntax zu verlassen), aufgefüllt bis zu einem Deckel von 150 Einträgen mit allgemeinen Kraft-/Plyo-Übungen — genug Vielfalt für einen vollständigen Plan, auch wenn jemand bisher nur 2-3 verschiedene Übungen geloggt hat.
- **Warm-Start vs. Cold-Start wird serverseitig entschieden (≥5 geloggte Sätze), nicht vom Frontend geraten.** Ein erster `POST /ai/generate-plan`-Aufruf ohne `coldStart`-Feld liefert bei zu wenig Historie `{ status: "needs_cold_start" }` als normale (kein Fehler-)Antwort — das Frontend öffnet daraufhin `ColdStartModal` (Trainingsfrequenz, Equipment, Erfahrungsgrad, Einschränkungen als vierteiliger Schritt-für-Schritt-Wizard) und ruft mit den Antworten erneut auf. Warm-Start injiziert stattdessen das Ernährungsprofil (falls vorhanden) und die Bestleistungen der letzten 8 Wochen (`workoutLog.groupBy` mit `_max`, gleiche Aggregat-Technik wie `goalSuggestion.service.ts`) als Kontext.
- **Phasen-Alignment ist eine feste Konstante (`PHASE_GUIDANCE`), keine dynamische Berechnung** — dieselben Satz-/Wiederholungs-/RIR-Vorgaben pro Trainingsphase, die die Roadmap explizit vorgibt, direkt in den System-Prompt eingebettet. Konsistent mit der 8-Wochen-Rotation aus Phase 2 (`AUFBAU`/`MUSKELAUSDAUER`/`NEGATIV`), keine neue Phasen-Taxonomie.
- **Generieren ersetzt den Plan der gewählten Phase komplett, statt anzuhängen.** Eine Transaktion löscht zuerst alle bestehenden `PlanExercise`-Einträge der Phase und legt die validierten Einträge neu an — "einen Plan generieren" bedeutet einen frischen Plan für diese Phase, nicht ein Vermischen mit vorher manuell kuratierten Übungen. Schlägt die Validierung fehl (kaputtes JSON, kein gültiger Katalog-Treffer), wird die Transaktion nie gestartet — die Phase bleibt unverändert, end-to-end verifiziert (Zähler vor/nach einer absichtlich fehlschlagenden Anfrage identisch).
- **Ein `baseUrlOverride`-Parameter in `callChatCompletion`/`generatePlan` existiert ausschließlich für Tests.** Ohne echten API-Key ließe sich die komplette Pipeline (Verschlüsselung → Katalog-Auswahl → Prompt-Bau → Antwort-Parsing → Zod-Validierung → Transaktion) sonst nicht end-to-end verifizieren. Ein lokaler Stub-HTTP-Server stand für einen echten Anbieter ein; Produktionscode setzt diesen Parameter nie. Ein echter HTTP-Request an einen realen Anbieter wurde zusätzlich einmal bewusst nicht gemockt: das Sandbox-Netzwerk blockierte ihn korrekt mit `403 Host not in allowlist`, was `aiClient.ts` sauber als `502 AiProviderError` weiterreichte, statt den Server abstürzen zu lassen — eine zufällige, aber willkommene Verifikation des Fehlerpfads gegen einen echten (wenn auch blockierten) Netzwerk-Request.

### Nachbesserung: Mehrtägige Splits statt einem flachen Ganzkörper-Tag

Erste Praxisnutzung zeigte: die in Schritt 1 des Cold-Start-Modals abgefragte Trainingsfrequenz
landete zwar im Prompt-Kontext, aber nur als beiläufiger Kontext-Satz — das Modell erzeugte
trotzdem oft einen einzigen Ganzkörper-Tag mit 6 Übungen, unabhängig davon, ob 1× oder 6× pro
Woche angegeben war, weil nichts die Frequenz verbindlich in eine Tagesstruktur übersetzte.

- **`resolveSplitDays(frequencyPerWeek)` übersetzt die Frequenz jetzt fest in eine Split-Struktur**
  (`promptBuilder.ts`): 1× Ganzkörper, 2× Ober-/Unterkörper, 3× Push/Pull/Legs, 4× Ober-/
  Unterkörper A+B, 5× Bro-Split (Brust/Rücken/Beine/Schultern/Arme), 6× Push/Pull/Legs A+B —
  Namen absichtlich identisch mit den kuratierten Splits in
  `frontend/src/data/recommendedSplits.ts`/`RecommendedSplitsSection`, damit ein generierter
  Plan genauso benannt ist wie die App ihre eigenen Vorlagen nennt. Wiederholte Tagestypen
  innerhalb einer Woche (z. B. zwei Push-Tage bei 6×) bekommen A/B-Suffixe, damit `dayLabel`
  innerhalb einer Phase eindeutig bleibt.
- **Warm-Start-Nutzer wurden nie nach der Frequenz gefragt** (das ist reine Cold-Start-Frage) —
  `estimateWeeklyFrequency` schätzt sie stattdessen aus der tatsächlichen Log-Kadenz der letzten
  4 Wochen (Anzahl unterschiedlicher Kalendertage mit mindestens einem Satz, gerundet, geklemmt
  1-6, Default 3 ohne jedes Signal).
- **`PlanExercise.dayLabel`** (neue Migration `20260827120000_add_plan_exercise_day_label`) hält
  fest, zu welchem Split-Tag ein Eintrag gehört — `null` für manuell hinzugefügte Einträge und
  für Ein-Tages-Pläne ("Ganzkörper"), die nichts zu gruppieren haben. Der bestehende Unique Index
  wurde von `(userId, phase, exerciseId)` auf `(userId, phase, exerciseId, dayLabel)` erweitert,
  damit dieselbe Übung auf verschiedenen Tagen derselben Phase erscheinen darf (z. B. eine
  Grundübung sowohl am Push- als auch am Legs-Tag), aber nicht zweimal am selben Tag. Zwei
  Stellen mussten für die neue Compound-Key-Form angepasst werden (`planExercise.service.ts`s
  manueller Duplikat-Check, `planExport.service.ts`s Import-Abgleich) — beide nutzen jetzt
  `findFirst({ dayLabel: null })` statt `findUnique` auf dem Compound Key, weil Prismas
  generierter Compound-Unique-Input-Typ `null` für ein nullable Feld nicht akzeptiert, obwohl der
  zugrundeliegende Index es sehr wohl tut (bekannte Prisma-Einschränkung, keine Absicht der DB).
- **`order` bleibt ein einziger, über den ganzen Schreibvorgang durchlaufender Zähler** (tagweise
  aufsteigend), statt pro Tag wieder bei 0 zu beginnen — dadurch liefert die bereits bestehende
  `listPlanExercises`-Route (ein einfaches `ORDER BY order ASC`, das nichts von Split-Tagen
  weiß) die Einträge automatisch in korrekter Tages-Reihenfolge, ohne dass die Leseseite
  angefasst werden musste. Eine alphabetische Sortierung nach `dayLabel` wäre falsch gewesen
  (z. B. "Legs" vor "Push" alphabetisch, aber Push soll zuerst kommen).
- End-to-end gegen einen lokalen Stub-Provider verifiziert: 3×/Woche erzeugt exakt Push/Pull/Legs
  mit korrekter Tages-Reihenfolge (inkl. Wiederverwendung derselben Übung auf zwei Tagen), 1×/
  Woche bleibt ungruppiert, ein vom Modell erfundener Tagesname wird verworfen, und die aus
  simulierten Logs geschätzte Frequenz traf den erwarteten Split.

### Nachbesserung 2: Tage-Dropdown auf `/plan` & wöchentlicher Fortschritt auf dem Dashboard

Die Tage steckten korrekt in der Datenbank, aber `/plan` zeigte sie erst als eine durchgehende,
mit Überschriften unterteilte Liste an statt einzeln umschaltbar — und das Dashboard zeigte
weiterhin alle 18 Übungen auf einmal, ohne erkennbar zu machen, welcher Tag als nächstes dran ist.

- **`PlanExerciseList` bekam ein natives `<select>`-Dropdown statt gestapelter Überschriften**
  (nur wenn `dayGroups.length > 1` — ein Ein-Tages-Plan zeigt weiterhin einfach seine flache
  Liste). Die Auswahl ist auf einen Index geklemmt statt bei jedem Rerender auf 0 zurückgesetzt,
  damit ein Nachgenerieren mit weniger Tagen als vorher die aktuelle Auswahl nicht willkürlich
  springen lässt. Die Auf/Ab-Pfeile zum manuellen Umsortieren wirken jetzt nur noch innerhalb des
  gewählten Tages, nicht mehr über Tagesgrenzen hinweg.
- **`GET /plan-exercises/week-status` (`planWeekStatus.service.ts`) ist reiner Lesezugriff, kein
  gespeicherter Zustand.** Ob ein Split-Tag "diese Woche trainiert" wurde, wird bei jedem Aufruf
  frisch aus den `WorkoutLog`-Einträgen seit Montag 00:00 UTC berechnet (gleiche
  UTC-Kalendertag-Konvention wie Wasser-Reset/Tages-Challenge) — kein `WeeklyProgress`-Modell,
  kein Cronjob, kein manueller Montags-Reset nötig: sobald eine neue Woche beginnt, liefert die
  Abfrage automatisch "noch nichts trainiert", weil die Logs der Vorwoche außerhalb des
  Zeitfensters liegen.
- **Ein Tag galt zunächst als trainiert, sobald irgendeine seiner geplanten Übungen diese Woche
  geloggt wurde — nicht erst, wenn alle sechs es wurden** (Begründung: ein Training weicht in der
  Praxis fast immer leicht vom Plan ab). Diese Regel wurde in Nachbesserung 3 auf "alle Übungen"
  verschärft, siehe dort.
- **`activeDayIndex`** ist der Index des ersten noch offenen Tages in der Split-Reihenfolge, oder
  `null`, wenn alle Tage dieser Woche erledigt sind. `CurrentPlanCard` zeigt dementsprechend genau
  einen Tag mit seinen Übungen (plus einer schmalen Fortschrittsleiste: grün = erledigt, violett =
  aktueller Tag, grau = offen) oder bei `null` eine Erfolgsmeldung statt einer Übungsliste. Ein
  Ein-Tages-Plan (`Ganzkörper`) hat nichts zu "fortschreiten" und liefert immer `activeDayIndex: 0`
  ohne Wochen-Berechnung — exakt das bisherige Verhalten vor diesem Feature.
- **Zwei Query-Keys, die sich nicht gegenseitig invalidieren.** `["plan-exercises", phase]` und
  `["plan-exercises", "week-status", phase]` teilen sich kein gemeinsames Präfix (unterschiedliche
  Werte an derselben Array-Position), React Querys Standard-Präfix-Invalidierung erwischt also nie
  beide gleichzeitig — jede Mutation, die den Plan einer Phase ändert (manuelles Anlegen/Ändern/
  Löschen, KI-Generieren), muss beide Keys explizit invalidieren.
- **Ein echter Bug unterwegs gefunden: das Speichern eines Satzes aktualisierte den
  Wochen-Status gar nicht.** `offline/workoutLogSync.ts` kennt die `plan-exercises`-Query-Keys
  gar nicht — es aktualisiert nur den `workout-logs`-Cache. Live im Browser reproduziert: nach dem
  Loggen der Tag-1-Übung blieb die Dashboard-Karte auf Tag 1 stehen, bis die Seite neu geladen
  wurde. Fix: `syncQueryCache()` (bereits der zentrale Punkt, der nach jedem lokalen Schreiben und
  jedem Hintergrund-Sync-Schritt läuft, siehe Offline-Sync-Abschnitt oben) invalidiert jetzt
  zusätzlich `["plan-exercises", "week-status"]` präfixweise über alle drei Phasen — welche Phase
  gerade "aktuell" ist, muss dieser Funktion dafür nicht bekannt sein.
- End-to-end verifiziert: frischer 3-Tage-Split zeigt Tag 1, das Loggen einer Tag-1-Übung schaltet
  sofort (auch live im Browser, nach dem Bugfix oben) auf Tag 2 um, nach allen drei Tagen
  erscheint die Erfolgsmeldung, und künstliches Verschieben aller Logs in die Vorwoche setzt
  korrekt auf Tag 1 zurück.

### Nachbesserung 3: Plan als Tagebuch

Bisher zeigte `CurrentPlanCard` den aktiven Tag nur als reine Übungsliste an — geloggt wurde
weiterhin über den separaten "+ Satz"-Dialog. Der Wunsch: der Plan selbst soll ausfüllbar sein
(Übung, Sätze, Wdh., Gewicht, Ende-Checkbox), und ein Häkchen bei "Ende" soll direkt zur nächsten
Übung springen.

- **Die Tabelle schreibt echte `WorkoutLog`-Einträge, kein separates Häkchen-Feld.** Ein
  Häkchen bei "Ende" ruft für jeden in "Sätze" eingegebenen Wert einmal `createLog.mutateAsync`
  auf (`setNumber` von 1 bis `sets`, gleiches `clientId`/Offline-Sync-Muster wie der bestehende
  "+ Satz"-Dialog) — der Tagebuch-Eintrag *ist* der Log-Eintrag, keine Kopie oder ein
  Zusatzsystem daneben. Sätze/Wdh./Gewicht sind bewusst einfache `<input type="number">`-Felder
  ohne eigene Validierungsbibliothek (kein React-Hook-Form/Zod-Formular für eine derart kleine,
  inline editierbare Zeile) — eine simple Ganzzahl-/Positiv-Prüfung vor dem Schreiben, mit
  Inline-Fehlermeldung statt eines Toasts.
- **Kein Entfernen des Häkchens.** Eine Zeile sperrt sich nach dem Abhaken dauerhaft
  (`done`-State, kein Zurück) — ein versehentliches Doppel-Antippen soll keine doppelten Sätze
  erzeugen können. Korrekturen laufen bewusst über die bestehende Bearbeiten-/Löschen-Funktion
  der Log-Tabelle darunter, denselben Weg wie bei jedem anderen geloggten Satz, statt einen
  zweiten Korrekturmechanismus nur fürs Tagebuch zu bauen.
- **`loggedThisWeek` pro `PlanExercise`** (neues, nicht persistiertes Feld in
  `planDiaryExerciseDtoSchema`, serverseitig in `getWeeklyPlanStatus` aus denselben
  `WorkoutLog`-Einträgen berechnet, die auch `activeDayIndex` treiben) lässt eine Zeile nach
  einem Reload sofort als "erledigt" anzeigen, ohne dass das Frontend die Wochen-Grenze
  (Montag 00:00 UTC) selbst nachbilden müsste — dieselbe serverseitige Quelle der Wahrheit wie
  beim Tages-Fortschritt.
- **Tag-Abschluss-Regel von "mindestens eine Übung" auf "alle Übungen" verschärft
  (`.every()` statt `.some()` in `planWeekStatus.service.ts`).** Das Tagebuch liefert jetzt ein
  präzises Pro-Übung-Signal ("diese Übung wurde erledigt"), im Gegensatz zur vorherigen
  Unsicherheit, ob ein einzelner geloggter Satz einen ganzen Tag repräsentiert. Wer weiterhin
  frei über den klassischen "+ Satz"-Dialog loggt statt über das Tagebuch, muss dafür einmal
  jede geplante Übung des Tages abdecken — dieselbe Schwelle wie beim Tagebuch-Pfad, kein
  bevorzugter Weg.
- **Fokus-Sprung zur nächsten Zeile über eine Ref-Liste** (`rowRefs` in `CurrentPlanCard`, ein
  `HTMLInputElement`-Array indiziert nach Zeilenposition) statt eines State-getriebenen
  "aktive Zeile"-Konzepts — nach erfolgreichem Abhaken ruft die Zeile einfach `onDone()` auf,
  die Karte fokussiert das "Sätze"-Feld der nächsten Zeile per `ref.focus()`. Kein Scroll-Effekt
  nötig, weil bei sechs Übungen pro Tag alle Zeilen ohnehin ohne Scrollen sichtbar sind.
- End-to-end im Browser verifiziert (400px und 375px Breite): Tabelle rendert korrekt, kein
  horizontales Overflow bei 375px (`scrollWidth === clientWidth`, gleiche Prüfmethode wie beim
  RIR/1RM-Fix oben), Ausfüllen von "Bench Press" (2 Sätze, 8 Wdh., 40 kg) und Abhaken erzeugt
  exakt zwei neue Zeilen in der Log-Tabelle darunter, sperrt die Tagebuch-Zeile, und das
  Dashboard springt ohne Reload sofort von "Push" auf "Pull" (erster Fortschrittspunkt wird
  grün) — bestätigt, dass die `.every()`-Regel korrekt mit dem neuen Tagebuch-Signal
  zusammenspielt.

## Cardio-Tracking & entzerrte Plan-Seite (Phase 21, fertig)

- **`CardioLog` ist bewusst ein eigenes, einfaches Modell — keine Erweiterung von
  `WorkoutLog`/`PlanExercise`.** Eine Cardio-Einheit hat eine völlig andere Form (Gerät +
  Stufe/Intensität/Dauer statt Sätze/Wiederholungen/Gewicht gegen eine Katalog-`Exercise`) und
  ist nicht Teil des Split-Plans — sie in `WorkoutLog` zu pressen hätte `exerciseId` (Pflichtfeld,
  zeigt auf den Kraft-Übungskatalog) und `reps`/`weightKg` für ein Konzept überladen, für das sie
  nicht gedacht sind. `machine` ist ein eigenes Enum (`TREADMILL`/`BIKE`/`STEPPER`/`STAIRMASTER`),
  `intensity` bewusst ein String statt einer Zahl — was "Intensität" bedeutet, ist je Gerät
  verschieden (km/h, Watt, Steigungs-%, oder einfach "mittel"), kein einzelnes numerisches Feld
  passt für alle vier. Soft-Delete (`deletedAt`) nach demselben Muster wie `WorkoutLog`.
- **Kein Offline-Sync, anders als `WorkoutLog`.** Cardio ist eine optionale Zusatzfunktion ohne
  die Kritikalität von "Satz beim Training ohne Netz loggen", die die IndexedDB-Sync-Queue in
  `offline/workoutLogSync.ts` überhaupt erst rechtfertigt. `useCardioLogs.ts` ist deshalb ein
  gewöhnlicher React-Query-Hook direkt gegen `/cardio-logs` (gleiches Muster wie
  `useBodyComposition.ts`), keine Dexie-Anbindung.
- **`GET /cardio-logs` liefert immer nur "heute" (UTC-Kalendertag), kein Datumsfilter.** Es gibt
  (noch) keine Cardio-Historienansicht — die Dashboard-Karte braucht nur den aktuellen Tag, ein
  generischer `from`/`to`-Parameter wie bei `/workout-logs` wäre für diesen einen Anwendungsfall
  unnötige Fläche.
- **Ein Dropdown für "Übung" statt vier Spalten, eine pro Gerät.** Wörtliche Anforderung: "damit
  man nur eine Spalte und keine 3 leeren hat" — `CardioLogCard` zeigt eine Tabelle mit
  Übung/Stufe/Intensität/Zeit, wobei "Übung" ein natives `<select>` mit den vier Geräten ist,
  keine eigene Spalte pro Gerät. Jede Zeile ist unabhängig speicherbar (Häkchen-Button, kein
  "nächste Übung"-Sprung wie im Kraft-Tagebuch — Cardio-Einträge sind nicht sequenziert), "Add
  row" hängt eine weitere leere Zeile an, damit zwei Geräte in einer Session getrennt getrackt
  werden können. Gespeicherte Zeilen werden gesperrt angezeigt (Gerät, Stufe, Intensität, Dauer)
  mit einem Lösch-Button — anders als beim Kraft-Tagebuch gibt es hier keine separate Log-Tabelle
  darunter, über die man einen Fehler korrigieren könnte, daher übernimmt der Lösch-Button diese
  Rolle direkt in der Karte.
- **`DraftCardioRow`/`SavedCardioRow` als eigene Komponenten statt Inline-Fragmente in einer
  `.map()`.** Genau wie `DiaryRow` in `CurrentPlanCard.tsx` — ein React-Fragment mit `key` direkt
  in einer `.map()`-Callback-Funktion zu verwenden funktioniert nicht (`key` muss am äußersten
  von `map()` zurückgegebenen Element sitzen), eine benannte Komponente mit `key` auf dem
  Komponenten-Aufruf ist der etablierte Weg dafür in dieser Codebase.
- End-to-end verifiziert (400px und 375px): kein horizontales Overflow, Ausfüllen + Speichern
  einer "Fahrrad"-Zeile (Stufe 5, "25 km/h", 20 min) erzeugt eine gesperrte Zeile mit korrekten
  Werten, "Add row" hängt eine weitere leere Zeile an, Speichern ohne Intensität/Zeit zeigt die
  Inline-Fehlermeldung statt zu speichern, Löschen entfernt den Eintrag wieder.

- **`/plan` in zwei Seiten aufgeteilt, weil sie mit manueller Übungsliste, KI-Generator und
  Export/Import überladen war.** Generieren und Exportieren/Importieren sind seltene, bewusste
  Aktionen (keine Werte, die man beim täglichen Training im Blick hat) — sie leben jetzt auf einer
  eigenen Route `/plan/generate` (`PlanGenerateExportPage`), erreichbar über einen Link oben
  rechts auf `/plan`. `/plan` selbst behält Phasenübersicht, Push-Erinnerung, die editierbare
  Übungsliste mit dem Tage-Dropdown (aus Nachbesserung 2 oben) und den Phasen-Verlauf.
- **`PhaseTabs` als gemeinsame Komponente statt zweier Kopien.** Beide Seiten brauchen denselben
  Drei-Wege-Tab-Umschalter (Aufbau/Muskelausdauer/Negativ), der jeweils eine andere darunter
  liegende Ansicht (Übungsliste vs. KI-Generator) steuert — anders als bei den drei ähnlichen
  Codezeilen, die die Projekt-Richtlinie bewusst nicht in eine Abstraktion zieht, ist das hier ein
  in sich geschlossenes, mehrfach identisch benötigtes Widget, das sich lohnt auszulagern.
  `PlanExportImportCard` bekam keinen Phasen-Bezug — sie exportiert wie zuvor immer den ganzen
  Plan (alle drei Phasen), unabhängig vom gerade gewählten Tab.
- End-to-end verifiziert: `/plan` zeigt keine KI-Provider-Auswahl mehr, `/plan/generate` zeigt
  KI-Generator und Export/Import korrekt an, beide Seiten laden denselben Plan über den
  bestehenden `useTrainingPlan`-Hook (React-Query-Cache, kein doppelter Netzwerk-Request beim
  Wechsel zwischen den Seiten).

## Trainingsablauf: Start/Pause/Fortsetzen/Abbrechen/Abschließen (Phase 22, fertig)

- **`WorkoutSession` bewusst nicht mit `WorkoutLog` verknüpft — kein `sessionId`-Feld dort.**
  Ursprünglich aus `roadmap2.md`, dann bewusst vereinfacht: reicht als Buttons, ohne das
  bestehende "+ Satz" umzubauen. Eine Session ist ein paralleler, optionaler Lifecycle-Tracker,
  keine Voraussetzung fürs Loggen — ein Satz lässt sich weiterhin jederzeit loggen, unabhängig
  davon, ob gerade eine Session offen ist. Das hält die Änderung rein additiv: nichts an der
  bestehenden, gut getesteten Log-Logik musste angefasst werden.
  - `status` ist ein Enum (`ACTIVE`/`PAUSED`/`COMPLETED`/`ABORTED`), `endedAt` wird serverseitig
    gesetzt, sobald `status` auf einen der beiden Terminalzustände wechselt — nie vom Client
    direkt geschickt. Es gibt bewusst keine serverseitige Zustandsautomat-Validierung (z. B.
    "PAUSED → ACTIVE ist ok, COMPLETED → ACTIVE nicht") — das Frontend bietet ohnehin nur
    gültige Übergänge als Buttons an, eine zusätzliche Prüfschicht hätte für den gewünschten
    schlanken Umfang keinen echten Wert gebracht.
  - Höchstens eine offene Session (`ACTIVE`/`PAUSED`) gleichzeitig pro Nutzer — nicht per
    DB-Constraint erzwungen, sondern dadurch, dass das Frontend "Training starten" nur zeigt,
    wenn es lokal keine offene Session kennt. `GET /workout-sessions/open` sortiert nach
    `updatedAt desc` als Sicherheitsnetz, falls diese Invariante doch mal verletzt wird (z. B.
    zwei Geräte gleichzeitig).
- **Eigene, kleinere Offline-Sync-Queue statt Erweiterung von `workoutLogSync.ts`.** Eine
  Session braucht offline exakt dieselbe Grundmechanik wie ein Satz (lokal-zuerst schreiben,
  `clientId` als Idempotenz-Schlüssel, eine Mutation-Queue, die bei `online` synchron
  nacheinander abgearbeitet wird), aber nur zwei Operationen (`create` fürs Starten, `update`
  für jeden Status-Wechsel — nie `delete`, eine Session wird nie gelöscht, nur beendet). Statt
  die bestehende, funktionierende `pendingMutations`-Queue um einen Entitätstyp zu erweitern
  (Risiko: ein Bug dort träfe auch das Satz-Logging), bekam `WorkoutSession` eine eigene, parallele
  Queue: neue Dexie-Tabellen `workoutSessions`/`pendingSessionMutations` (Dexie-Version 2 in
  `offline/db.ts` — `version(2).stores(...)`, keine Migration bestehender Felder nötig, nur neue
  Tabellen), eigenes `offline/workoutSessionSync.ts` mit demselben Aufbau wie
  `workoutLogSync.ts` (lokal schreiben → Queue einreihen → `syncSessionQueryCache` → Flush
  versuchen), aber ohne den `delete`-Zweig und ohne die "mehrere Zeilen"-Sortierung, weil es nur
  eine relevante lokale Zeile gibt (die gerade offene Session). Eigene `online`/`offline`-Listener
  in `initWorkoutSessionSync()`, separat von `initWorkoutLogSync()` registriert — beide sind
  billig und unabhängig, kein Grund, Session-Flushes durch das Log-Sync-Modul zu fädeln.
  `LocalWorkoutSession` folgt demselben `id: string | null`-Muster wie `LocalWorkoutLog` — offline
  gestartet ist sofort voll bedienbar (Pause/Abbrechen/Abschließen funktionieren, bevor der Server
  je eine `id` vergeben hat).
- **`WorkoutSessionBar` als einfache Button-Reihe, keine laufende Dauer-Anzeige.** Zeigt nur
  Status + Startzeit (`seit HH:MM`) statt eines live hochzählenden Timers — für den gewünschten
  schlanken Umfang reicht ein statischer Zeitstempel, ein `setInterval`-getriebener Countdown
  hätte zusätzliche Komplexität (Aufräumen bei Unmount, Hintergrund-Tab-Drosselung) ohne
  angefragten Mehrwert bedeutet.
- End-to-end verifiziert: Start → Pause → Reload (Server-Persistenz bestätigt) → Fortsetzen;
  offline Abbrechen aktualisiert die UI sofort, offline eine neue Session starten ebenso; nach
  Reconnect + Reload ist die offline gestartete Session serverseitig vorhanden; kein horizontaler
  Overflow bei 375px mit allen drei Aktions-Buttons gleichzeitig sichtbar.

## Trainingsplan & Rotation: Pausieren und Neustart (Phase 23, fertig)

- **`TrainingPlan.pausedAt` statt eines separaten "Pause"-Modells oder eines dritten
  Rotations-Zustands.** Ein einzelnes nullable Datumsfeld reicht: gesetzt heißt pausiert, `null`
  heißt läuft normal — kein eigenes Statusenum nötig, weil die einzige Zusatzinformation, die eine
  Pause braucht, der Zeitpunkt ist, ab dem sie gilt (für die Verschiebungsrechnung beim
  Fortsetzen).
- **Fortsetzen verschiebt `phaseStartedOn` um exakt die pausierte Dauer, statt die Pause
  einfach zu ignorieren.** Ohne diese Verschiebung würde eine 3-wöchige Pause die verbleibende
  Zeit bis zur nächsten Rotation um 3 Wochen verkürzen (oder die Rotation sofort auslösen, falls
  die Pause lang genug war) — spürbar falsch für ein Feature, dessen ganzer Zweck ist, den
  8-Wochen-Countdown währenddessen anzuhalten. `phaseStartedOn_neu = phaseStartedOn_alt + (jetzt -
  pausedAt)` hält die Restlaufzeit exakt konstant. Per Skript verifiziert: `pausedAt` künstlich 10
  Tage zurückdatiert, `resumeTrainingPlan` verschiebt `phaseStartedOn` um exakt 10 Tage.
- **`rotatePhaseIfDue` prüft `pausedAt` als Erstes und kehrt sofort zurück, wenn gesetzt** — kein
  Rotations-Countdown, keine Historie, kein `nextRotationOn` während einer Pause zu berechnen.
  Der Scheduler (`rotateAllDuePlans`) filtert pausierte Pläne zusätzlich schon in der SQL-Query
  raus (`pausedAt: null`), damit sie gar nicht erst durch die (ohnehin harmlose, aber unnötige)
  Rotationsprüfung laufen.
- **`nextRotationOn` ist jetzt `string | null` im `TrainingPlanDto`** statt immer ein Datum — `/plan`
  zeigt bei `pausedAt` gesetzt "pausiert seit …" anstelle eines nächsten Wechsel-Datums, das
  während der Pause ohnehin nicht bedeutungsvoll wäre.
- **"Phase neu starten" setzt nur `phaseStartedOn` zurück (auf den Montag der aktuellen Woche,
  `mostRecentMonday` — dieselbe Normalisierung wie beim ersten Anlegen des Plans), rührt aber
  weder `currentPhase` noch `TrainingPlanPhaseHistory` an.** Ein Neustart bedeutet "diese Phase
  von vorn beginnen", nicht "eine neue Phase beginnen" — es wurde ja tatsächlich keine Phase
  abgeschlossen, also gehört auch kein Eintrag in die Verlaufs-Historie. Hebt eine laufende Pause
  automatisch mit auf (`pausedAt: null`), weil ein bewusster Neustart ein "ich trainiere wieder"-
  Signal ist.
- **Keine Bestätigungs-Dialoge**, obwohl "Phase neu starten" den Fortschritt der aktuellen Phase
  verwirft — konsistent mit dem Rest der App, die für destruktive Aktionen durchgängig auf
  `window.confirm` verzichtet (z. B. "Löschen" in `WorkoutLogTable`, "Abbrechen" in
  `WorkoutSessionBar`).
- End-to-end verifiziert: Pausieren zeigt sofort "pausiert seit HH…" und übersteht einen Reload;
  Fortsetzen zeigt wieder ein nächstes Wechsel-Datum; Phase neu starten setzt "Seit" korrekt auf
  den aktuellen Montag zurück; kein horizontaler Overflow bei 375px mit allen Buttons sichtbar.

## Progressionslogik: Steigerung, Fehlversuche, Deloads (Phase 24, fertig)

- **Aufbau und Negativ progressieren über Gewicht, nur Muskelausdauer über Wiederholungen —**
  **eine bewusste Korrektur unterwegs.** Der erste Zuschnitt ("nur Aufbau übers Gewicht,
  Ausdauer/Negativ eher mehr Wiederholungen") widersprach der bereits bestehenden
  Phasen-Definition in `promptBuilder.ts`s `PHASE_GUIDANCE`: Negativ ist mit 4-6 Wiederholungen
  (exzentrische Überlastung, nahe am Maximalgewicht) der niedrigste Wiederholungsbereich aller
  drei Phasen, nicht ein hochrepetitiver Ausdauer-Fokus — "mehr Wiederholungen" als
  Progressionsziel hätte dem eigentlichen Trainingsreiz dieser Phase widersprochen. Auf Rückfrage
  progressiert Negativ jetzt wie Aufbau übers Gewicht; `mode = phase === "MUSKELAUSDAUER" ?
  "reps" : "weight"` in `computeProgression` (`planWeekStatus.service.ts`) hält diese Entscheidung
  an einer Stelle fest.
- **Progression braucht die volle Log-Historie einer Übung, nicht nur "diese Woche".** Anders als
  `loggedThisWeek` (Nachbesserung 2/3 oben, bewusst auf die aktuelle Woche begrenzt) muss ein
  Fortschritts-Vorschlag die letzten tatsächlich geloggten Sätze sehen, auch wenn die letzte
  Einheit für diese Übung vor mehr als einer Woche lag. `fetchRecentSetsByExercise` fragt deshalb
  für jede Übung des aktiven Tages separat `take: 2` ab (parallel via `Promise.all`), sortiert
  nach `performedAt desc, setNumber desc` — bewusst pro Übung statt einer einzigen, über alle
  Übungen gedeckelten Abfrage: bei ungleich verteiltem Logging (eine Übung viel seltener trainiert
  als eine andere) würde eine gemeinsame `take`-Grenze die selten trainierte Übung sonst leer oder
  mit falscher (zu alter) Historie zurückgeben.
- **Ziel-Wiederholungen kommen aus `PlanExercise.targetReps`, mit einem Phasen-Default als
  Fallback (Aufbau 10, Muskelausdauer 20, Negativ 5)** — Mittelwerte aus `PHASE_GUIDANCE`s
  Wiederholungsbereichen, für Übungen, die manuell ohne explizites Ziel angelegt wurden.
- **Drei klare Regeln, unabhängig vom Modus:** Ziel erreicht → Steigerung (Gewichts-Modus: +2,5kg
  beim gleichen Wiederholungsziel; Wiederholungs-Modus: +2 Wiederholungen beim gleichen Gewicht).
  Ziel verfehlt ("Fehlversuch") → unverändert nochmal (gleiches Gewicht bzw. gleiches
  Wiederholungsziel). Zweimal in Folge beim exakt gleichen Gewicht verfehlt → Deload, 10 % runter,
  auf 2,5kg gerundet (`Math.round(kg / 2.5) * 2.5`) — überschreibt in beiden Modi sowohl den
  Gewichts- als auch den Wiederholungsvorschlag (Wiederholungsziel fällt beim Deload zurück auf
  den Basiswert, nicht auf eine Fortsetzung der zuletzt verfehlten Zahl).
  Kein Vorschlag (`progression: null`), solange noch nichts für diese Übung geloggt wurde — kein
  erfundener Startwert.
- **Vorschlag füllt die Tagebuch-Felder vor, statt nur informativ danebenzustehen.** `DiaryRow`
  initialisiert `reps`/`weightKg` direkt aus `entry.progression` (sonst leer wie bisher) — wer
  einfach nur "Ende" abhakt, trainiert automatisch nach der berechneten Regel, ohne selbst
  nachzurechnen oder abzutippen; eine kurze Subtitle-Zeile unter dem Übungsnamen ("↑ 62.5kg",
  "= 40kg", "Deload → 35kg", grün/grau/amber je nach Fall) zeigt zusätzlich, warum. Gleiches
  Subtitle-Zeilen-Muster wie beim RIR/1RM-Fix (Phase 20) und `loggedThisWeek` — Zusatzinfo unter
  dem Namen statt einer weiteren Tabellenspalte.
- **Dabei eine echte UI-Lücke gefunden: das kg-Feld schnitt vorausgefüllte Nachkommawerte visuell
  ab.** Ein Vorschlag wie "62.5" erschien im ursprünglich schmalen Feld (`w-11`, 44px) nur als
  "62" — der tatsächliche `<input>`-Wert war korrekt (per `evaluate()` bestätigt), nur nicht
  vollständig sichtbar, ein Problem, das vor der Progression kaum auftrat, weil das Feld zuvor
  fast immer leer startete. Behoben durch Verbreiterung auf `w-14`; bei 375px weiterhin kein
  horizontaler Overflow.
- End-to-end verifiziert (Skript direkt gegen `getWeeklyPlanStatus` sowie live im Browser): zwei
  Fehlversuche beim selben Gewicht lösen den erwarteten Deload aus (40kg → 35kg), ein erreichtes
  Ziel schlägt korrekt eine Gewichtssteigerung vor (20kg → 22,5kg bzw. 60kg → 62,5kg),
  Muskelausdauer schlägt bei erreichtem Ziel eine Wiederholungssteigerung statt einer
  Gewichtssteigerung vor, eine Übung ohne jede Historie zeigt weiterhin leere Felder.

## Robustheit, Security & Bugfixes (Phase 16-18, fertig)

Fünf gezielte Fixes aus der in `ROADMAP.md` (Phase 16-18) dokumentierten Review — keine neuen
Features, sondern Härtung bestehender Mechanismen.

- **Supplement-Erinnerung: `>=` statt `===` gegen die lokale Uhrzeit.** Ein exakter
  String-Vergleich (`local.time === reminderTime`) verpasst die Erinnerung komplett, sobald der
  minütliche Tick durch Event-Loop-Last mal eine Minute überspringt (z. B. `07:59` → `08:01`
  ohne dazwischenliegenden `08:00`-Tick). `local.time >= reminderTime` fängt das ab;
  `lastRemindedOn !== local.day` (unverändert aus Phase 10) bleibt die alleinige Garantie für
  "höchstens einmal pro Tag" — ein nachträglicher Tick am selben Tag sendet nicht erneut, egal
  wie oft `>=` danach noch zutrifft.
- **Postgres-Advisory-Locks statt Redis für die drei Scheduler.** Alle drei
  `setInterval`-Scheduler (`trainingPlan`, `supplement`, `progressPhoto`) liefen bisher
  unbedingt — bei mehr als einer Backend-Instanz (mehrere Container, Node-Cluster) hätte jede
  Instanz unabhängig denselben Tick ausgeführt und doppelte Push-Benachrichtigungen verschickt.
  Die Roadmap nannte zwei Optionen (Redis-Locks oder ein dedizierter Worker-Container) — beide
  hätten neue Infrastruktur bedeutet, die dem Rest der App widerspricht (siehe "Warum dieser
  Stack": bewusst keine externen Managed-Dienste, eine Person pflegt das Projekt). Postgres ist
  bereits die einzige Ressource, die alle Instanzen ohnehin teilen, also übernimmt
  `pg_try_advisory_lock`/`pg_advisory_unlock` (`backend/src/lib/schedulerLock.ts`) die Rolle des
  verteilten Mutex — nicht-blockierend: eine Instanz, die den Lock nicht bekommt, überspringt
  diesen Tick komplett statt zu warten, der nächste Tick (60s-6h später, je nach Scheduler)
  versucht es erneut. Jeder Scheduler hat einen eigenen festen `bigint`-Lock-Key, damit sich die
  drei Scheduler nicht gegenseitig blockieren. End-to-end mit zwei parallelen
  `PrismaClient`-Verbindungen verifiziert (simuliert zwei Backend-Instanzen): der zweite,
  überlappende Aufruf wurde übersprungen, ein dritter nach Freigabe des Locks lief normal.
- **`@fastify/rate-limit`, `global: false`, nur auf `/auth/login` und `/auth/register`.** Vorher
  gab es keinerlei Brute-Force-Schutz auf API-Ebene für die beiden credential-relevanten Routen.
  `global: false` beim Registrieren heißt: jede andere Route bleibt komplett unlimitiert, nur
  Routen mit explizitem `config: { rateLimit }` sind betroffen — bewusst opt-in statt einer
  globalen Grenze, die z. B. das Offline-Sync-Retry-Verhalten aus Phase 4 hätte treffen können.
  5 Requests/Minute (In-Memory-Store, ausreichend für eine Single-Instance-App wie hier) ist
  großzügig genug für einen legitimen Login-Versuch mit Tippfehler, aber eng genug, um
  automatisiertes Durchprobieren spürbar zu bremsen. End-to-end getestet: 6. Anfrage innerhalb
  einer Minute liefert `429`, `/api/health` bleibt bei denselben acht Anfragen unlimitiert.
- **Fisher-Yates (Knuth) statt `sort(() => Math.random() - 0.5)`** für die
  Tages-Challenge-Übungsauswahl aus Phase 14 — Letzteres ist ein bekanntes Anti-Pattern (V8s
  Sort-Implementierung ruft den Komparator nicht für jede Permutation gleich oft auf, das Ergebnis
  ist keine Gleichverteilung). Die neue `shuffle()`-Funktion iteriert einmal rückwärts und
  vertauscht jedes Element mit einem zufälligen vorherigen — über 200.000 simulierte Läufe zeigt
  jede Position eine Trefferquote innerhalb von ±1 % des Erwartungswerts.
- **`waterTargetMlOverride` von `Profile` auf `User` verschoben.** Vorher warf
  `setTargetOverride` einen `409 Conflict`, wenn noch kein `Profile` existierte — ein eigenes
  Wasserziel setzen zu wollen hat aber inhaltlich nichts mit Gewicht/Größe/Alter/Geschlecht zu
  tun, die für ein vollständiges `Profile` Pflichtfelder sind (siehe Phase 8). `User` existiert
  dagegen immer für einen eingeloggten Nutzer, also lebt das Override-Feld jetzt dort (Migration
  `20260826190000_move_water_target_to_user`, bestehende Werte per `UPDATE ... FROM` übernommen,
  bevor die alte Spalte gelöscht wird). `setTargetOverride` braucht dadurch keinen
  Existenz-Check und keinen Fehlerpfad mehr — der `try/catch` in `water.routes.ts` fiel
  ersatzlos weg. `getTargetMl` liest jetzt `User` (Override) und `Profile` (gewichtsbasierter
  Vorschlag) parallel per `Promise.all`, statt wie vorher nur `Profile`. End-to-end verifiziert:
  `PUT /water/target` liefert `200`/`isCustomTarget: true`, obwohl `GET /profile` `null` liefert.

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

## Mini-PC-Deployment (Phase 7, deployed — DNS-Propagation ausstehend)

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
  liegen außerhalb des Repos, siehe `context.md`. Repo-Zugriff selbst läuft über einen separaten,
  read-only GitHub Deploy Key (nicht den persönlichen Zugang des Nutzers) — ein eigener Key pro
  Repo, damit ein kompromittierter Mini-PC nie mehr als Lesezugriff auf ein einzelnes Repo hätte.
- **Vier reale Bugs beim allerersten echten Prod-Docker-Build gefunden** — vorheriges "Config
  validiert" in früheren Sessions hatte nie tatsächlich `docker compose -f
  docker-compose.prod.yml up --build` laufen lassen, nur den lokalen Dev-Stack. Alle vier
  gefixt und committed, festgehalten hier, weil sie beim Onboarding der nächsten drei PWAs
  (siehe `/home/basti/addURLtotree.md`) mit hoher Wahrscheinlichkeit identisch wieder auftreten:
  1. `prisma`-CLI stand in `devDependencies` statt `dependencies` — der Runtime-Stage-Install
     läuft mit `--prod`, wirft Dev-Deps weg, `pnpm prisma:deploy` im Boot-`CMD` fand das Binary
     nicht mehr.
  2. Alpine-Basis-Image hatte kein `openssl` installiert — Prismas Engine-Binaries linken
     dynamisch gegen libssl, das Alpine nicht mitbringt (Node bringt nur sein eigenes, statisch
     gelinktes OpenSSL mit, das anderen Prozessen nicht hilft). Fix: `RUN apk add --no-cache
     openssl` in der `base`-Stage.
  3. Der `--prod`-Install im Runtime-Stage ist ein **frischer** Install (übernimmt nicht die
     `node_modules` der Build-Stage), und `@prisma/client`s eigenes Postinstall-Skript findet das
     Schema in diesem Monorepo-Layout nicht automatisch — der generierte Client fehlte zur
     Laufzeit komplett ("`@prisma/client did not initialize yet`"). Fix: `prisma generate`
     explizit im Boot-`CMD`, nicht nur `migrate deploy`.
  4. `packages/shared`s `package.json` zeigte `main`/`exports` direkt auf rohe `.ts`-Quellen
     (`./src/index.ts`) mit intern `.js`-referenzierten Imports — funktioniert nur unter
     TS-bewussten Loadern (`tsx` im Dev, Vite im Frontend-Build), bricht unter reinem `node`
     (Prod-Backend-Container) mit `ERR_MODULE_NOT_FOUND`, weil die referenzierte `.js`-Datei nie
     existierte. Fix: `packages/shared` bekommt einen echten `tsc`-Build (`main`/`types`/`exports`
     zeigen jetzt auf `./dist/`), eingebunden in beide Dockerfiles und die Root-`dev`/`build`-
     Skripte, damit das für Backend, Frontend und lokale Entwicklung gleichermaßen automatisch
     passiert.

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
- `WorkoutLog` — Satz/Wiederholungen/Gewicht/Übung, `clientId` für Offline-Idempotenz, Soft-Delete,
  `rir` + `supersetGroupId` (siehe Phase 20, fertig)
- `TrainingPlan` + `TrainingPlanPhaseHistory` — 8-Wochen-Rotation, `pausedAt` fürs Pausieren des
  Rotations-Countdowns (siehe oben, fertig — Phase 23)
- `Goal` — Zielsetzung (siehe oben, fertig)
- `PushSubscription` — Web-Push-Abos (siehe oben, fertig)
- `Profile` — Eingaben für den Ernährungsrechner (siehe oben, fertig); `waterTargetMlOverride`
  lebt seit Phase 18 auf `User`, nicht mehr hier
- `WaterLog` — Tages-Running-Total pro Nutzer (siehe oben, fertig)
- `DailyChallengeItem` — Tages-Challenge-Übungen + Fortschritt (siehe oben, fertig)
- `Supplement` — Erinnerungsliste + Zeitzone + letzter Versand (siehe oben, fertig)
- `BodyCompositionEntry` — Waagen-Messungen als Verlauf (siehe oben, fertig)
- `ProgressPhoto` — Metadaten für auf der Platte gespeicherte Vergleichsfotos (siehe oben, fertig)
- `AiProviderSetting` — BYOK-Anbieter/verschlüsselter API-Key/Modell-Override pro Nutzer (siehe
  Phase 19, fertig)
- `CardioLog` — Gerät/Stufe/Intensität/Dauer, Soft-Delete, kein Bezug zu `PlanExercise` (siehe
  Phase 21, fertig)
- `WorkoutSession` — Start/Pause/Fortsetzen/Abbrechen/Abschließen-Lifecycle, `clientId` für
  Offline-Idempotenz wie `WorkoutLog`, kein Bezug zu `WorkoutLog` (siehe Phase 22, fertig)

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

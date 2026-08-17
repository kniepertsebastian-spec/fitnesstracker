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

## Offline-first (Roadmap-Phase, Datenmodell bereits vorbereitet)

Da die App explizit auf dem iPhone als installierte PWA laufen soll, scheidet die native
Background-Sync-API des Browsers aus — sie wird von iOS Safari nicht (zuverlässig) unterstützt.
Geplanter Ansatz: IndexedDB via Dexie.js als lokaler Store, jeder Workout-Log-Eintrag bekommt
clientseitig eine UUID (`clientId`, bereits im Schema und in der API als Idempotenz-Schlüssel
angelegt), ein eigener Sync-Manager beobachtet `online`/`offline`-Events und flusht die
Mutations-Queue per Upsert-by-`clientId` zum Backend, sobald wieder eine Verbindung besteht.

## Push-Benachrichtigungen (Roadmap-Phase)

Web Push mit VAPID-Keys — funktioniert auf iOS 16.4+ bei zum Homescreen hinzugefügten PWAs. Ein
Backend-Scheduler prüft für jeden Nutzer das `phaseStartedOn`-Datum des Trainingsplans und rotiert
die Phase automatisch 8 Wochen später, immer an einem Montag, und löst dabei eine
Push-Benachrichtigung aus.

## Claude-API-Integration (Roadmap-Phase)

Für effiziente Übungsauswahl und Zielsetzung, hinter dem Flag `CLAUDE_API_ENABLED` — bleibt
deaktiviert, bis ein API-Key hinterlegt ist, blockiert also nicht den Rest der Roadmap.

## Datenmodell

Siehe [`backend/prisma/schema.prisma`](./backend/prisma/schema.prisma). Bereits vollständig
angelegt (auch für Modelle ohne UI in dieser Phase), damit spätere Phasen additiv bleiben und keine
Breaking-Migrationen nötig werden:

- `User`, `RefreshToken` — Auth
- `Exercise` — Name, Beschreibung, Video-URL (Bibliothek kommt in Phase 1)
- `WorkoutLog` — Satz/Wiederholungen/Gewicht/Übung, `clientId` für Offline-Idempotenz, Soft-Delete
- `TrainingPlan` + `TrainingPlanPhaseHistory` — 8-Wochen-Rotation (Phase 2)
- `Goal` — Zielsetzung (Phase 3)
- `PushSubscription` — Web-Push-Abos (Phase 5)

## Bekannte Stolperfallen (bereits berücksichtigt)

- Fastify-Plugin-Reihenfolge: Prisma/JWT/Cookie-Plugins sind mit `fastify-plugin` (`fp()`)
  gewrappt, damit ihre Decorations nicht durch Fastifys Encapsulation verloren gehen.
- Prisma `Decimal` wird vor der JSON-Antwort explizit in `Number` konvertiert
  (`workoutLog.types.ts`), sonst serialisiert es sich nicht sauber.
- `POST /workout-logs` ist ein `upsert` by `clientId`, kein `create` — ein wiederholter Submit
  (z. B. durch die künftige Offline-Sync-Queue) gibt den bestehenden Datensatz mit `200` zurück
  statt einen Unique-Constraint-Fehler zu werfen.
- Der Service Worker cached API-Antworten nie (`NetworkOnly` für `/api/**`), damit nach einem
  Deploy niemand einen veralteten Workout-Log aus dem Cache sieht.
- iOS Safari kennt kein `beforeinstallprompt` — jede zukünftige "Installieren"-UI muss die manuelle
  Share-→-Zum-Home-Bildschirm-Anleitung zeigen, kein Chrome-Style-Install-Button.

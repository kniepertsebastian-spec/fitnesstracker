# Fitnesstracker

Ein werbefreier, persönlicher Fitnesstracker als installierbare PWA. Sätze/Wiederholungen/Gewicht
pro Übung protokollieren, Trainingsplan-Phasen rotieren automatisch alle 8 Wochen, offline nutzbar
mit Sync sobald wieder online. Siehe [`ARCHITECTURE.md`](./ARCHITECTURE.md) für die technischen
Entscheidungen und [`ROADMAP.md`](./ROADMAP.md) für den vollständigen Ausbauplan.

Aktueller Stand (Phasen 0–14 abzüglich 6/7 – Foundation, Übungsbibliothek,
Trainingsplan-Rotation, Ziele (inkl. automatischer Vorschläge), Offline-Sync, Push,
Ernährungsrechner, Wasser-Tracking, Supplement-Erinnerungen, Körperkomposition-Tracking,
Fortschritts-Fotos & Tages-Challenge): Login/Registrierung, die Trainings-Tabelle
(Satz/Wiederholungen/Gewicht/Übung, inklusive Offline-Nutzung mit automatischer Sync sobald
wieder online), die Übungsbibliothek (durchsuchen, nach Muskelgruppe/Equipment filtern,
Detailansicht), die automatische 8-Wochen-Trainingsplan-Rotation (Aufbau → Muskelausdauer →
Negativ), Ziele (Gewicht/Wiederholungen pro Übung mit automatischem Fortschritt,
Körpergewicht/Sonstiges mit manueller Erreicht-Markierung, dazu automatisch vorgeschlagene
Gewichts-Ziele mit realistischem Zieldatum basierend auf der bisherigen Trainings-Progression),
Push-Erinnerungen bei Trainingsplan-Wechsel, ein Profil-/Ernährungsrechner
(Kalorien-/Proteinbedarf nach Mifflin-St-Jeor), ein täglicher Wasser-Zähler, eigene
Supplement-Erinnerungen (tägliche Push-Erinnerung zur lokalen Uhrzeit) mit statischer
Referenzliste, manuelles Körperkomposition-Tracking (Gewicht/Körperfett/Muskelmasse/
Wasseranteil mit Trend-Anzeige), private Fortschritts-Fotos (Upload, Galerie, Vorher/Nachher-
Vergleich, wöchentliche Push-Erinnerung, Speicherung auf dem eigenen VPS-Dateisystem) und eine
tägliche Bodyweight-Challenge (3 Zufallsübungen ohne Geräte, aus dem importierten Katalog) sind
Ende-zu-Ende lauffähig. Die Übungs-API liefert dafür volle CRUD-Verwaltung plus einen
Import-Mechanismus, der Übungen aus externen, frei verfügbaren Datenbanken zieht und in die
eigene DB schreibt (siehe unten). Claude-API-Integration ist als Datenmodell bereits angelegt,
aber noch ohne UI; VPS-Politur/Deployment (Phase 7) steht noch aus (siehe Roadmap).

## Stack

- **Datenbank**: PostgreSQL
- **Backend**: Node.js, TypeScript, Fastify, Prisma
- **Frontend**: React, TypeScript, Vite, Tailwind CSS, TanStack Query, vite-plugin-pwa
- **Monorepo**: pnpm workspaces (`backend/`, `frontend/`, `packages/shared/`)
- **Deployment**: Docker Compose + Caddy (automatisches HTTPS) auf einem eigenen VPS

## Voraussetzungen

- Node.js ≥ 20, pnpm ≥ 9
- PostgreSQL 16 (lokal installiert oder via Docker)
- Docker + Docker Compose (für den vollständigen Dev-Stack bzw. Deployment)

## Lokale Entwicklung

```bash
pnpm install
cp .env.example .env   # Werte anpassen, insbesondere SETUP_TOKEN und die JWT-Secrets
```

### Variante A: Postgres + Backend über Docker, Frontend auf dem Host (empfohlen für Dev)

```bash
docker compose up -d postgres backend
pnpm --filter backend prisma:seed   # einmalig: Beispiel-Übungen anlegen
pnpm --filter frontend dev          # http://localhost:5173, proxied /api zum Backend
```

### Variante B: Alles lokal ohne Docker

```bash
# eigene Postgres-Instanz vorausgesetzt, DATABASE_URL in .env entsprechend anpassen
pnpm --filter backend prisma:migrate
pnpm --filter backend prisma:seed
pnpm --filter backend dev     # http://localhost:3000
pnpm --filter frontend dev    # http://localhost:5173 (in einem zweiten Terminal)
```

Registrierung erfordert das `SETUP_TOKEN` aus der `.env` (schützt die offene Registrierung auf
einem öffentlich erreichbaren VPS, da die App nur für dich gedacht ist). Das Zurücksetzen eines
Passworts („Passwort vergessen“) braucht ein eigenes `RESET_TOKEN` (mindestens 16 Zeichen,
verschieden vom `SETUP_TOKEN`); ohne gesetztes `RESET_TOKEN` ist der Reset abgeschaltet. So kann
jemand, dem du das `SETUP_TOKEN` zum Registrieren gibst, kein fremdes Konto übernehmen.

Eigene Übungen sind privat: Sie sind nur für das Konto sichtbar und änderbar, das sie angelegt hat.
Der Übungskatalog (importierte Übungen) ist für alle sichtbar, darf aber nur vom Betreiberkonto
importiert und geändert werden. Das ist das Konto aus `OPERATOR_EMAIL` in der `.env`; ist die
Variable leer, gilt das älteste Konto (das mit dem `SETUP_TOKEN` angelegte).

## Übungen importieren

Statt Übungen von Hand zu pflegen, gibt es einen Import-Endpunkt, der einen kompletten
Übungskatalog aus einer externen Quelle zieht und per Upsert (idempotent, anhand von
Quelle+externer-ID) in die eigene DB schreibt — mehrfaches Ausführen legt nichts doppelt an,
sondern aktualisiert nur:

```bash
# Verfügbare Quellen auflisten
curl -H "Authorization: Bearer $ACCESS_TOKEN" http://localhost:3000/api/exercises/sources

# Import anstoßen (aktuell: "free-exercise-db", ~870 Übungen, dauert wenige Sekunden)
curl -X POST http://localhost:3000/api/exercises/import \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H 'Content-Type: application/json' \
  -d '{"source":"free-exercise-db"}'
```

Neue Quellen anbinden: `ExerciseSourceAdapter` in `backend/src/modules/exercises/sources/`
implementieren (Interface in `sources/types.ts`) und in `sources/index.ts` registrieren — der
Import-Endpunkt braucht dafür keine Änderung. Details und Quellen-Übersicht in
[`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Produktions-Deployment (Mini-PC hinter Cloudflare Tunnel)

Läuft neben mehreren anderen PWAs auf derselben Maschine, deshalb kein VPS mit eigenem
Caddy auf Port 80/443, sondern ein geteilter Cloudflare Tunnel als Edge (Details/Begründung in
`ARCHITECTURE.md` und `context.md`): Caddy in diesem Repo dient nur noch same-origin
Frontend+API und lauscht rein intern auf `:80` im gemeinsamen Docker-Netzwerk `edge` — TLS
terminiert bei Cloudflare, nicht hier.

```bash
docker network create edge   # einmalig pro Maschine, wird von allen PWAs geteilt
cp .env.example .env         # echte Secrets + DOMAIN setzen (die volle Subdomain, z. B. fitness.example.com)
docker build --target export -f frontend/Dockerfile --output frontend/dist .
docker compose -f docker-compose.prod.yml up -d --build
```

Voraussetzung: ein separat laufender `cloudflared`-Container (nicht Teil dieses Repos, eine
Ebene darüber für alle PWAs gemeinsam) mit einer Public-Hostname-Route von `DOMAIN` auf
`http://fitnesstracker-caddy:80`. Kein DNS-A-Record, kein offener Port am Router nötig.

### Backup und Restore

Nicht aus Git wiederherstellbar sind die Datenbank (Volume `pgdata`) und die Fotos (Volume
`uploads`). `scripts/backup.sh` sichert beides in einen Ordner mit Zeitstempel, löscht
Sicherungen nach 14 Tagen (`BACKUP_KEEP_DAYS`) und kopiert auf Wunsch auf ein zweites Gerät
(`BACKUP_REMOTE`, per rsync). Ein Backup, das nur auf dem Mini-PC liegt, schützt nicht vor einem
Ausfall des Mini-PCs.

```bash
# Einmal von Hand (Datenbank-Dump + Foto-Archiv):
BACKUP_REMOTE=user@anderer-rechner:/backups/fitness/ scripts/backup.sh
```

Nächtlich per Cron (`crontab -e` auf dem Mini-PC, 03:30 Uhr):

```bash
30 3 * * * cd /pfad/zu/fitnesstracker && BACKUP_REMOTE=user@anderer-rechner:/backups/fitness/ scripts/backup.sh >> ~/fitnesstracker-backups/backup.log 2>&1
```

Optional: `BACKUP_GPG_RECIPIENT=<Schlüssel>` verschlüsselt beide Dateien, bevor sie den Rechner
verlassen (zum Wiederherstellen vorher mit `gpg --decrypt` entschlüsseln).

**Restore proben (ohne Livedaten anzufassen).** In eine neue, leere Datenbank wiederherstellen und
nachzählen:

```bash
scripts/restore.sh ~/fitnesstracker-backups/<Zeitstempel> restore_probe
docker compose -f docker-compose.prod.yml exec postgres sh -c 'psql -U "$POSTGRES_USER" -d restore_probe -c "SELECT count(*) FROM \"User\""'
docker compose -f docker-compose.prod.yml exec postgres sh -c 'dropdb -U "$POSTGRES_USER" restore_probe'
```

**Echter Restore** (überschreibt Datenbank und Fotos; fragt zur Sicherheit nach dem Datenbanknamen,
hält das Backend an und startet es danach wieder):

```bash
scripts/restore.sh ~/fitnesstracker-backups/<Zeitstempel>
```

## Nützliche Skripte

| Befehl | Beschreibung |
| --- | --- |
| `pnpm --filter backend prisma:migrate` | Neue Migration erstellen/anwenden (Dev) |
| `pnpm --filter backend prisma:deploy` | Migrationen anwenden (Prod) |
| `pnpm --filter backend prisma:seed` | Beispiel-Übungen einspielen |
| `pnpm typecheck` | TypeScript-Check in allen Packages |
| `pnpm build` | Backend + Frontend bauen |

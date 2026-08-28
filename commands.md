# Commands: Container neu bauen & starten

Praktische Befehlssammlung fürs Deployment. Hintergrund/Begründung siehe `README.md`
("Produktions-Deployment") und `ARCHITECTURE.md` ("Mini-PC-Deployment").

## Produktion (Mini-PC hinter Cloudflare Tunnel)

### Einmalig pro Maschine

```bash
docker network create edge   # wird von allen PWAs auf der Maschine geteilt
```

### Voller Rebuild + Neustart (Standardfall nach einem Deploy)

```bash
cd /pfad/zum/repo
git pull

# Frontend separat bauen (Build-only-Image, Output liegt danach unter frontend/dist/,
# von Caddy als Static Files served — kein eigener Frontend-Container)
docker build --target export -f frontend/Dockerfile --output frontend/dist .

# Postgres, Backend, Caddy bauen (falls nötig) und starten/neu starten
docker compose -f docker-compose.prod.yml up -d --build
```

Migrationen (`prisma migrate deploy`) und `prisma generate` laufen automatisch beim Boot des
Backend-Containers (`CMD` in `backend/Dockerfile`) — kein separater Schritt nötig.

### Sauberer Neustart (bei hängenden/verwaisten Containern)

```bash
docker compose -f docker-compose.prod.yml down --remove-orphans
docker build --target export -f frontend/Dockerfile --output frontend/dist .
docker compose -f docker-compose.prod.yml up -d --build
```

### Nur einen Service neu bauen/starten

```bash
docker compose -f docker-compose.prod.yml up -d --build backend
docker compose -f docker-compose.prod.yml up -d --build caddy
```

### Nur neu starten, ohne neu zu bauen (z. B. nach `.env`-Änderung)

```bash
docker compose -f docker-compose.prod.yml up -d
```

### Stoppen

```bash
docker compose -f docker-compose.prod.yml down          # Container stoppen, Volumes bleiben
docker compose -f docker-compose.prod.yml down -v        # Vorsicht: löscht auch Volumes (DB-Daten!)
```

### Logs / Status

```bash
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f caddy
docker compose -f docker-compose.prod.yml ps
```

### Migrationen manuell prüfen/anwenden (normalerweise nicht nötig, siehe oben)

```bash
docker compose -f docker-compose.prod.yml exec backend pnpm prisma:deploy
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate status
```

## Lokale Entwicklung (Postgres + Backend via Docker)

```bash
docker compose up -d postgres backend
pnpm --filter frontend dev          # http://localhost:5173, läuft NICHT im Container
```

```bash
docker compose up -d --build postgres backend   # neu bauen + starten
docker compose down                              # stoppen
docker compose logs -f backend                   # Logs
```

## Voraussetzungen für Prod

- `.env` mit echten Secrets + `DOMAIN` (volle Subdomain, z. B. `fitness.example.com`) —
  Vorlage in `.env.example`
- Separat laufender `cloudflared`-Container (nicht Teil dieses Repos) mit Public-Hostname-Route
  von `DOMAIN` auf `http://fitnesstracker-caddy:80`

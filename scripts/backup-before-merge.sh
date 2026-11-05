#!/usr/bin/env bash
# Snapshots the files that would be most painful to lose or corrupt (DB schema/migrations, env
# config, deployment compose files, the tracked roadmap/architecture docs) before merging to
# main. Output goes to .backups/, which is gitignored — never committed, purely a local safety
# net for this session's own force-with-lease pushes and merges.
set -euo pipefail
cd "$(dirname "$0")/.."

TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
OUT_DIR=".backups/${TIMESTAMP}"
mkdir -p "$OUT_DIR"

FILES=(
  backend/prisma/schema.prisma
  backend/.env
  frontend/.env
  docker-compose.yml
  docker-compose.prod.yml
  ROADMAP.md
  ARCHITECTURE.md
  roadmap2.md
)

for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then
    mkdir -p "$OUT_DIR/$(dirname "$f")"
    cp "$f" "$OUT_DIR/$f"
  fi
done

if [ -d backend/prisma/migrations ]; then
  mkdir -p "$OUT_DIR/backend/prisma"
  cp -r backend/prisma/migrations "$OUT_DIR/backend/prisma/migrations"
fi

echo "Backup written to $OUT_DIR"

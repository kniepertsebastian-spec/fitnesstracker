#!/usr/bin/env bash
# Restores a backup made by scripts/backup.sh.
#
#   scripts/restore.sh <backup-folder> [database-name]
#
# The database goes into `database-name` (default: the app's own database, which OVERWRITES it).
# To rehearse a restore without touching live data, pass a new name: it is created if missing.
# Uploads are only restored when the target is the app's own database.
set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
compose() { docker compose -f "$COMPOSE_FILE" "$@"; }

src="${1:?usage: scripts/restore.sh <backup-folder> [database-name]}"
[ -f "$src/database.sql.gz" ] || { echo "No database.sql.gz in $src (encrypted backups: gpg --decrypt first)." >&2; exit 1; }

live_db=$(compose exec -T postgres sh -c 'printf %s "$POSTGRES_DB"')
db="${2:-$live_db}"

if [ "$db" = "$live_db" ]; then
  echo "This overwrites the live database '$db' and the uploads. Type the database name to continue:"
  read -r answer
  [ "$answer" = "$db" ] || { echo "Aborted."; exit 1; }
  compose stop backend
else
  compose exec -T postgres sh -c "psql -U \"\$POSTGRES_USER\" -d postgres -tc \"SELECT 1 FROM pg_database WHERE datname='$db'\" | grep -q 1 || createdb -U \"\$POSTGRES_USER\" '$db'"
fi

echo "Restoring database into '$db'..."
gzip -dc "$src/database.sql.gz" \
  | compose exec -T postgres sh -c "psql -U \"\$POSTGRES_USER\" -d '$db' -v ON_ERROR_STOP=1 -q"

if [ "$db" = "$live_db" ]; then
  if [ -f "$src/uploads.tar.gz" ]; then
    echo "Restoring uploads..."
    compose run --rm --no-deps -T --entrypoint sh backend -c 'tar -xz -C /app/backend && chown -R node:node /app/backend/uploads' < "$src/uploads.tar.gz"
  fi
  compose start backend
fi
echo "Restore finished."

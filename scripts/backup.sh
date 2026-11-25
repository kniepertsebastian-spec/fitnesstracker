#!/usr/bin/env bash
# Nightly backup of everything that cannot be rebuilt from git: the Postgres database (shared by
# the Fitnesstracker and the Kalorientracker), the `uploads` volume (progress photos, cached exercise
# images) and the `media` volume (nutrition photos, cookbook pages). Run it on the host that runs
# docker-compose.prod.yml, e.g. from cron (see README, "Backup und Restore").
#
#   scripts/backup.sh                 # writes to $BACKUP_DIR (default: ~/fitnesstracker-backups)
#
# Environment (all optional):
#   BACKUP_DIR         where the dated folders go
#   BACKUP_KEEP_DAYS   retention in days (default 14)
#   BACKUP_REMOTE      copy target for a second device, handed to rsync, e.g. user@nas:/backups/fitness/
#                      A backup that only lives on the same machine is not a backup.
#   BACKUP_GPG_RECIPIENT  encrypt both files for this GPG key before they leave the box
#   COMPOSE_FILE       compose file (default docker-compose.prod.yml)
#   COMPOSE_PROJECT_NAME  compose project, if this checkout's folder name differs from it
set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/fitnesstracker-backups}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
compose() { docker compose -f "$COMPOSE_FILE" "$@"; }

stamp=$(date -u +%Y%m%dT%H%M%SZ)
target="$BACKUP_DIR/$stamp"
mkdir -p "$target"
# Half-written backups must not look like finished ones.
trap 'rm -rf "$target"' ERR

echo "Dumping database..."
compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' \
  | gzip > "$target/database.sql.gz"

echo "Archiving uploads..."
compose exec -T backend tar -C /app/backend -cz uploads > "$target/uploads.tar.gz"
files=(database.sql.gz uploads.tar.gz)

# The media volume exists since the Kalorientracker; tmp/ (inputs of running AI jobs) is skipped.
if compose exec -T backend test -d /app/backend/media; then
  echo "Archiving media..."
  compose exec -T backend tar -C /app/backend --exclude=media/tmp -cz media > "$target/media.tar.gz"
  files+=(media.tar.gz)
fi

# A dump that is empty or not a valid gzip stream fails here instead of at restore time.
(cd "$target" && gzip -t "${files[@]}")
if [ "$(gzip -dc "$target/database.sql.gz" | wc -c)" -lt 1000 ]; then
  echo "Database dump is suspiciously small — aborting." >&2
  exit 1
fi

if [ -n "${BACKUP_GPG_RECIPIENT:-}" ]; then
  for f in "${files[@]}"; do
    gpg --batch --yes --trust-model always --encrypt --recipient "$BACKUP_GPG_RECIPIENT" --output "$target/$f.gpg" "$target/$f"
    rm "$target/$f"
  done
fi
trap - ERR

find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -mtime "+$KEEP_DAYS" -exec rm -rf {} +

if [ -n "${BACKUP_REMOTE:-}" ]; then
  echo "Copying to $BACKUP_REMOTE ..."
  rsync -a --delete "$BACKUP_DIR/" "$BACKUP_REMOTE"
else
  echo "Warning: BACKUP_REMOTE is not set — this backup is only on this machine." >&2
fi

echo "Backup written to $target"

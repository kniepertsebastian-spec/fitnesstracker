#!/bin/sh
# The container starts as root only to hand the uploads and media volumes (created by older
# versions or fresh by Docker as root) over to the unprivileged `node` user; everything else — migrations, the Prisma client
# generation and the server itself — runs as `node`.
set -e

if [ "$(id -u)" = "0" ]; then
  UPLOADS="${UPLOADS_DIR:-./uploads}"
  MEDIA="${MEDIA_DIR:-./media}"
  mkdir -p "$UPLOADS" "$MEDIA"
  chown -R node:node "$UPLOADS" "$MEDIA"
  exec su-exec node "$@"
fi

# Already started unprivileged (e.g. `docker run --user node`): the volumes have to be writable.
exec "$@"

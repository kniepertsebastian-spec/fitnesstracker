#!/bin/sh
# The container starts as root only to hand the uploads volume (created by older versions as
# root) over to the unprivileged `node` user; everything else — migrations, the Prisma client
# generation and the server itself — runs as `node`.
set -e

if [ "$(id -u)" = "0" ]; then
  UPLOADS="${UPLOADS_DIR:-./uploads}"
  mkdir -p "$UPLOADS"
  chown -R node:node "$UPLOADS"
  exec su-exec node "$@"
fi

# Already started unprivileged (e.g. `docker run --user node`): the volume has to be writable.
exec "$@"

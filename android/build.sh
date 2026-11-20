#!/usr/bin/env bash
# Builds the Android app (Trusted Web Activity around the PWA). Needs Docker, nothing else.
#
#   android/build.sh                      # domain from DOMAIN or ../.env
#   VERSION_CODE=2 VERSION_NAME=1.1.0 android/build.sh
#
# Results in android/out/: fitnesstracker.apk (to install), fitnesstracker.aab (for the Play Store) and
# fingerprint.txt. The signing key lives in ~/.fitnesstracker-android (override: ANDROID_KEYS_DIR) — back it
# up and never commit it: an app can only be updated with the key it was first signed with.
set -euo pipefail
cd "$(dirname "$0")"

HOST="${DOMAIN:-$(grep -E '^DOMAIN=' ../.env 2>/dev/null | cut -d= -f2- | tr -d '\r"' || true)}"
if [ -z "$HOST" ]; then
  echo "Set DOMAIN (e.g. DOMAIN=fitness.example.com) or put it in the repo's .env." >&2
  exit 1
fi
KEYS_DIR="${ANDROID_KEYS_DIR:-$HOME/.fitnesstracker-android}"
OUT_DIR="${ANDROID_OUT_DIR:-$PWD/out}"
mkdir -p "$KEYS_DIR" "$OUT_DIR"
chmod 700 "$KEYS_DIR"

docker build -t fitnesstracker-android-build .
docker run --rm \
  -e HOST="$HOST" -e HOST_UID="$(id -u)" -e HOST_GID="$(id -g)" -e VERSION_NAME="${VERSION_NAME:-1.0.0}" -e VERSION_CODE="${VERSION_CODE:-1}" \
  -v "$KEYS_DIR:/keys" -v "$OUT_DIR:/out" -v "$PWD:/src:ro" \
  fitnesstracker-android-build sh /src/inside.sh

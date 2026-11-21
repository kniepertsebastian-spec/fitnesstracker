#!/bin/sh
# Runs inside the build container (see build.sh). Makes the signing key on first use, generates the Android
# project from twa-manifest.template.json, builds the signed APK and the Play Store bundle, and prints the
# fingerprint the website has to publish in /.well-known/assetlinks.json.
set -eu

: "${HOST:?HOST (the site's domain) is required}"
VERSION_NAME="${VERSION_NAME:-1.0.0}"
VERSION_CODE="${VERSION_CODE:-1}"
KEYSTORE=/keys/android.keystore
PASSFILE=/keys/keystore.pass

if [ ! -f "$KEYSTORE" ]; then
  echo "Creating the signing key (once). Keep /keys safe: every update of the app has to be signed with it."
  tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 28 > "$PASSFILE"
  chmod 600 "$PASSFILE"
  keytool -genkeypair -v -keystore "$KEYSTORE" -alias fitnesstracker -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$(cat "$PASSFILE")" -keypass "$(cat "$PASSFILE")" -dname "CN=Fitnesstracker, O=Fitnesstracker, C=DE" > /dev/null
  chmod 600 "$KEYSTORE"
fi
PASS="$(cat "$PASSFILE")"

rm -rf /work/project
mkdir -p /work/project
sed -e "s#__HOST__#${HOST}#g" -e "s#__VERSION_NAME__#${VERSION_NAME}#g" -e "s#__VERSION_CODE__#${VERSION_CODE}#g" \
  /src/twa-manifest.template.json > /work/project/twa-manifest.json
cd /work/project

# Generates the Gradle project from twa-manifest.json (the icons are fetched from the live site).
bubblewrap update --skipVersionUpgrade --manifest=/work/project/twa-manifest.json
BUBBLEWRAP_KEYSTORE_PASSWORD="$PASS" BUBBLEWRAP_KEY_PASSWORD="$PASS" bubblewrap build --skipPwaValidation --manifest=/work/project/twa-manifest.json

mkdir -p /out
cp app-release-signed.apk /out/fitnesstracker.apk
[ -f app-release-bundle.aab ] && cp app-release-bundle.aab /out/fitnesstracker.aab
echo
echo "SHA-256 fingerprint of the signing key (goes into /.well-known/assetlinks.json):"
keytool -list -v -keystore "$KEYSTORE" -alias fitnesstracker -storepass "$PASS" | grep "SHA256:" | sed 's/^ *//' | tee /out/fingerprint.txt

# The container runs as root; hand the results back to the user who started it.
chown -R "${HOST_UID:-0}:${HOST_GID:-0}" /out /keys

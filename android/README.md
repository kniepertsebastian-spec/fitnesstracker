# Android-App

Die Android-App ist eine **Trusted Web Activity** (TWA): eine schlanke App-Hülle, die die vorhandene PWA
im Vollbild öffnet — ohne Adressleiste, mit eigenem Icon, Eintrag in der App-Liste und Push-Benachrichtigungen.
Die PWA selbst bleibt unverändert und weiter installierbar; die App zeigt immer die aktuelle Version der Website,
ein App-Update ist nur bei Änderungen an der Hülle selbst nötig (Icon, Name, Farben, Version).

Gebaut wird mit [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) in einem Docker-Container, auf dem
Rechner ist nur Docker nötig.

## APK bauen

```bash
android/build.sh                      # Domain aus DOMAIN oder aus der .env im Repo
```

Ergebnis in `android/out/`:

- `fitnesstracker.apk` – zum Installieren auf dem Handy (Datei übertragen, „Apps aus unbekannten Quellen“ erlauben)
- `fitnesstracker.aab` – für den Play Store (falls je gewünscht)
- `fingerprint.txt` – SHA-256-Fingerabdruck des Signierschlüssels

Beim allerersten Lauf wird der **Signierschlüssel** in `~/.fitnesstracker-android` angelegt (`ANDROID_KEYS_DIR`
ändert den Ort). Er gehört **nicht** ins Repository und muss gesichert werden: Ein Update einer installierten App
funktioniert nur mit demselben Schlüssel.

Neue Version der Hülle: `VERSION_CODE=2 VERSION_NAME=1.1.0 android/build.sh` (der Code muss bei jedem Bau, der
installiert werden soll, höher sein als der vorherige).

## Damit die Adressleiste verschwindet: assetlinks.json

Chrome prüft beim Start, ob die Website die App als zugehörig bestätigt. Dafür liefert die Website unter
`/.well-known/assetlinks.json` den Fingerabdruck des Signierschlüssels aus (`frontend/public/.well-known/assetlinks.json`,
vom Frontend-Build mitgenommen und von Caddy statisch ausgeliefert). Ohne diese Bestätigung läuft die App trotzdem,
zeigt aber oben eine Adressleiste.

Der Fingerabdruck in dieser Datei muss zu `fingerprint.txt` passen. Wird ein neuer Schlüssel angelegt, die Datei
anpassen und das Frontend neu bauen.

Prüfen, ob die Seite die Datei richtig ausliefert:

```bash
curl -sI https://<domain>/.well-known/assetlinks.json   # 200 und content-type: application/json
```

## Was die App kann und was nicht

- Push-Benachrichtigungen laufen weiter über Web Push; Chrome reicht sie an die App weiter (Benachrichtigungen
  in den Android-Einstellungen der App erlauben).
- Die App öffnet `https://<domain>/` und die Abkürzungen (Training starten, Daily, Fortschritt) beim langen
  Drücken des Icons.
- Offline funktioniert, was die PWA offline kann (Service Worker, lokaler Katalog, Trainings-Sync).
- **Nicht** möglich ohne eine native Hülle mit Plugins: Health Connect und andere native Schnittstellen. Dafür
  wäre ein Wechsel auf Capacitor nötig; die Website bliebe trotzdem die Grundlage.

## Aufbau

| Datei | Zweck |
|---|---|
| `Dockerfile` | JDK 17, Android SDK, Node, Bubblewrap |
| `twa-manifest.template.json` | Name, Icons, Farben, Abkürzungen, Paketname `de.pwatree.fitness` |
| `inside.sh` | läuft im Container: Schlüssel anlegen, Projekt erzeugen, APK/AAB bauen |
| `build.sh` | startet das Ganze auf dem Rechner |

# PWA-Review: Fitnesstracker

**Stand:** 12.11.2026 · Commit `4d29554e` (main)
**Umfang:** Gesamtes Monorepo (518 getrackte Dateien): Backend (Fastify 5, Prisma 6, PostgreSQL 16, 115 API-Routen in 24 Modulen), Frontend (React 19, Vite 8, Tailwind 4, vite-plugin-pwa, Dexie), `packages/shared`, Dockerfiles, Compose, Caddyfile, CI. Zusätzlich die App lokal gebaut, mit Testdaten befüllt und alle 14 Routen bei 390 px und 320 px Breite im Browser durchgeklickt.
**Ergebnis:** Technisch ein überdurchschnittlich sauberes Projekt (Tests, CI, Security-Header, kontogetrennter Offline-Sync). Die Schwächen liegen in der Auslieferung (der ungestylte Stand aus dem Screenshot konnte unbemerkt live gehen), im Betrieb (kein Backup) und in der mobilen UI-Politur. · Kritisch: 0 · Hoch: 1 · Mittel: 7 · Niedrig: 14 · Hinweis: 2

**Gesamtnote: 7 / 10** (Begründung am Ende)

---

## Der Screenshot: warum die App ungestylt ist

Das Bild zeigt die Login-Seite ohne Tailwind: Serifenschrift, kein Layout, keine Karte, aber dunkler Hintergrund und die Lichtwelle. Genau so sieht die App aus, wenn Tailwind beim Build nicht gelaufen ist. Der dunkle Hintergrund kommt aus dem handgeschriebenen `:root`/`body`-CSS in `frontend/src/styles/index.css`, die Welle ist ein Inline-SVG. Alles andere (Utilities, `@theme`, Schriften) fehlt.

Ursache: `frontend/Dockerfile` hat `postcss.config.js` nicht ins Build-Image kopiert. Ohne diese Datei überspringt Vite das Tailwind-Plugin stillschweigend und liefert das rohe `@import "tailwindcss"` aus. Das ist seit heute mit Commit `d41d5443` behoben (`frontend/Dockerfile:23`). Ein lokaler Build vom aktuellen `main` ist korrekt gestylt (CSS 49,6 kB, Screenshot-Vergleich bestätigt).

Wenn du den Fehler trotzdem noch siehst, gibt es zwei mögliche Gründe:

1. Das Frontend wurde seit dem Fix nicht neu gebaut und ausgeliefert (`docker build --target export -f frontend/Dockerfile --output frontend/dist .`).
2. Dein Handy hält noch den alten Service Worker mit dem kaputten Stand im Cache. Die App wartet mit dem Wechsel auf deine Bestätigung („Neue Version verfügbar“) und sucht nur beim Neuladen nach Updates. App komplett schließen, neu öffnen, kurz warten, dann „Aktualisieren“.

Dass so ein Stand überhaupt live gehen konnte, ist Befund 1; dass er auf dem Handy hängen bleiben kann, ist Befund 3.

---

## Befunde

| # | Schwere | Bereich | Titel | Ort |
|---|---------|---------|-------|-----|
| 1 | Hoch | Betrieb/CI | Produktions-Image wird in CI nie gebaut, ungestylte App ging live | `.github/workflows/ci.yml:69`, `frontend/Dockerfile:14-26` |
| 2 | Mittel | Betrieb | Kein Datenbank-Backup, kein Restore-Weg | `docker-compose.prod.yml:17,52,74-78`, `backend/src/modules/dataExport/dataExport.routes.ts:12` |
| 3 | Mittel | PWA | Service Worker sucht bei laufender App nie nach Updates | `frontend/src/components/layout/UpdatePrompt.tsx:11-19` |
| 4 | Mittel | Security | Setup-Token setzt das Passwort jedes Kontos zurück | `backend/src/modules/auth/auth.service.ts:127-133` |
| 5 | Mittel | Security/PWA | Logout wirkt offline nicht; Push-Abo bleibt nach Logout bestehen | `frontend/src/hooks/useAuth.ts:64-67`, `frontend/src/components/layout/UserRow.tsx:22` |
| 6 | Mittel | UI | Dashboard mobil: zwei Kacheln nur halb breit, daneben Leerraum | `frontend/src/routes/DashboardPage.tsx:210-218` |
| 7 | Mittel | UI | Timer-Button verdeckt am Seitenende die letzte Zeilenaktion | `frontend/src/components/layout/AppShell.tsx:58`, `RestTimerWidget.tsx:67` |
| 8 | Mittel | UI/Daten | Trainingsplan mobil: Übungsnamen abgeschnitten, Löschen ohne Rückfrage | `frontend/src/components/plan/PlanDays.tsx:71-84` |
| 9 | Niedrig | UI | Dezimaltrennzeichen uneinheitlich (84,4 neben 84.4) | `BodyCompositionCard.tsx:112,186`, `GoalTile.tsx:28`, `GoalsProgressCard.tsx:37`, `GoalCard.tsx:41` |
| 10 | Niedrig | UI | Englische Texte in der deutschen Oberfläche | `ExerciseLibraryPage.tsx:44-45`, `LoginPage.tsx:28`, `auth.service.ts:44-48` |
| 11 | Niedrig | UI | Kleinere Darstellungsfehler (Doppel-Plus, „1 Tage“, „Letztes Mal“, Ziel-KFA) | `PhaseRotation.tsx:112-122`, `ActivityWeekCard.tsx:30`, `ExerciseCard.tsx:187`, `FatLossGoalCard.tsx:28` |
| 12 | Niedrig | A11y | Touch-Ziele unter der eigenen 44-px-Regel | `CalcInfoButton.tsx:20`, `PhaseRotation.tsx:159,170`, `SegmentedControl.tsx:58` |
| 13 | Niedrig | UX | Tab „Körper“ ist 4.800 px lang, das Eingabeformular liegt weit unten | `frontend/src/routes/NutritionPage.tsx` |
| 14 | Niedrig | Security | Debug-Endpunkt ohne Login und ohne Rate-Limit | `backend/src/modules/healthSync/healthSync.routes.ts:47-83` |
| 15 | Niedrig | Security | Push-Endpoint akzeptiert beliebige URLs | `packages/shared/src/schemas/push.schema.ts:5`, `push.service.ts:15-27` |
| 16 | Niedrig | Security | Übungskatalog für jedes Konto änderbar; `javascript:`-URL wird gespeichert | `exercise.routes.ts:58-103`, `exercise.schema.ts:21` |
| 17 | Niedrig | Performance | OCR-Route ohne Rate-Limit; ausgehende Aufrufe ohne Timeout | `bodyComposition.routes.ts:40`, `aiClient.ts:67`, `imageOcr.ts:10-32` |
| 18 | Niedrig | Betrieb | `sharp` wird wieder beim Start geladen (dokumentierter Absturzschutz umgangen) | `backend/src/lib/imageOcr.ts:2` |
| 19 | Niedrig | Logik | Tages- und Wochengrenzen im Backend in UTC statt Ortszeit | `dailyChallenge.service.ts:28-31`, `planWeekStatus.service.ts:89-101` |
| 20 | Niedrig | Logik | Körperfett-Plausibilitätscheck passt nicht zur Zielgruppe | `packages/shared/src/bodyFat.ts:18-48`, `BodyFatEstimateCard.tsx:45-46` |
| 21 | Niedrig | Betrieb | Kein sauberes Herunterfahren; Pausen-Push geht bei Neustart verloren | `backend/src/server.ts`, `backend/Dockerfile:54`, `restTimerPush.ts:8` |
| 22 | Niedrig | Abhängigkeiten | `pnpm audit`: 1 × high (deepmerge-ts über die Prisma-CLI) | `backend/package.json` (`prisma`) |
| 23 | Hinweis | Repo | Repo-Hygiene: 43.000 versehentlich committete Dateien in der Historie, keine `.dockerignore` | Commit `cc12eacd`, Repo-Wurzel |
| 24 | Hinweis | Security | Access-Token bleibt nach Logout bis zu 15 Minuten gültig | `backend/src/plugins/jwt.plugin.ts:18` |

---

## Details

### 1. Produktions-Image wird in CI nie gebaut, ungestylte App ging live (Hoch · Betrieb/CI)
- **Ort:** `.github/workflows/ci.yml:69` (`pnpm build` auf dem Runner), `frontend/Dockerfile:14-26`
- **Problem:** Die CI baut das Frontend direkt im Checkout, wo alle Dateien liegen. Produktion baut über `frontend/Dockerfile`, das jede Konfigurationsdatei einzeln kopiert. Die beiden Wege können auseinanderlaufen, ohne dass ein Check rot wird. Genau das ist bei der Tailwind-4-Umstellung passiert: `postcss.config.js` fehlte in der COPY-Liste, CI war grün, die ausgelieferte App war ungestylt (Fix: `d41d5443`).
- **Auslöser/Szenario:** Jede künftige neue Konfigurationsdatei im Frontend (oder Backend, `backend/Dockerfile:19-24` nutzt dasselbe Muster) wiederholt den Fehler.
- **Empfehlung:** In CI zusätzlich beide Images bauen (`docker build --target export -f frontend/Dockerfile …`, `docker build -f backend/Dockerfile .`) und das Ergebnis prüfen, z. B. dass die erzeugte CSS-Datei größer als 20 kB ist. Zusätzlich im Dockerfile `COPY frontend frontend` mit einer `.dockerignore` statt Einzeldateien.

### 2. Kein Datenbank-Backup, kein Restore-Weg (Mittel · Betrieb)
- **Ort:** `docker-compose.prod.yml:17,52,74-78` (Volumes `pgdata`, `uploads`), `backend/src/modules/dataExport/dataExport.routes.ts:12`
- **Problem:** Trainingshistorie und Fortschrittsfotos liegen ausschließlich in zwei Docker-Volumes auf einem Mini-PC. Im Repo gibt es weder ein `pg_dump`-Skript noch eine Restore-Anleitung. `scripts/backup-before-merge.sh` sichert nur Konfigurationsdateien. Der In-App-Export (`/api/export/backup.json`) lässt sich nirgends wieder einspielen und enthält keine Fotos.
- **Auslöser/Szenario:** SSD-Defekt, versehentliches `docker compose down -v` oder eine fehlerhafte Migration: alle Daten sind weg.
- **Empfehlung:** Nächtliches `pg_dump` plus Archiv des Upload-Volumes auf ein zweites Gerät oder verschlüsselt in einen Cloud-Speicher, dazu ein einmal getesteter Restore. Mittelfristig einen Import für `backup.json`.

### 3. Service Worker sucht bei laufender App nie nach Updates (Mittel · PWA)
- **Ort:** `frontend/src/components/layout/UpdatePrompt.tsx:11-19`
- **Problem:** `useRegisterSW` wird ohne `onRegisteredSW` aufgerufen, es gibt nirgends ein `registration.update()`. Der Browser prüft auf einen neuen Service Worker nur bei einer echten Navigation. Die App ist eine SPA und navigiert clientseitig, eine installierte PWA bleibt auf Android oft tagelang im Speicher.
- **Auslöser/Szenario:** Du lieferst einen Fix aus (wie heute den für die ungestylte App). Auf dem Handy bleibt der alte Stand aktiv, bis die App vollständig beendet und neu gestartet wird. Der Hinweis „Neue Version verfügbar“ erscheint so lange nicht.
- **Empfehlung:** In `onRegisteredSW` beim Zurückkehren in die App (`visibilitychange`) und etwa stündlich `registration.update()` aufrufen. Die Unterdrückung im Fokusmodus kann bleiben.

### 4. Setup-Token setzt das Passwort jedes Kontos zurück (Mittel · Security)
- **Ort:** `backend/src/modules/auth/auth.service.ts:11-17,127-133`, `auth.routes.ts:129`
- **Problem:** Dasselbe Geheimnis schützt die Registrierung und den Passwort-Reset. Wer das Token kennt, weil er sich damit ein Konto angelegt hat, kann mit einer bekannten E-Mail-Adresse das Passwort jedes anderen Kontos neu setzen. Der Endpunkt verrät außerdem per 404, ob eine E-Mail existiert.
- **Auslöser/Szenario:** Du gibst das Token einem Trainingspartner zum Registrieren. Er kann danach dein Konto übernehmen. Solange nur du das Token kennst, besteht kein Risiko.
- **Empfehlung:** Zwei getrennte Geheimnisse (`SETUP_TOKEN` für Registrierung, `RESET_TOKEN` nur für den Betreiber) oder Reset ausschließlich über ein CLI-Skript auf dem Server. Einheitliche Antwort unabhängig davon, ob die E-Mail existiert.

### 5. Logout wirkt offline nicht; Push-Abo bleibt nach Logout bestehen (Mittel · Security/PWA)
- **Ort:** `frontend/src/hooks/useAuth.ts:64-67`, `frontend/src/components/layout/UserRow.tsx:22`, `backend/src/modules/push/push.service.ts:86`
- **Problem:** (a) `logout()` schluckt einen fehlgeschlagenen `/auth/logout`-Aufruf. Ohne Netz bleiben Refresh-Cookie und Server-Token gültig, beim nächsten Start mit Netz meldet der stille Refresh das Konto wieder an. (b) Beim Logout wird das Push-Abo weder im Browser noch auf dem Server entfernt; das Gerät bekommt weiter die Erinnerungen des abgemeldeten Kontos. (c) Der Abmelden-Button im Menü löst ohne Rückfrage aus. Offline kann man sich danach nicht wieder anmelden, ein laufendes Training ist bis zum nächsten Empfang blockiert.
- **Auslöser/Szenario:** Abmelden im Keller-Gym ohne Empfang und Handy weitergeben: Das Konto ist später wieder angemeldet. Oder ein versehentlicher Tipp auf Abmelden mitten im Training.
- **Empfehlung:** Fehlgeschlagenen Logout vormerken und beim nächsten Online-Moment nachholen, bevor ein Refresh versucht wird. Beim Logout das Push-Abo abmelden. Rückfrage vor dem Abmelden, mit Warnhinweis bei Offline-Status oder ungesyncten Einträgen.

### 6. Dashboard mobil: zwei Kacheln nur halb breit (Mittel · UI)
- **Ort:** `frontend/src/routes/DashboardPage.tsx:210-218`
- **Problem:** Das Raster hat zwei Spalten, die Reihenfolge der Kinder ist „Nächstes Ziel“ (1 Spalte), „Körpergewicht“ (2 Spalten), „Letztes Training“ (1 Spalte). Die breite Karte in der Mitte zwingt beide schmalen Kacheln in eine eigene Zeile. Ergebnis: zwei halb breite Karten mit Leerraum daneben, Titel brechen um („Nächstes / Ziel“, „Alle / Ziele“).
- **Auslöser/Szenario:** Jedes Öffnen des Dashboards unter 1024 px Breite.
- **Empfehlung:** „Letztes Training“ direkt nach „Nächstes Ziel“ einordnen (oder per `order-*`), sodass beide in einer Zeile stehen und „Körpergewicht“ darunter folgt.

### 7. Timer-Button verdeckt am Seitenende die letzte Zeilenaktion (Mittel · UI)
- **Ort:** `frontend/src/components/layout/AppShell.tsx:58` (`pb-[calc(3.5rem+…)]`), `RestTimerWidget.tsx:67` (`bottom-[calc(5rem+…)]`, 48 px hoch)
- **Problem:** Der Inhalt endet 56 px über dem unteren Rand, der schwebende Timer-Button belegt den Bereich von 80 bis 128 px. Am Ende einer Seite liegt er dauerhaft über der rechten unteren Ecke der letzten Karte. Auf `/plan` überdeckt er den „+“-Button des letzten Eintrags unter „Empfohlene Trainingspläne“; wegscrollen geht nicht. Zusätzlich endet die letzte Karte ohne Abstand direkt an der Tab-Leiste.
- **Auslöser/Szenario:** Ans Ende von Plan, Dashboard, Einstellungen oder Fortschritt scrollen.
- **Empfehlung:** Unteren Innenabstand von `main` auf Mobilgeräten auf etwa 9 rem erhöhen, damit sich die letzte Zeile über den Button hinaus scrollen lässt.

### 8. Trainingsplan mobil: Namen abgeschnitten, Löschen ohne Rückfrage (Mittel · UI/Daten)
- **Ort:** `frontend/src/components/plan/PlanDays.tsx:71-84`
- **Problem:** Jede Zeile enthält vier Icon-Buttons (ersetzen, hoch, runter, löschen) plus Satz-Angabe. Bei 390 px bleiben dem Namen rund 90 px: „Schulterdrüc…“, „Kneeling Cab…“. Der Papierkorb liegt 36 px breit direkt neben „nach unten“ und löscht sofort (`remove.mutate(entry.id)`), ohne Rückfrage oder Rückgängig.
- **Auslöser/Szenario:** Beim Umsortieren daneben getippt: Die Übung samt Vorgaben (Sätze, Notiz, Startgewicht) ist weg.
- **Empfehlung:** Aktionen in ein Überlaufmenü („…“) verlegen oder den Namen zweizeilig erlauben. Löschen mit Rückgängig-Toast oder Bestätigung.

### 9. Dezimaltrennzeichen uneinheitlich (Niedrig · UI)
- **Ort:** `BodyCompositionCard.tsx:112,186`, `GoalTile.tsx:28`, `GoalsProgressCard.tsx:37`, `GoalCard.tsx:41`
- **Problem:** Diese Stellen geben Zahlen roh aus (`{latest.weightKg}`), andere formatieren deutsch. Auf derselben Seite steht „84,4 kg“ über „84.4 kg“, auf dem Dashboard „84.4 / 80 kg“ neben „84,6 kg“.
- **Empfehlung:** Überall den vorhandenen Formatierer (`formatKg` bzw. `toLocaleString("de-DE")`) verwenden.

### 10. Englische Texte in der deutschen Oberfläche (Niedrig · UI)
- **Ort:** `frontend/src/routes/ExerciseLibraryPage.tsx:44-45`, `LoginPage.tsx:28`, `backend/src/modules/auth/auth.service.ts:44-48`
- **Problem:** Filter der Übungsbibliothek zeigen die Rohwerte des Datensatzes („abdominals“, „body only“, „bands“). Nach einem frischen Import sind alle Übungsnamen englisch, die Übersetzung ist ein separates Skript. Fehlermeldungen des Servers werden unverändert angezeigt („Invalid email or password“, bei Rate-Limit Fastifys englischer Standardtext).
- **Empfehlung:** Label-Tabelle für Muskelgruppen und Geräte im Frontend; Fehlertexte im Frontend anhand des Statuscodes auf Deutsch abbilden; Namensübersetzung in den Import integrieren.

### 11. Kleinere Darstellungsfehler (Niedrig · UI)
- **`PhaseRotation.tsx:112,119-122`:** Button zeigt Plus-Icon und zusätzlich „+“ im Text („+ + Phase hinzufügen“).
- **`ActivityWeekCard.tsx:30`:** „1 Tage“ statt „1 Tag“.
- **`ExerciseCard.tsx:187`:** „Letztes Mal 3 × 10“ nimmt die Wiederholungen des ersten Satzes für alle Sätze. Bei 10/9/8 steht dort trotzdem „3 × 10“, direkt daneben schlägt die App wegen der verfehlten Sätze einen Deload vor. Das wirkt widersprüchlich.
- **`FatLossGoalCard.tsx:28,80`:** Ziel-Körperfett ist fest mit 20 vorbelegt. Liegt der aktuelle Wert darunter, erscheint sofort ein Hinweis, der wie ein Fehler aussieht. Vorbelegung aus dem aktuellen Wert ableiten.
- **`BodyCompositionCard.tsx:112`:** Trendpfeil steht zwischen Zahl und Einheit („84.4 ↓ kg“).
- **`ProgressPage` (Körperdaten):** Veränderung des Körperfetts als „−2,4 %“ statt „−2,4 Prozentpunkte“.

### 12. Touch-Ziele unter der eigenen 44-px-Regel (Niedrig · A11y)
- **Ort:** `CalcInfoButton.tsx:20` (32 px), `PhaseRotation.tsx:159,170,215,225` (32 px, darunter „Phase löschen“), `PlanDays.tsx:73-82` (36 px), `SegmentedControl.tsx:58` (36 px hoch), Daily „+1/+5/+10“ (36 px hoch)
- **Problem:** `CLAUDE.md` und der Kommentar in `IconButton.tsx:19` setzen 44 px als Standard. Gemessen liegen je nach Seite 5 bis 35 Bedienelemente darunter. Über dem WCAG-Minimum von 24 px liegen alle.
- **Empfehlung:** Mindestens die destruktiven Buttons (Phase löschen, Übung löschen) und die Tabs auf 44 px bringen; Info-Buttons können mit größerer Trefferfläche bei gleicher Optik gelöst werden.

### 13. Tab „Körper“ ist überladen (Niedrig · UX)
- **Ort:** `frontend/src/routes/NutritionPage.tsx` (Tab „Körper“)
- **Problem:** Die Seite ist bei 390 px rund 4.800 px lang und enthält drei verschiedene Upload-Karten (KI-Körperanalyse, Waagenbericht, Fortschrittsfoto). Das Formular „Neue Messung“, die häufigste Aktion, beginnt erst nach etwa 1.900 px, die letzte Messung steht darunter.
- **Empfehlung:** Reihenfolge: letzte Messung, neue Messung, Verlauf; Importe und Analysen einklappen oder in einen eigenen Unter-Tab.

### 14. Debug-Endpunkt ohne Login und ohne Rate-Limit (Niedrig · Security)
- **Ort:** `backend/src/modules/healthSync/healthSync.routes.ts:47-83`
- **Problem:** `GET /api/health-sync/webhook/debug` ist öffentlich, bestätigt die Gültigkeit eines Tokens, gibt die zugehörige `userId` zurück und spiegelt den Authorization-Header. Jede Anfrage löst eine Datenbankabfrage aus, ein Limit gibt es nicht. Der Kommentar im Code sagt selbst „can be removed after setup works“. Das Repo ist öffentlich, der Endpunkt also bekannt. Erraten lässt sich ein Token wegen seiner Länge nicht.
- **Empfehlung:** Endpunkt entfernen. Die beiden `log.warn`-Aufrufe im Webhook (Zeilen 94-109) schreiben außerdem Token-Präfixe ins Log; ebenfalls entfernen.

### 15. Push-Endpoint akzeptiert beliebige URLs (Niedrig · Security)
- **Ort:** `packages/shared/src/schemas/push.schema.ts:5`, `backend/src/modules/push/push.service.ts:15-27,86-106`
- **Problem:** `endpoint` wird nur als URL geprüft (ein Test mit einer internen Adresse wurde vom Schema akzeptiert). Ein angemeldetes Konto kann den Server so zu HTTPS-POSTs an frei wählbare Hosts bringen, auslösbar über `PUT /api/push/rest-timer`. Der Upsert über `endpoint` überschreibt zudem die `userId` eines bestehenden Abos.
- **Empfehlung:** Nur `https:` und die bekannten Push-Dienste zulassen (FCM, Mozilla, Apple, WNS).

### 16. Übungskatalog für jedes Konto änderbar (Niedrig · Security)
- **Ort:** `backend/src/modules/exercises/exercise.routes.ts:58-103`, `packages/shared/src/schemas/exercise.schema.ts:21`
- **Problem:** Übungen sind global, aber jedes Konto darf sie anlegen, ändern, deaktivieren, löschen und den Import von GitHub beliebig oft anstoßen. Das widerspricht der sonst sauberen Kontentrennung. `videoUrl` akzeptiert `javascript:`-Adressen (im Test bestätigt); React 19 und die CSP blockieren die Ausführung, gespeichert wird der Wert trotzdem.
- **Empfehlung:** Eigene Übungen mit Besitzer versehen und nur diesem das Ändern erlauben, Import auf ein Betreiberkonto beschränken, `videoUrl` auf `http(s)` einschränken.

### 17. OCR-Route ohne Rate-Limit; ausgehende Aufrufe ohne Timeout (Niedrig · Performance)
- **Ort:** `backend/src/modules/bodyComposition/bodyComposition.routes.ts:40`, `aiClient.ts:67`, `formAnalysis.service.ts:37`, `freeExerciseDb.adapter.ts:26`, `exerciseImage.ts:53`, `lib/imageOcr.ts:10-32`
- **Problem:** `/body-composition/report/parse` startet `sharp` und einen Tesseract-Prozess, hat aber als einzige teure Route kein `HEAVY_RATE_LIMIT`. Alle `fetch`-Aufrufe zu KI-Anbietern und GitHub laufen ohne `AbortSignal`, Tesseract ohne Zeitlimit.
- **Auslöser/Szenario:** Ein hängender KI-Anbieter lässt die Anfrage unbegrenzt offen; die App zeigt dauerhaft „lädt“.
- **Empfehlung:** `HEAVY_RATE_LIMIT` ergänzen, `AbortSignal.timeout(60_000)` an die Aufrufe, Kill-Timer für Tesseract.

### 18. `sharp` wird wieder beim Start geladen (Niedrig · Betrieb)
- **Ort:** `backend/src/lib/imageOcr.ts:2`, importiert von `bodyComposition.routes.ts:11`
- **Problem:** `progressPhoto.service.ts:10-24` lädt `sharp` bewusst erst beim Upload, weil die Bibliothek auf der Mini-PC-CPU den ganzen Prozess beenden kann. `docker-compose.prod.yml:44-47` verlässt sich darauf. `imageOcr.ts` importiert `sharp` aber statisch, es wird also bei jedem Start geladen. Aktuell fängt `VIPS_NOVECTOR=1` das ab.
- **Empfehlung:** In `imageOcr.ts` denselben verzögerten Import verwenden.

### 19. Tages- und Wochengrenzen in UTC (Niedrig · Logik)
- **Ort:** `dailyChallenge.service.ts:28-31`, `planWeekStatus.service.ts:89-101`, `workoutLog.service.ts:158-166`
- **Problem:** „Heute“ und „diese Woche“ rechnet das Backend in UTC, das Frontend in Ortszeit. In Deutschland wechselt die Tages-Challenge erst um 1 bzw. 2 Uhr, ein Training am Montag kurz nach Mitternacht zählt zur Vorwoche. Die Erinnerung „Training heute?“ kommt um 21 bzw. 22 Uhr (im Code als Vereinfachung dokumentiert).
- **Empfehlung:** Zeitzone pro Konto speichern (bei Supplements gibt es sie schon) oder als Parameter mitschicken, wie es `report/parse` bereits tut.

### 20. Körperfett-Plausibilitätscheck passt nicht zur Zielgruppe (Niedrig · Logik)
- **Ort:** `packages/shared/src/bodyFat.ts:18-48`, `frontend/src/components/nutrition/BodyFatEstimateCard.tsx:45-46`
- **Problem:** Die CUN-BAE-Formel ist korrekt umgesetzt (Koeffizienten geprüft), rechnet aber nur aus BMI, Alter und Geschlecht. Für Menschen mit Krafttraining liegt sie systematisch zu hoch (im Testkonto 23,0 % gegenüber 18,6 % der Waage). Die FFMI-Grenze von 25 wird außerdem ohne Rücksicht auf den Körperfettanteil angewendet: Bei hohem Körperfett steigt die fettfreie Masse mit, 130 kg bei 180 cm und 37 % ergeben FFMI 25,3 und lösen die Warnung „vermutlich zu niedrig gemessen“ aus, obwohl der Wert plausibel ist.
- **Empfehlung:** Siehe Abschnitt „Körperfett“ unten. Kurzfristig den FFMI-Check nur unterhalb von etwa 25 % Körperfett anwenden.

### 21. Kein sauberes Herunterfahren (Niedrig · Betrieb)
- **Ort:** `backend/src/server.ts`, `backend/Dockerfile:54`, `backend/src/modules/push/restTimerPush.ts:8`, `backend/src/app.ts:72`
- **Problem:** Es gibt keinen SIGTERM-Handler, und der Server läuft hinter `sh -c`, das Signale nicht weiterreicht. Docker wartet beim Neustart 10 Sekunden und beendet den Prozess hart. Geplante „Pause vorbei“-Benachrichtigungen liegen nur im Arbeitsspeicher und gehen dabei verloren. `/api/health` prüft die Datenbank nicht, das Backend hat in Compose keinen Healthcheck.
- **Empfehlung:** `exec node dist/server.js` im CMD, `app.close()` bei SIGTERM, Healthcheck mit `SELECT 1`.

### 22. `pnpm audit`: 1 × high (Niedrig · Abhängigkeiten)
- **Ort:** `backend/package.json` (`prisma` unter `dependencies`)
- **Problem:** `deepmerge-ts < 8.0.0` (GHSA-ggr8-5vv4-36mx, Stack-Überlauf bei rekursiven Objekten) über `prisma > @prisma/config`. Betrifft die Prisma-CLI beim Start (Migrationen), nicht den Request-Pfad; Nutzereingaben erreichen den Code nicht.
- **Empfehlung:** Mit dem nächsten Prisma-Update erledigen oder per `pnpm.overrides` auf `>=8.0.0` heben.

### 23. Repo-Hygiene (Hinweis · Repo)
- Commit `cc12eacd` („fixed mobile view“) hat 43.386 Dateien aus `node_modules`, `dist` und `frontend/test-results` mit eingecheckt; `570bff2e` hat sie wieder entfernt. Geheimnisse waren nicht dabei (geprüft: keine `.env`, keine Uploads, keine Schlüssel). Die Dateien bleiben aber in der Historie und machen jeden Klon groß.
- Es gibt keine `.dockerignore`; der Build-Kontext enthält `node_modules`, `.git` und die `.env`.
- `context.txt` und `context2.txt` (je rund 65 kB Code-Auszüge) sowie fünf Roadmap-Dateien (`ROADMAP.md`, `roadmap3.md`, `roadmapv2_additionals.md`, `docs/roadmap2.md`, `docs/ROADMAP-UI.md`) liegen im Repo. Die README beschreibt noch Phase 0–14 inklusive Wasser-Tracking, das laut Roadmap entfernt wurde.

### 24. Access-Token bleibt nach Logout gültig (Hinweis · Security)
- **Ort:** `backend/src/plugins/jwt.plugin.ts:18`, `auth.service.ts:86-91`
- **Problem:** Logout, Passwortwechsel und Kontolöschung entfernen die Refresh-Tokens, ein bereits ausgestelltes Access-Token gilt bis zu 15 Minuten weiter. Ein nach der Schonfrist erneut vorgelegtes Refresh-Token wird nur abgelehnt, die übrigen Sitzungen bleiben bestehen. Für diese App vertretbar, hier nur dokumentiert.

---

## Körperfett: welche Formel?

Dein Eindruck stimmt: Jede Formel ist ungenau, und das lässt sich nicht durch eine bessere Formel beheben. Größenordnung des Fehlers für eine einzelne Person, gemessen an Referenzverfahren:

| Methode | Eingaben | Typischer Fehler | Schwäche |
|---|---|---|---|
| BMI-basiert (CUN-BAE, Deurenberg) | Gewicht, Größe, Alter, Geschlecht | ±4–5 Prozentpunkte | Kennt keine Muskeln, liegt bei Trainierten systematisch zu hoch |
| Bioimpedanz-Waage | Strom durch Füße | ±4–8 Prozentpunkte, schwankt täglich | Abhängig von Wasserhaushalt, Hersteller-Formel unbekannt |
| US-Navy (Maßband) | Taille, Hals, Größe (Frauen: plus Hüfte) | ±3–4 Prozentpunkte | Messfehler am Band |
| RFM (Maßband) | Taille, Größe | ±3–5 Prozentpunkte | Nur ein Umfang |
| Hautfalten (Caliper) | 3 oder 7 Falten | ±3–4 Prozentpunkte bei geübter Messung | Selbstmessung kaum reproduzierbar |
| DEXA-Scan | Gerät | ±1–2 Prozentpunkte | Kosten, Geräte untereinander nicht vergleichbar |

Die App nutzt derzeit CUN-BAE. Die Formel ist für die Allgemeinbevölkerung gebaut und für jemanden, der Krafttraining macht, die ungeeignetste der Liste, weil mehr Muskelmasse als mehr Fett gewertet wird.

**Empfehlung: nicht die Formel wechseln, sondern die Messgröße.**

1. **Taille als Hauptwert.** Taillenumfang und Taille-zu-Größe-Verhältnis sind direkte Messungen ohne Modell. Sinkt die Taille bei gleichem oder steigendem Gewicht, verlierst du Fett. Das ist nachvollziehbar und für die Verlaufskontrolle genauer als jede Prozentzahl.
2. **Zwei transparente Maßband-Formeln als Schätzbereich** statt einer scheingenauen Zahl:
   - RFM (Woolcott & Bergman 2018, gegen DEXA validiert): `Körperfett % = 64 − 20 × Größe / Taille` (Frauen: 76 statt 64).
   - US-Navy (Hodgdon & Beckett 1984), Männer: `495 / (1,0324 − 0,19077 × log10(Taille − Hals) + 0,15456 × log10(Größe)) − 450`; Frauen: `495 / (1,29579 − 0,35004 × log10(Taille + Hüfte − Hals) + 0,22100 × log10(Größe)) − 450`. Alle Maße in cm.
   - Beispiel mit fiktiven Maßen (182 cm, Taille 88, Hals 39): RFM 22,6 %, Navy 17,3 %. Die App zeigt dann „etwa 17–23 %“ und darunter den Trend. Fünf Punkte Abstand zwischen zwei anerkannten Formeln zeigen ehrlich, wie genau solche Schätzungen sind.
3. **Waage nur für den Trend.** Die Wiederholungsmessung und Mittelung gibt es schon; anzeigen als gleitendes 7-Tage-Mittel, nicht als Einzelwert.
4. **Optionale persönliche Kalibrierung.** Wer einmal einen DEXA-Scan macht, trägt den Wert ein; die App speichert die Differenz zur eigenen Schätzung am selben Tag und korrigiert künftige Werte um diesen Betrag. Das macht eine grobe Formel zu einer persönlichen.
5. **CUN-BAE nur noch als Rückfall**, wenn keine Umfänge vorliegen, mit dem Hinweis, dass sie bei Trainierten zu hoch liegt.

Nötig dafür: Felder für Taille, Hals und Hüfte je Messung (heute hat `BodyCompositionEntry` nur Gewicht, Körperfett, Muskelmasse, Wasser) und eine kurze Messanleitung in der App (morgens, nüchtern, Band waagerecht auf Nabelhöhe, entspannt ausgeatmet, zweimal messen und mitteln).

Quellen: Gómez-Ambrosi et al., Diabetes Care 2012 (CUN-BAE); Woolcott & Bergman, Scientific Reports 2018 (RFM); Hodgdon & Beckett, Naval Health Research Center 1984 (Navy); Jackson & Pollock, Br J Nutr 1978 (Hautfalten); Kouri et al., Clin J Sport Med 1995 (FFMI). Die Fehlerangaben sind Größenordnungen aus dieser Literatur, keine eigenen Messungen.

---

## Was technisch unbedingt rein sollte

1. Automatisches Backup mit getestetem Restore (Befund 2).
2. Build der Produktions-Images in CI mit Prüfung des Ergebnisses (Befund 1).
3. Regelmäßiger Update-Check des Service Workers (Befund 3).
4. Getrenntes Reset-Geheimnis und Entfernen des Debug-Endpunkts (Befunde 4, 14).
5. Umfangsmaße und Schätzbereich für Körperfett (Abschnitt oben).
6. Zeitzone pro Konto (Befund 19).
7. Rückgängig für destruktive Aktionen im Plan und Rückfrage beim Abmelden (Befunde 5, 8).

---

## Positiv aufgefallen

- **Auth:** Access-Token nur im Speicher, Refresh-Token als httpOnly-Cookie mit `SameSite=Strict`, serverseitig gehasht, rotiert, mit Schonfrist für parallele Tabs (`auth.service.ts:68-95`). bcrypt mit 12 Runden, zeitkonstanter Token-Vergleich, Rate-Limit auf Login, Registrierung und Reset.
- **Kontentrennung:** Jede Route hinter `authenticate`, Zugriffe per ID durchgängig gegen `userId` geprüft, global eindeutige `clientId` wird bei fremdem Besitzer als Konflikt behandelt. Durch Integrationstests gegen echtes Postgres abgedeckt.
- **Konfiguration:** Start schlägt fehl, wenn in Produktion Platzhalter-Geheimnisse stehen (`config/env.ts:78-90`). `TRUST_PROXY` sauber gelöst und getestet.
- **Header:** Strikte CSP ohne Inline-Skripte, `frame-ancestors 'none'`, HSTS, `nosniff`, Permissions-Policy; unveränderliche Assets getrennt von der stets revalidierten Shell (`Caddyfile`).
- **Uploads:** Fotos werden mit `sharp` neu kodiert (prüft Format, entfernt EXIF/GPS), Größen- und Pixelgrenzen, zufällige Dateinamen, Auslieferung nur an den Besitzer.
- **KI-Schlüssel:** AES-256-GCM mit zufälligem IV, feste Anbieter-URLs (kein SSRF über diesen Weg).
- **PWA:** API ist `NetworkOnly`, Updates per Rückfrage statt stillem Austausch, kein Update-Hinweis im Training, Fehlergrenze für veraltete Chunks, vollständiges Manifest mit korrekten Icon- und Screenshot-Maßen, Safe-Area berücksichtigt, Zoom nicht gesperrt.
- **Offline:** Lokale Daten und Warteschlangen sind an das Konto gebunden, fehlgeschlagene Einträge bleiben sichtbar und wiederholbar, Schreibvorgänge sind über `clientId` idempotent. 15 E2E-Tests decken das ab.
- **Qualität:** Lint, Typecheck, 198 Unit-Tests, 29 Integrationstests, 15 E2E-Tests, Token-Check für Farben, Caddyfile-Validierung, alles grün. Kein horizontales Überlaufen bei 320 px. Fokusmodus im Training ist ruhig und gut lesbar.

---

## Automatische Checks

Ausgeführt in einer Kopie des Repos außerhalb des Projektverzeichnisses.

| Check | Ergebnis |
|-------|----------|
| `pnpm audit --prod` | 1 × high (deepmerge-ts über prisma, Befund 22) |
| `pnpm lint` | bestanden |
| `pnpm typecheck` | bestanden |
| `pnpm test` (Unit) | 198 bestanden (shared 34, frontend 16, backend 148) |
| Integrationstests Backend (Postgres 16) | 29 bestanden |
| `pnpm run check:ui` | 0 Treffer |
| `pnpm build` | bestanden, CSS 49,6 kB (gestylt) |
| Playwright E2E | 15 von 15 bestanden |
| Sichtprüfung 14 Routen × 390/320 px | kein horizontales Überlaufen; UI-Befunde 6–13 |

## Nicht geprüft

- **Docker-Builds:** In der Prüfumgebung lief kein Docker-Daemon. Befund 1 stützt sich auf Dockerfile, CI-Konfiguration und den Fix-Commit, nicht auf einen eigenen Image-Build.
- **Produktionssystem:** Ausgelieferter Stand, echte `.env`, Cloudflare-Einstellungen, Volumes. Ob der Fix bereits live ist, konnte ich nicht sehen.
- **Echte Geräte:** iOS/Safari und Android-Installation, Verhalten im Hintergrund, Kamera.
- **Push-Zustellung:** Keine VAPID-Schlüssel in der Prüfumgebung.
- **KI-Funktionen und Videoanalyse:** Kein Anbieter-Schlüssel; nur Code gelesen.
- **Android-Begleit-App für Health Sync:** Nicht Teil des Repos.
- **Lighthouse, Screenreader, Kontrastmessung:** Nicht gelaufen. Kontraste nur anhand der Tokens und des Token-Checks eingeschätzt.
- **Offline-Sync-Code im Detail:** Gestützt auf die E2E-Tests, nicht Zeile für Zeile geprüft.
- **Desktop-Layout (ab 1024 px):** Nur stichprobenartig.

---

## Bewertung: 7 / 10

| Bereich | Note | Begründung |
|---|---|---|
| Code-Qualität und Architektur | 8,5 | Klare Module, geteilte Schemas, wenig Schulden, gute Kommentare |
| Sicherheit | 8 | Starke Grundlage; Abzug für Reset-Token, Debug-Endpunkt, globalen Katalog |
| PWA und Offline | 8 | Durchdacht und getestet; Abzug für fehlenden Update-Check und Logout |
| Mobile UI/UX | 6 | Fokusmodus gut; Dashboard-Raster, verdeckte Aktionen, abgeschnittene Namen, Sprachmix |
| Betrieb und Auslieferung | 5 | Kein Backup, Produktions-Build ungetestet, ungestylte App live |

Der Code allein wäre eine 8 bis 8,5. Für die Gesamtnote zählt, was beim Nutzer ankommt: eine zeitweise ungestylte App, ein Dashboard mit Layoutfehler und Daten ohne Backup. Mit den Punkten aus Stufe 0 und 1 der Roadmap ist eine 8,5 realistisch.

## Empfohlene Reihenfolge

1. Fix ausliefern und auf dem Handy aktualisieren (heute, Schnellgewinn)
2. Backup einrichten und Restore einmal testen (Befund 2)
3. CI baut die Produktions-Images (Befund 1)
4. Update-Check im Service Worker (Befund 3, Schnellgewinn)
5. Debug-Endpunkt entfernen, Reset-Geheimnis trennen (Befunde 14, 4)
6. UI: Dashboard-Raster, Abstand unten, Plan-Zeilen, Zahlenformat (Befunde 6–9, großteils Schnellgewinne)
7. Logout und Push-Abo (Befund 5)
8. Körperfett-Neukonzept (Befund 20)
9. Rest laut `review-roadmap.md`

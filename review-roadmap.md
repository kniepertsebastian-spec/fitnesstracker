# Roadmap zur PWA-Review vom 12.11.2026

Gehört zu [`review.md`](./review.md). Die Nummern in Klammern verweisen auf die Befunde dort.
Die bestehende Projekt-Roadmap in `ROADMAP.md` bleibt unverändert; diese Datei enthält nur die Arbeit, die aus der Review folgt.

Aufwand: **S** = unter 1 Stunde · **M** = halber Tag · **L** = mehrere Tage

Ziel: von 7/10 auf 8,5/10 nach Stufe 0 und 1, auf 9/10 nach Stufe 3.

---

## Stufe 0 — Heute: App wieder benutzbar

| # | Aufgabe | Befund | Aufwand | Fertig, wenn |
|---|---------|--------|---------|--------------|
| 0.1 | Frontend vom aktuellen `main` neu bauen und ausliefern (`docker build --target export -f frontend/Dockerfile --output frontend/dist .`) | Screenshot | S | `https://<domain>/login` zeigt in einem privaten Browserfenster die gestylte Login-Karte |
| 0.2 | Auf dem Handy: App vollständig schließen, öffnen, „Neue Version verfügbar“ → „Aktualisieren“ | 3 | S | Login-Seite auf dem Handy ist gestylt |
| 0.3 | Erstes manuelles Backup ziehen: `pg_dump` der Datenbank und Archiv des Volumes `uploads`, auf ein anderes Gerät kopieren | 2 | S | Dump-Datei und Foto-Archiv liegen außerhalb des Mini-PCs |

---

## Stufe 1 — Diese Woche: Absichern, was heute schiefging

### 1A Auslieferung und Betrieb

| # | Aufgabe | Befund | Aufwand | Fertig, wenn |
|---|---------|--------|---------|--------------|
| 1.1 | CI-Job: beide Produktions-Images bauen (`frontend/Dockerfile --target export`, `backend/Dockerfile`) | 1 | M | CI schlägt fehl, wenn im Dockerfile eine benötigte Datei fehlt |
| 1.2 | Prüfung des Build-Ergebnisses: erzeugte CSS-Datei größer als 20 kB und enthält kein `@import "tailwindcss"` | 1 | S | Ein Build ohne `postcss.config.js` macht die CI rot |
| 1.3 | `.dockerignore` anlegen (`node_modules`, `.git`, `.env`, `dist`, `test-results`); im Frontend-Dockerfile `COPY frontend frontend` statt Einzeldateien | 1, 23 | S | Neuer Konfigurationsdatei-Typ braucht keine Dockerfile-Änderung |
| 1.4 | Nächtliches Backup per Cron oder Zusatz-Container: `pg_dump` plus `uploads`, 14 Tage Aufbewahrung, Kopie auf zweites Gerät oder verschlüsselt in Cloud-Speicher | 2 | M | Jeden Morgen liegt ein neues Backup außerhalb des Mini-PCs |
| 1.5 | Restore einmal in eine leere Datenbank durchspielen und in der README dokumentieren | 2 | M | Anleitung steht in der README und wurde einmal erfolgreich ausgeführt |
| 1.6 | Service Worker: `registration.update()` beim Zurückkehren in die App und stündlich | 3 | S | Nach einem Deploy erscheint der Update-Hinweis in einer offenen App spätestens nach einer Stunde, ohne Neustart |

### 1B Sicherheit (schnelle Punkte)

| # | Aufgabe | Befund | Aufwand | Fertig, wenn |
|---|---------|--------|---------|--------------|
| 1.7 | `GET /api/health-sync/webhook/debug` und die Token-Präfix-Logs im Webhook entfernen | 14 | S | Route liefert 404; Logs enthalten keine Token-Teile |
| 1.8 | Eigenes `RESET_TOKEN` für den Passwort-Reset (oder Reset nur per CLI-Skript); gleiche Antwort für bekannte und unbekannte E-Mail | 4 | M | Mit dem `SETUP_TOKEN` lässt sich kein Passwort mehr zurücksetzen; Integrationstest deckt es ab |
| 1.9 | `HEAVY_RATE_LIMIT` auf `/body-composition/report/parse` | 17 | S | Elfte Anfrage pro Minute liefert 429 |
| 1.10 | `sharp` in `lib/imageOcr.ts` verzögert laden wie in `progressPhoto.service.ts` | 18 | S | Kein statischer `sharp`-Import mehr im Backend |

### 1C Mobile UI (sichtbare Fehler)

Vor Umsetzung Designplan freigeben lassen (Regel aus `CLAUDE.md`), danach mit Screenshots bei 390 px und 320 px prüfen.

| # | Aufgabe | Befund | Aufwand | Fertig, wenn |
|---|---------|--------|---------|--------------|
| 1.11 | Dashboard: „Nächstes Ziel“ und „Letztes Training“ nebeneinander, „Körpergewicht“ darunter in voller Breite | 6 | S | Keine halb breite Karte mit Leerraum mehr unter 1024 px |
| 1.12 | Unterer Innenabstand in `AppShell` so groß, dass sich die letzte Zeile über den Timer-Button hinaus scrollen lässt; sichtbarer Abstand zur Tab-Leiste | 7 | S | Auf `/plan` ist der letzte „+“-Button vollständig frei |
| 1.13 | Plan-Zeilen: Aktionen in ein „…“-Menü oder Name zweizeilig; Löschen mit Rückgängig-Toast | 8 | M | „Schulterdrücken“ ist bei 390 px vollständig lesbar; versehentliches Löschen lässt sich 5 Sekunden lang zurücknehmen |
| 1.14 | Zahlen einheitlich deutsch formatieren (Körperdaten, Ziel-Kacheln, Ziel-Karten) | 9 | S | Suche nach rohen Ausgaben von `weightKg`, `currentValue`, `targetValue` ergibt keine Treffer; überall Komma |
| 1.15 | Kleinteile: Doppel-Plus, „1 Tag“, Ziel-Körperfett aus aktuellem Wert vorbelegen, Trendpfeil hinter die Einheit, „Prozentpunkte“ | 11 | S | Die sechs Stellen aus Befund 11 sind korrigiert |
| 1.16 | „Letztes Mal“ zeigt die tatsächlichen Wiederholungen (z. B. „10/9/8 · 82,5 kg“) | 11 | S | Anzeige und Deload-Vorschlag widersprechen sich nicht mehr |

---

## Stufe 2 — Nächste zwei Wochen: Robustheit

| # | Aufgabe | Befund | Aufwand | Fertig, wenn |
|---|---------|--------|---------|--------------|
| 2.1 | Logout: fehlgeschlagenen Server-Logout vormerken und vor dem nächsten stillen Refresh nachholen | 5 | M | E2E-Test: offline abmelden, online neu laden → Login-Seite |
| 2.2 | Beim Logout Push-Abo im Browser und auf dem Server abmelden | 5 | S | Nach Logout kommt keine Benachrichtigung des Kontos mehr an |
| 2.3 | Rückfrage vor dem Abmelden; Warnung bei Offline-Status oder ungesyncten Einträgen | 5 | S | Ein einzelner Tipp im Menü meldet nicht mehr ab |
| 2.4 | Zeitzone pro Konto speichern (beim Login aus dem Browser übernehmen) und für Tages-Challenge, Wochenstatus und Erinnerungen verwenden | 19 | L | Challenge wechselt um 0 Uhr Ortszeit; Test für Montag 00:30 Uhr |
| 2.5 | Timeouts: `AbortSignal.timeout` an alle ausgehenden `fetch`-Aufrufe, Kill-Timer für Tesseract | 17 | S | Ein nicht antwortender Anbieter führt nach 60 Sekunden zu einer verständlichen Fehlermeldung |
| 2.6 | Push-Endpoint nur `https:` und bekannte Push-Dienste | 15 | S | Schema-Test lehnt interne Adressen ab |
| 2.7 | Übungen: Besitzer für eigene Übungen, Import nur für ein Betreiberkonto, `videoUrl` nur `http(s)` | 16 | M | Konto B kann eine Übung von Konto A nicht ändern; Test in `dataSeparation` |
| 2.8 | Sauberes Herunterfahren: `exec node` im CMD, `app.close()` bei SIGTERM, Healthcheck mit Datenbankabfrage in Compose | 21 | S | `docker compose restart backend` dauert unter 3 Sekunden |
| 2.9 | Deutsche Fehlertexte im Frontend anhand des Statuscodes; Label-Tabelle für Muskelgruppen und Geräte; Namensübersetzung in den Import | 10 | M | Login mit falschem Passwort zeigt deutschen Text; Filter zeigen „Bauch“, „Kurzhantel“ usw. |
| 2.10 | Touch-Ziele: destruktive Buttons und Tabs auf 44 px, Info-Buttons mit größerer Trefferfläche | 12 | M | Messskript findet keine Lösch-Buttons unter 44 px |
| 2.11 | Prisma aktualisieren oder `deepmerge-ts` per Override anheben | 22 | S | `pnpm audit --prod` ohne high |

---

## Stufe 3 — Körperfett neu aufsetzen

Hintergrund und Formeln: Abschnitt „Körperfett“ in `review.md`.

| # | Aufgabe | Aufwand | Fertig, wenn |
|---|---------|---------|--------------|
| 3.1 | Datenmodell: Taille, Hals, Hüfte (cm, optional) je Messung; Migration, Schema, Export | M | Werte lassen sich speichern, bearbeiten und exportieren |
| 3.2 | Eingabe mit kurzer Messanleitung (morgens, Nabelhöhe, entspannt ausgeatmet, zweimal messen) | M | Formular „Neue Messung“ hat die drei Felder und einen aufklappbaren Hinweis |
| 3.3 | `packages/shared/src/bodyFat.ts`: RFM und US-Navy als reine Funktionen mit Tests gegen nachgerechnete Beispielwerte | S | Unit-Tests grün, u. a. 182 cm / Taille 88 / Hals 39 → 22,6 % und 17,3 % |
| 3.4 | Karte „Körperfett-Schätzung“: Schätzbereich aus beiden Formeln, Taille-zu-Größe-Verhältnis, Trend der Taille als Hauptanzeige | M | Anzeige „etwa 17–23 %“ statt einer Einzelzahl; Info-Button erklärt beide Formeln |
| 3.5 | Waage nur noch als Trend: gleitendes 7-Tage-Mittel im Verlauf und auf dem Fortschritts-Tab | S | Einzelwerte springen nicht mehr in der Hauptanzeige |
| 3.6 | Optionale Kalibrierung: DEXA-Wert mit Datum eintragen, Differenz speichern und auf künftige Schätzungen anwenden | M | Nach Eingabe eines Referenzwerts verschiebt sich der Schätzbereich nachvollziehbar, mit Kennzeichnung „kalibriert“ |
| 3.7 | CUN-BAE nur noch als Rückfall ohne Umfänge, mit Hinweis für Trainierte; FFMI-Warnung nur unter 25 % Körperfett | S | Fall 130 kg / 180 cm / 37 % löst keine Warnung mehr aus |
| 3.8 | Tab „Körper“ neu ordnen: letzte Messung, neue Messung, Schätzung, Verlauf; Importe und Analysen eingeklappt | M | Formular „Neue Messung“ ist bei 390 px ohne Scrollen über mehr als einen Bildschirm erreichbar |

---

## Stufe 4 — Aufräumen

| # | Aufgabe | Befund | Aufwand | Fertig, wenn |
|---|---------|--------|---------|--------------|
| 4.1 | Import für `backup.json` (Wiederherstellen eines Kontos aus dem eigenen Export) | 2 | L | Export aus Konto A lässt sich in ein leeres Konto einspielen |
| 4.2 | README auf den aktuellen Stand bringen (Funktionsumfang, Node-Version, Backup-Anleitung) | 23 | S | README nennt kein Wasser-Tracking mehr und passt zu `package.json` |
| 4.3 | Roadmap-Dateien zusammenführen (`ROADMAP.md`, `roadmap3.md`, `roadmapv2_additionals.md`, `docs/roadmap2.md`); `context.txt` und `context2.txt` entfernen | 23 | M | Eine Roadmap, keine Code-Auszüge im Repo |
| 4.4 | Entscheidung zur Historie: die 43.000 versehentlich committeten Dateien per Neuaufbau der Historie entfernen oder bewusst belassen | 23 | M | Entscheidung dokumentiert; falls bereinigt, Klon deutlich kleiner |
| 4.5 | Schutz gegen Wiederholung: Pre-Commit-Prüfung oder CI-Schritt, der Commits mit `node_modules/` oder `dist/` ablehnt | 23 | S | Ein solcher Commit schlägt in der CI fehl |
| 4.6 | Lighthouse-Lauf (PWA, Performance, Barrierefreiheit) als warnender CI-Schritt; einmal mit Screenreader durch Login und Training | — | M | Bericht liegt vor, Auffälligkeiten sind als Aufgaben erfasst |
| 4.7 | Test auf echtem iPhone und Android-Gerät: Installation, Offline-Kaltstart, Push, Kamera | — | M | Checkliste abgehakt, Abweichungen erfasst |

---

## Nicht einplanen

- **Access-Token-Sperrliste (Befund 24):** 15 Minuten Restlaufzeit sind für diese App vertretbar; der Aufwand steht in keinem Verhältnis.
- **Weitere Körperfett-Formeln sammeln:** Mehr BMI-basierte Varianten verbessern nichts. Der Gewinn liegt in den Umfangsmaßen (Stufe 3).

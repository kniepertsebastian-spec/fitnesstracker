# Roadmap 3: Fitnesstracker

Quelle: Wünsche des Nutzers (P0, höchste Priorität) und das strenge PWA-Review vom 19.10.2026
(P1–P4). Reihenfolge innerhalb einer Priorität = empfohlene Umsetzungsreihenfolge.

---

## P0 – Nutzerwünsche (an allererster Stelle)

### P0.1 Plan im Fokusmodus anpassen

- [x] **Übungen direkt im Training ändern.** Im Fokusmodus („Training starten“) eine Übung des
  heutigen Tages austauschen, hinzufügen, entfernen und in der Reihenfolge verschieben, ohne den
  Fokusmodus zu verlassen.
- [x] **Austausch-Vorschläge.** Beim Tauschen werden Alternativen mit gleicher Hauptmuskelgruppe
  und erlaubtem Equipment angeboten (siehe P0.2), z. B. wenn ein Gerät belegt ist.
- [x] **Nur heute oder dauerhaft.** Beim Ändern wählen, ob die Änderung nur für diese Einheit gilt
  oder in den Plan (Phase + Trainingstag) übernommen wird.
- [x] Bereits geloggte Sätze bleiben unverändert; Fortschritt, „Letztes Mal“ und PR-Erkennung
  beziehen sich auf die tatsächlich trainierte Übung.
- [x] **Offline-fähig** wie das übrige Training: Die Änderung wird lokal gespeichert und
  synchronisiert, sobald wieder Netz da ist.

### P0.2 KI-Plan-Generator: Split und Equipment abfragen

- [x] **Bevorzugten Split abfragen.** Der Fragebogen fragt aktiv nach dem Split (z. B.
  Ganzkörper, Ober-/Unterkörper, Push/Pull/Beine, Bro-Split, „egal – KI entscheidet“), statt ihn
  nur aus der Trainingshäufigkeit abzuleiten (`SPLIT_TEMPLATES` in `promptBuilder.ts`). Die
  Auswahl wird gespeichert und bei der nächsten Generierung vorbelegt.
- [x] **Erlaubtes Equipment als Mehrfachauswahl** statt der drei Pauschalwerte
  `homegym | dumbbells | fullgym`:
  - Geräte/Maschinen
  - Kurzhanteln
  - Langhantel (inkl. SZ-Stange)
  - Kabelturm
  - Ohne Geräte (Körpergewicht)
  - optional: Kettlebells, Bänder, Medizinball, Gymnastikball, Foam Roller, Sonstiges
- [x] **Ausschlüsse ausdrücklich abfragen** („Mit welchen Mitteln möchtest du keine Übungen?“).
  Ausgeschlossenes Equipment wird hart herausgefiltert: im Kandidatenkatalog vor dem Prompt
  und zusätzlich in der Validierung der KI-Antwort, damit die KI nichts davon vorschlagen kann.
- [x] **Standard für alle neuen Fragebögen:** nur Geräte, Kurzhanteln, Langhantel, Kabelturm und
  Körpergewicht. **Keine** Übungen mit Gymnastikball (`exercise ball`), Medizinball
  (`medicine ball`) oder ähnlichem Kleingerät.
- [x] Equipment-Präferenz gilt auch für die Austausch-Vorschläge aus P0.1. (Tages-Challenge ist
  ohnehin gerätefrei, Ziel-Vorschläge beziehen sich nur auf bereits trainierte Übungen.)

### P0.3 Dehnübungen ohne Partner

- [x] **Partner-Dehnübungen streichen.** Dehnübungen, für die zwei Personen nötig sind (im
  free-exercise-db-Katalog z. B. Namen mit „Partner“ / „with partner“ / „assisted“), werden aus der
  Dehnplan-Auswahl (`stretching.service.ts`, `stretchSelection.ts`), der Daily-Dehnroutine und
  der KI-Dehnplan-Erstellung ausgeschlossen.
- [x] Bestehende Dehnpläne bereinigen (Migration oder einmaliges Neu-Erzeugen betroffener Tage).
- [x] Test: Kein Partner-Stretch landet mehr in einem generierten oder vorgeschlagenen Plan.

### P0.4 KI-Plan-Generator: Qualität und Kontrolle

- [x] **Ausgewogener Übungskatalog für den Prompt.** Bisher gingen die ersten 150 Übungen in
  Datenbank-Reihenfolge an die KI (bei „Vollausgestattetes Studio“ praktisch A–C; Beinpresse,
  Latzug, Rudern am Kabel, Klimmzüge, Rumänisches Kreuzheben fehlten). Neu: je Muskelgruppe
  eine feste Anzahl, bevorzugt Grundübungen und bereits geloggte Übungen.
- [x] **KI-Zusatzinfos speichern statt verwerfen:** Wiederholungsbereich, Ziel-RIR, Satzpause,
  Technik-Hinweis und Alternativübung je Plan-Übung; Begründung des Plans anzeigen. Die
  Satzpause startet den Pausen-Timer, die Alternative dient dem Übungstausch (P0.1).
- [x] **Vorschau vor dem Übernehmen.** Der generierte Plan ist zuerst ein Entwurf: übernehmen,
  verwerfen oder einzelne Tage neu generieren. Der vorherige Plan bleibt einmal
  wiederherstellbar.
- [x] **Fragebogen-Antworten speichern** und beim nächsten Mal vorbelegen (bisher jedes Mal
  „Homegym“ + „Anfänger“).
- [x] **Antwort prüfen:** Übungsanzahl je Tag, keine Duplikate am selben Tag; fehlende Einträge
  aus dem Katalog passend zum Tagesfokus auffüllen.
- [x] **Startgewicht vorschlagen** aus den Bestleistungen der letzten 8 Wochen.

---

## P1 – Kritisch (Kernnutzen im Studio)

### P1.1 Mobile Darstellung bei großer Schrift/Anzeigegröße ✅

- [x] Bei schmalem Viewport (~320 px, z. B. große System-Schrift nach Android-Update) lief jede
  Seite seitlich über. Behoben: Kopfzeile schrumpft, einspaltige Grids mit `grid-cols-1`,
  Wochen-Kacheln skalieren. Verifiziert bei 300–412 px.
- [x] Regressionsschutz: E2E-Test, der alle Seiten bei 320 px auf `scrollWidth <= innerWidth`
  prüft.

### P1.2 Training offline kaltstarten

- [x] React-Query-Cache in IndexedDB persistieren (`PersistQueryClientProvider` +
  Async-Storage-Persister, `gcTime` ≥ 24 h). Mindestens Plan, Wochenstatus, Übungen des Plans,
  Cardio- und Dehnplan.
- [x] E2E-Test: App offline frisch öffnen → Training starten → Satz loggen → online → Sync.

### P1.3 Bildschirm im Training wach halten, Pausen-Timer bei Sperrbildschirm

- [x] Screen Wake Lock (`navigator.wakeLock`) im Fokusmodus, bei `visibilitychange` neu
  anfordern.
- [x] Pausen-Ende bei gesperrtem Bildschirm melden: beim Start der Pause einen verzögerten Push
  serverseitig planen, bei Abbruch/±15 s stornieren bzw. verschieben.

### P1.4 Gelöschte Sätze verschwinden auf allen Geräten

- [x] `fetchAndCacheWorkoutLogs` gleicht ab: lokal synchronisierte Zeilen (`id !== null`), die
  der Server nicht mehr liefert und die nicht in der Pending-Queue stehen, werden entfernt.
- [ ] Danach Delta-Sync (siehe P2.1). (`bulkPut` statt einzelner `put` ist schon umgesetzt.)

---

## P2 – Hoch (Performance, Robustheit, Installierbarkeit)

### P2.1 Delta-Sync statt komplette Historie

- [ ] `GET /workout-logs?updatedSince=…` plus Tombstones für Löschungen; `bulkPut` statt
  einzelner `put`-Aufrufe.

### P2.2 Code-Splitting

- [ ] Routen mit `React.lazy` laden (aktuell ein einziger JS-Chunk mit ca. 780 KB). Ui-Kit,
  Kamera, KI-Generator, Körperanalyse zuerst auslagern.

### P2.3 Caddy: Cache- und Security-Header

- [x] `Cache-Control: no-cache` für `/sw.js`, `/index.html`, `/manifest.webmanifest`.
- [x] `Cache-Control: public, max-age=31536000, immutable` für `/assets/*`.
- [x] CSP, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- [ ] Cloudflare-Caching für `sw.js` prüfen (nur im Cloudflare-Dashboard möglich: keine Cache-Regel mit
  eigenem „Edge TTL“ für `/sw.js`, `/index.html`, `/manifest.webmanifest`, sonst überschreibt sie das
  `no-cache` des Servers).

### P2.4 Manifest vervollständigen

- [x] `lang: "de"` (Build erzeugt derzeit `"en"`), `id`.
- [x] `shortcuts`: „Training starten“, „Daily“, „Fortschritt“.
- [x] `screenshots` (schmal + breit) für den erweiterten Android-Installationsdialog.
- [x] `apple-touch-icon` in 180×180. Dabei aufgefallen: Die PWA-Icons waren ein blaues Platzhalter-Quadrat und
  passten nicht zum App-Logo — jetzt aus dem Logo erzeugt (`scripts/generate-pwa-icons.mjs`).

### P2.5 Dauerhafter Speicher

- [x] `navigator.storage.persist()` nach dem Login anfordern, damit offline geloggte, noch nicht
  synchronisierte Sätze nicht vom Browser gelöscht werden.

---

## P3 – Bedienung und Effizienz

- [x] **Satz loggen mit einem Tap:** Speichern-Button als größte, daumennahe Fläche;
  Gewichts-Schrittweite je Übung merken (2,5 / 5 kg); RIR als Auswahl 0–4 statt Eingabefeld.
- [x] **Progressionsvorschlag in der Satzzeile** (Logik aus Phase 24 sichtbar machen), z. B.
  „Heute: 82,5 kg × 8 (+2,5)“.
- [x] **Untere Tab-Leiste** auf dem Handy (Heute · Training · Fortschritt · Plan · Mehr) statt
  Hamburger-Menü mit zehn Einträgen; Tagebuch und Historie zusammenlegen.
- [x] **App-Badge** (`navigator.setAppBadge`) für offene Session bzw. nicht synchronisierte Sätze.
- [x] ~~**Aktionen in Benachrichtigungen**, z. B. Supplement-Erinnerung direkt mit „Genommen“
  bestätigen.~~ Entfällt (Entscheidung des Nutzers): keine Einnahme-Erfassung geplant.
- [x] Eigenen Timer-Sound als Blob in IndexedDB statt als Data-URL im localStorage speichern.
- [x] Skeleton der App-Shell statt „Lädt…“ beim Offline-Kaltstart (`ProtectedRoute`).

---

## P3b – KI-Generator Ausbau

- [ ] Alle drei Rotationsphasen in einem Durchgang generieren; Hauptübungen bleiben über die
  Phasen gleich, nur Sätze/Wiederholungen/Tempo wechseln.
- [ ] Plateau-Erkennung (aus den Ziel-Vorschlägen) nutzen: stagnierende Übungen durch Varianten
  ersetzen.
- [ ] Cardio und Dehnen im selben Fragebogen planen.

---

## P4 – Fehlende Funktionen

- [ ] **Plattenrechner** in der Satzzeile (welche Scheiben pro Seite).
- [ ] **Automatische Aufwärmsätze** (z. B. 40/60/80 % des Arbeitsgewichts), zählen nicht ins
  Volumen und nicht als PR.
- [ ] **Notiz pro Übung/Satz** (z. B. Sitzeinstellung, Beschwerden), im Training sichtbar.
- [ ] **Wochenvolumen pro Muskelgruppe** (Sätze pro Muskel) auf der Fortschrittsseite.
- [ ] **Körpergewicht schnell erfassen** vom Dashboard, mit gleitendem 7-Tage-Mittel.
- [ ] **Health-Integration** (Health Connect bzw. Import aus Apple Health).
- [ ] **Trainingszusammenfassung teilen** (`navigator.share`).
- [ ] **Kalender-Heatmap der Trainingstage + Streak** auf dem Dashboard.

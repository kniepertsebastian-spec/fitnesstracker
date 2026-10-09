# UI-/UX-Roadmap – Fitnesstracker

> **Geltungsbereich:** Oberfläche, Bedienung und die wenigen dafür nötigen Daten- und API-Erweiterungen. Backend, Sync-Logik und Betrieb bleiben, wie sie in `ARCHITECTURE.md` und `CHANGELOG.md` beschrieben sind. Wo eine UI-Änderung Sync, Auth oder Datenmodell berührt, gehen deren Regeln vor.
>
> **Referenz:** Design-Entwurf „Fitnesstracker – UI Redesign“ (claude.ai, Design-Canvas) mit 7 Screens. Designsprache übernommen aus der UI-Roadmap der Learning-Plattform (CertStudy AI), angepasst an eine mobile Trainings-App. Wo Entwurf und dieses Dokument abweichen, gilt dieses Dokument. Alle Zahlen und Namen in den Screens sind Beispieldaten.
>
> | Nr. | Screen | Phase |
> |---|---|---|
> | 1 | Heute – Dashboard (mobil) | F3 |
> | 2 | Training – Fokusmodus | F4 |
> | 3 | Daily – Challenge, Dehnen, Cardio | F5 |
> | 4 | Fortschritt | F6 |
> | 5 | Trainingsplan – 8-Wochen-Rotation | F7 |
> | 6 | Desktop – Heute mit Seitenleiste | F2, F3 |
> | 7 | Menü – mobil | F2 |
>
> **Regel:** Ein Punkt wird erst abgehakt, wenn er gebaut *und* geprüft ist. Eine Phase ist erst abgeschlossen, wenn ihr **Gate** erfüllt ist. UI-Punkte gelten erst als geprüft, wenn die [Definition of Done für UI](#definition-of-done-für-ui) erfüllt ist.
>
> **Festgelegt (09.10.2026):** nur Dunkelmodus · Oberfläche Deutsch (Englisch später möglich, siehe [Später](#später)) · Navigation behält die bisherigen zehn Menüpunkte in der bisherigen Reihenfolge, keine Tab-Leiste.

---

## Inhalt

- [Ausgangslage](#ausgangslage)
- [Leitplanken](#leitplanken)
- [Designsprache (verbindlich)](#designsprache-verbindlich)
- [F1 – Fundament: Tokens, Schrift, Komponenten](#f1--fundament-tokens-schrift-komponenten)
- [F2 – App-Shell und Navigation (Screens 6, 7)](#f2--app-shell-und-navigation-screens-6-7)
- [F3 – Dashboard „Heute“ (Screens 1, 6)](#f3--dashboard-heute-screens-1-6)
- [F4 – Training im Fokusmodus (Screen 2)](#f4--training-im-fokusmodus-screen-2)
- [F5 – Daily (Screen 3)](#f5--daily-screen-3)
- [F6 – Fortschritt (Screen 4)](#f6--fortschritt-screen-4)
- [F7 – Trainingsplan (Screen 5)](#f7--trainingsplan-screen-5)
- [F8 – Restliche Seiten](#f8--restliche-seiten)
- [Später](#später)
- [Nicht-Ziele](#nicht-ziele)
- [Reihenfolge und Abhängigkeiten](#reihenfolge-und-abhängigkeiten)
- [Definition of Done für UI](#definition-of-done-für-ui)

---

## Ausgangslage

Lesebefund aus dem Repo (09.10.2026, Stand `main` = `09fdcdd`), keine Testergebnisse:

- **Keine Design-Tokens.** `tailwind.config.js` definiert eine violett getönte Graupalette `ink` und nutzt Tailwind-`violet` als Akzent. Im JSX stehen die Rohwerte direkt: ~430× `text-ink-*`, ~220× `bg-ink-*`, ~160× `border-ink-*`, ~85× `bg-violet-*`, dazu `red`, `emerald`, `amber`.
- **Keine Basiskomponenten.** Es gibt kein `components/ui/`. Die Kartenklasse `rounded-lg border border-ink-800 bg-ink-900 p-4` ist in 35 Dateien kopiert, ~115 rohe `<button>`, fünf eigene `*FormDialog`-Komponenten mit je eigenem Dialog-Aufbau.
- **Schriften vom Google-CDN** (Manrope, Space Grotesk über `fonts.googleapis.com` in `index.html`). Das widerspricht „Daten bleiben auf dem eigenen Server“ und lädt offline nicht.
- **Keine Icon-Bibliothek**, dafür 17 Emojis in 11 Dateien als Bedeutungsträger (u. a. 🔥 Serie, 🏆 Rekord, ⏸ Plateau, 🔀 Tauschen, 🎉 Ziel erreicht).
- **Navigation:** Hamburger oben links öffnet ein 192 px breites Dropdown mit zehn Einträgen. Auf dem Desktop gibt es kein eigenes Layout, der Inhalt läuft mit `px-4` über die volle Breite.
- **Training** verteilt sich auf Dashboard („Training starten“), Fitnesstagebuch (Plan-Tabelle, „+ Satz“, Session-Leiste) und das schwebende `RestTimerWidget`. Es gibt keinen Modus, der während des Satzes alles andere ausblendet.
- PWA-Farben `theme_color`/`background_color` `#1a1622` (violett).

Was bleibt und wiederverwendet wird: die komplette Daten- und Sync-Schicht (`hooks/*`, `offline/*`, `api/*`, Dexie, TanStack Query), `useWorkoutSession`, Progressionsvorschlag und Vorbefüllung (P1.1), Satzpausen-Timer mit Endzeitpunkt (P1.2), PR-Erkennung (P1.3), `Sparkline`, `prDetection`, `oneRepMax`, `SyncStatusIndicator` (Logik), `UpdatePrompt` (Logik), Safe-Area-Abstände in `AppShell`.

---

## Leitplanken

Der Umbau ist **Optik und Bedienung**. Er darf nichts davon verschlechtern:

- **Offline zuerst:** Jede Aktion, die heute offline geht (Satz loggen, Training starten/pausieren/beenden), geht danach genauso offline. Die E2E-Suite `frontend/e2e/offline-sync.spec.ts` bleibt grün.
- **Kein stilles Verwerfen:** Sync-Status und fehlgeschlagene Änderungen bleiben sichtbar (P0.3).
- **Schnelles Loggen:** Ein Satz ist mit höchstens zwei Tipps erfasst (abhaken, oder Wert ändern + abhaken). Neue Gestaltung darf hier keinen Tipp hinzufügen.
- **Kein Neuladen mitten im Training** (P0.6): Update-Leiste nicht im Fokusmodus anzeigen, erst danach.
- **Leitfrage aus `roadmapv2_additionals.md`:** Neue Elemente müssen dem Training, dem Verständnis des Fortschritts oder der Motivation aus eigenen Daten dienen.

---

## Designsprache (verbindlich)

Diese Werte sind die Quelle der Wahrheit. **Keine Farb-, Radius- oder Schattenwerte außerhalb der Tokens** im JSX. Gleiche Token-Namen und Werte wie bei der Learning-Plattform (Dunkelmodus), damit beide Apps zusammenpassen.

### Farben

| Token | Wert | Verwendung |
|---|---|---|
| `--bg` | `#0A0C10` | Seitenhintergrund |
| `--bg-sidebar` | `#0E1117` | Kopfleiste, Seitenleiste, Fokusleiste, Menü-Sheet |
| `--surface` | `#12161E` | Karten, Tabellen, Panels |
| `--surface-2` | `#171D28` | Innenflächen, aktive Nav-Einträge, offene Checklisten-Zeilen |
| `--surface-inset` | `#0F1219` | Segment-Control, Stepper |
| `--control` | `#1A212D` | Sekundär-Buttons |
| `--track` | `#1E2633` | Hintergrund von Balken, gewählter Segment-Eintrag |
| `--border` | `#222938` | Standardrahmen |
| `--border-strong` | `#2A3242` | Rahmen von Controls |
| `--border-subtle` | `#1C2230` | Tabellenzeilen, Trenner |
| `--text` | `#E8ECF3` | Haupttext |
| `--text-2` | `#C9D0DC` | Werte in Listen |
| `--text-muted` | `#AEB7C6` | Nav-Einträge, Sekundärtext |
| `--text-subtle` | `#9AA4B5` | Untertitel, Labels |
| `--text-faint` | `#8C96A8` | Meta-Angaben (nur ≥ 12 px) |
| `--accent` | `#34E3A4` | Primär (Mint): Buttons, Fortschritt, erledigt, Rekord |
| `--accent-hover` | `#7BF0C6` | Link-Hover |
| `--on-accent` | `#04140D` | Text auf Mint |
| `--accent-soft` | `rgba(52,227,164,0.12)` | Mint-Badges, Icon-Hintergründe |
| `--accent-border` | `#1F4A3B` | Rahmen bei Mint-Flächen |
| `--info` / `--info-text` | `#6EA8FF` / `#8DBBFF` | Laufende Übung, Muskelgruppen, Körperdaten |
| `--warning` | `#F4B740` | Offline/ausstehend, Plateau, Serie |
| `--danger` / `--danger-text` | `#FF7A66` / `#FF9A8A` | Sync-Fehler, Löschen, überfällig |
| `--violet` | `#C9A2FF` | Nur Kategorie „Technik“ und KI-Funktionen |

Hero-Fläche („Heute dran“, „Aktuelle Phase“): `linear-gradient(135deg, #12201B 0%, #12161E 55%)`, Rahmen `#1F3A30`. **Sonst keine Verläufe.**

### Feste Bedeutungsfarben

| Bedeutung | Farbe |
|---|---|
| Phase Aufbau / Muskelausdauer / Negativ | Mint / Info-Blau / Bernstein |
| Challenge Progression / Volumen / Konsistenz / Technik / Erholung | Mint / Info-Blau / Bernstein / Violett / Neutral (`--track`, `--text-muted`) |
| Sync: synchronisiert / offline oder ausstehend / fehlgeschlagen | Mint / Bernstein / Koralle |
| Satz erledigt / aktueller Satz / offen | Mint gefüllt / Mint-Rahmen / `--border-strong` |

Farbe trägt nie allein Bedeutung: immer Text oder Icon dazu.

### Typografie

Schrift: **Geist** (Text), **Geist Mono** (Timer, Dauer, Satznummern, Satz-/Wdh.-Angaben wie `4 × 6–8`, Kalenderwochen). **Selbst ausgeliefert** aus dem Repo bzw. einem npm-Paket, nicht vom Google-CDN. Zahlen in Statistiken, Tabellen und Timern mit `font-variant-numeric: tabular-nums`.

| Stufe | Größe / Zeilenhöhe | Gewicht | Laufweite | Einsatz |
|---|---|---|---|---|
| H1 | 28 px mobil / 34 px Desktop, 1.15 | 600 | −0.025em | Seitentitel, Begrüßung |
| H1 Fokus | 24 px / 1.2 | 600 | −0.02em | Übungsname im Training |
| H2 Hero | 24–26 px / 1.2 | 600 | −0.02em | Titel in Hero-Karten |
| H2 | 16–17 px | 600 | 0 | Kartentitel |
| Wert groß | 26–28 px | 600 | −0.02em | Stat-Kacheln |
| Timer | Geist Mono 40 px | 500 | −0.02em | Satzpause |
| Body | 14–15 px / 1.5 | 400–500 | 0 | Standard |
| Small | 12–13 px | 400–500 | 0 | Meta, Tabellen |
| Overline | 11–12 px, GROSS | 600 | 0.06–0.08em | „Heute dran“, „Satzpause“, „Als Nächstes“ |

### Radius, Abstände, Schatten, Bewegung

- **Radius:** `sm 9` (Nav-Einträge, kleine Controls) · `md 10–12` (Buttons, Inputs, Stepper) · `lg 12` (Innenpanels) · `xl 14` (Challenge-Kacheln, Stat-Kacheln) · `2xl 16` (Karten) · `3xl 18` (Hero, Übungskarte im Training) · `full` (Pills, Badges, Avatare).
- **Abstände:** 4-px-Raster. Seitenpadding mobil `16 px`, Desktop `28–40 px`. Zwischen Karten `12–16 px`, zwischen Sektionen `16–24 px`.
- **Schatten:** praktisch keine; Tiefe über Flächenstufen `bg → surface → surface-2`. Ausnahme: Menü-Sheet und Dialoge (`-24px 0 48px rgba(0,0,0,.35)`).
- **Bewegung:** 150 ms Hover/Zustände, 200–250 ms Einblenden (Sheet, Rekord-Meldung). `prefers-reduced-motion` respektieren.
- **Touch-Ziele:** mindestens 44 px, im Training **48 px** (Stepper, Abhaken), weil mit Kreide oder Handschuhen getippt wird.
- **Icons:** `lucide-react`, Strichstärke 1.8–2, 16–20 px. **Keine Emojis.**

### Sprache und Begriffe

- Oberfläche vollständig Deutsch, keine englischen Reste.
- Feste Begriffe: „Dashboard“, „Daily“, „Fitnesstagebuch“, „Historie“, „Übungen“, „Plan“, „Fortschritt“, „Ziele“, „Ernährung“, „Einstellungen“ (Menüpunkte unverändert), „Satzpause“, „Tages-Challenge“, „Dehnroutine“, „Rekord“, „Phase“, „Wdh.“, „RIR“.

---

## F1 – Fundament: Tokens, Schrift, Komponenten

**Ziel:** Jede spätere Seite wird nur noch aus Tokens und `components/ui/*` gebaut.

### Tokens und Schrift

- [x] Alle Farb-Tokens aus der [Designsprache](#designsprache-verbindlich) als CSS-Variablen in `src/styles/index.css` (`:root`), in `tailwind.config.js` als Farben verfügbar (`bg-surface`, `text-muted`, `border-strong`, `bg-accent`, `text-on-accent`, …), Radius- und Schriftskala ebenso. Tailwind 3 bleibt (kein Versionssprung als Nebeneffekt).
- [x] Geist und Geist Mono selbst ausliefern; Google-Fonts-Links aus `index.html` entfernen. Prüfen, dass die Schriften im Service-Worker-Precache landen (offline).
- [x] `theme_color` und `background_color` in `vite.config.ts` auf `#0A0C10`.
- [x] Prüfskript (oder ESLint-Regel): keine Hex-Werte und keine Tailwind-Paletten (`ink-*`, `violet-*`, `red-*`, `emerald-*`, `amber-*`) im JSX außerhalb von `components/ui`. Zum Start erzeugt es nur die Liste der Treffer (im PR), ab F8 bricht es die CI.

### Komponenten (`src/components/ui/`)

Eigene, schlanke Komponenten auf Tailwind-Basis. **Radix-Primitives nur für `Dialog`, `Sheet` und `DropdownMenu`** (Fokusfalle, Esc, Portale); alles andere ohne neue Abhängigkeit.

- [x] `Button` – `primary` (Mint, Text `--on-accent`, 600), `secondary` (`--control`, Rahmen `--border-strong`), `ghost` (transparent, Rahmen), `dashed` (gestrichelt, für „+ Satz“, „+ Übung hinzufügen“), `danger`. Größen `sm 36`, `md 44`, `lg 48` px. Icon links/rechts optional. Ein `Button` kann als Link gerendert werden (React-Router `Link`).
- [x] `IconButton` – 44×44, `aria-label` Pflicht (Typprüfung).
- [x] `Card` – `surface`, Rahmen `border`, Radius 16, Padding 16 mobil / 20–22 Desktop. Variante `hero` (Verlauf, Rahmen `#1F3A30`, Radius 18). Optionaler Kopf mit Titel und Aktion rechts.
- [x] `Badge` – Radius `full`, 12 px, 500–600. Töne `accent | info | warning | danger | violet | neutral`, weiche Fläche (12–14 % Alpha) + farbiger Text.
- [x] `StatTile` – Label (12.5–13, subtle), Wert (26–28, 600, tabular-nums) mit Einheit klein, Unterzeile (12, optional farbig).
- [x] `ProgressBar` (5/6/8 px) und `SegmentedProgress` (N Segmente à 6–8 px, Lücke 4 px, Zustände offen/erledigt/aktuell).
- [x] `SegmentedControl` – Pillen auf `--surface-inset`, gewählter Eintrag `--track`; ersetzt `RangeTabs`, `PhaseTabs`, `PageTabs` optisch.
- [x] `Stepper` – Minus / Wert mit Einheit / Plus, 48 px hoch, auf `--surface-inset`; Schrittweite als Prop (2,5 kg, 1 Wdh.); Tastatur: Pfeiltasten.
- [x] `CheckRow` – Kreis-Checkbox 24 px + Titel + Meta + Pfeil, ganze Zeile klickbar (`button` mit `aria-pressed`), 52 px.
- [x] `SetCheck` – 44–48 px Quadrat zum Abhaken eines Satzes (offen / aktuell / erledigt).
- [x] `ListRow` – Zeile mit `--border-subtle` oben, ≥ 52 px, optional Mono-Präfix (Nummer) und Mono-Wert rechts.
- [x] `EmptyState` – Icon, ein Satz, eine Aktion. Ersetzt alle „Noch keine …“-Zeilen.
- [x] `Callout` – Töne `info | warning | danger`: Icon-Kachel 32 px + Text, Fläche 6–8 % Alpha, Rahmen im abgedunkelten Ton (Hinweise, Formularfehler, Sync-Fehler).
- [x] `Dialog`, `Sheet` (rechts, 320 px mobil / 360–420 px Desktop), `DropdownMenu`, `Toast` (Rekord, Ziel erreicht, Fehler), `Skeleton`.
- [x] `StatusPill` – Sync-Zustand (synchronisiert / offline · n ausstehend / n fehlgeschlagen), nutzt die Logik von `SyncStatusIndicator`, öffnet dessen Panel.
- [x] Übersichtsseite `/ui` (nur im Dev-Build oder hinter Einstellungen versteckt) mit allen Komponenten und Zuständen – dient als Sichtprüfung.

### Gate F1

- Alle Komponenten existieren, nutzen nur Tokens und sind auf der Übersichtsseite geprüft.
- Kontrast aller Textstufen auf `bg`, `surface`, `surface-2` gemessen und im PR dokumentiert.
- Lint, Typecheck, Unit- und E2E-Tests grün; Offline-Reload lädt die Schriften aus dem Cache.

---

## F2 – App-Shell und Navigation (Screens 6, 7)

**Ziel:** Gleiche zehn Menüpunkte wie bisher, aber eine Shell, die auf dem Handy schnell und auf dem Desktop breit funktioniert.

- [x] **Menüpunkte unverändert** in dieser Reihenfolge: Dashboard, Daily, Fitnesstagebuch, Historie, Übungen, Plan, Fortschritt, Ziele, Ernährung, Einstellungen. Der Phasen-Hinweis am Eintrag „Plan“ bleibt (als `Badge`, z. B. „Aufbau · W3“).
- [x] **Mobil (< 1024 px):** Kopfleiste auf `--bg-sidebar`: Logo-Kachel (30 px, Mint, Hantel-Icon), „Fitnesstracker“, `StatusPill`, rechts Menü-Button (44 px). Der Button öffnet ein `Sheet` von rechts (Screen 7): Logo + Schließen, Primär-Button „Training starten“, die zehn Einträge (46 px, aktiver mit `--surface-2` und Mint-Punkt), unten Benutzerzeile mit „Abmelden“.
- [x] **Desktop (≥ 1024 px):** Seitenleiste 248 px links (Screen 6) mit denselben Einträgen, darüber „Training starten“, unten Benutzerzeile. Inhalt nutzt die Breite (Seitenpadding 28–40 px), lesbare Breiten nur bei Formularen (max. 640 px).
- [x] „Abmelden“ nur noch im Menü bzw. in der Benutzerzeile, nicht mehr in der Kopfleiste.
- [x] `UpdatePrompt`, `RestTimerWidget`, `PRToastHost` auf Tokens umstellen; `UpdatePrompt` im Fokusmodus unterdrücken (Leitplanke).
- [x] Safe-Area-Abstände (`env(safe-area-inset-*)`) beibehalten.

### Gate F2

- Alle bestehenden Seiten laufen in der neuen Shell, keine Seite mehr mit altem Header.
- 390 px: Menü erreichbar, keine horizontale Scrollleiste; 1440 px: Seitenleiste sichtbar.
- Menü per Tastatur bedienbar (Tab, Esc schließt, Fokus kehrt zum Menü-Button zurück).

---

## F3 – Dashboard „Heute“ (Screens 1, 6)

Route `/`. Bausteine bleiben die heutigen (`TodayCard`, `ChecklistCard`, `WeekCard`, `NextGoalCard`, `LastWorkoutCard`), neu gestaltet.

- [x] **Begrüßung:** „Guten Morgen/Tag/Abend, {Name}“ + Zeile „Phase {Phase} · Woche x von 8 · heute Tag {X}“. Ohne Plan: „Noch kein Trainingsplan“ mit Link zum Plan.
- [x] **Hero „Heute dran“:** Overline + „zuletzt vor n Tagen“, Titel „{Tag-Label} – {Muskelgruppen}“, Zeile „n Übungen · n Sätze · ca. n Min.“, die ersten drei Übungen als `ListRow` (Mono-Nummer, Name, `4 × 6–8`) + „+ n weitere“, Primär-Button „Training starten“ (48 px, volle Breite mobil) → F4. Läuft schon eine Session: „Training fortsetzen“ mit Dauer. Pausiertem Plan: Hinweis statt Button.
- [x] **Checkliste „Heute“** mit `CheckRow`: Training, Tages-Challenge (x von 3), Dehnroutine, fällige Supplements; Zähler „x von n erledigt“. Jede Zeile führt zur zuständigen Seite; abgehakt wird dort, wo es fachlich passiert (keine zweite Wahrheit auf dem Dashboard).
- [x] **„Diese Woche“:** 7 Tageskacheln Mo–So (trainiert Mint-Soft mit Häkchen, heute Mint-Rahmen, Rest `--surface-2`), Serien-`Badge` (Bernstein, Flammen-Icon, „n Wochen Serie“), Balken „x von y Trainingstagen“. Desktop: Balkenhöhe = Tagesvolumen.
- [x] **Nächstes Ziel** und **Letztes Training** als zwei Kacheln nebeneinander (mobil) bzw. als Ziele-Spalte und Tabelle „Letzte Trainings“ (Desktop: Datum, Training, Sätze, Volumen, Rekorde).
- [x] Desktop zusätzlich vier `StatTile`: Trainingstage/Woche, Volumen der Woche (Δ zur Vorwoche), neue Rekorde im Monat, Körpergewicht (Δ 3 Monate). Nur Werte, die sich aus vorhandenen Daten berechnen lassen. *(Supplement-Zeile: „abgehakt“ = alle heutigen Erinnerungszeiten verstrichen, da es keinen Einnahme-Status gibt.)*

**Gate F3:** Screens 1 und 6 nachgebaut; alle Zahlen aus echten Daten; leere Zustände gestaltet (neues Konto, kein Plan, keine Ziele, noch kein Training).

---

## F4 – Training im Fokusmodus (Screen 2)

Neue Route `/training` (Fokusmodus) auf Basis von `useWorkoutSession`, `usePlanExercises`, `useWorkoutLogs` und der bestehenden Offline-Queues. Das Fitnesstagebuch bleibt für freies Loggen und Nachtragen.

### Fokusleiste

- [x] Keine Shell-Navigation während einer Session. Fokusleiste (`--bg-sidebar`): Verlassen (44 px, X), „{Tag-Label} · Tag {X}“ + „{Phase} · Woche x von 8“, Dauer (Geist Mono, tabular-nums), Pausieren (44 px). `SegmentedProgress` über alle Übungen des Tages, darunter „Übung x von y“ und „n von m Sätzen“.
- [x] Verlassen fragt per `Dialog`: „Pausieren“, „Abschließen“, „Abbrechen (Sätze bleiben gespeichert)“ – entspricht den heutigen Session-Buttons.

### Übungskarte

- [x] Kopf: Muskelgruppen-`Badge` (Info), Progressions-`Badge` je Phase („Gewicht steigern“ / „Wdh. steigern“ / „langsam ablassen“), Übungsname (24 px), Button „Technik“ → Übungsdetail im `Sheet` (Bilder, Beschreibung, Formanalyse).
- [x] Zeile „Letztes Mal {Sätze × Wdh. · kg}“ und „Vorschlag {kg}“ (Mint) aus der bestehenden Progressionslogik.
- [x] **Satztabelle:** Satz (Mono), Vorher (Mono, faint), kg, Wdh., `SetCheck`. Zustände erledigt / aktuell / offen wie in der Designsprache. Unter dem aktuellen Satz zwei `Stepper` (kg in 2,5er-Schritten, Wdh.) und RIR-Auswahl `0 1 2 3+` (bestehendes Feld). Vorbefüllt mit Vorschlag bzw. letztem Satz.
- [x] Abhaken speichert den Satz sofort (offline-fähig wie heute), Rückgängig über erneutes Tippen auf den erledigten Satz (bestehende Undo-Logik aus P1.x).
- [x] „+ Satz“ und „Supersatz“ (bestehende Supersatz-Gruppierung) als `dashed`-Buttons. Satzanzahl per +/− wie heute.
- [x] Sind alle Sätze erledigt, springt die Ansicht zur nächsten Übung (bestehendes Auto-Schließen).

### Satzpause und Rückmeldung

- [x] **Satzpause** als Karte unter der Übung statt schwebendem Widget: Overline, Restzeit in Geist Mono 40 px, `ProgressBar`, „−15“ / „+15“, „von {Dauer} · Ton und Vibration an/aus“, „Überspringen“. Logik aus `timerStore` (Endzeitpunkt) unverändert.
- [x] **Rekord-Meldung** (P1.3) als Karte oben im Fokusmodus mit Pokal-Icon und Overline „Neuer Rekord“, verschwindet nach ~4,5 s. Kein Emoji.
- [x] **„Als Nächstes“:** die folgenden Übungen als `ListRow`.
- [x] Fußzeile: „Abbrechen“ (ghost) und „Training abschließen“ (secondary). Nach Abschluss Zusammenfassung (Dauer, Sätze, Volumen, Rekorde) mit Link „Zur Historie“.

**Gate F4:** *(Plan-Status wird nicht offline gecacht: ein Neuladen ohne Netz im Fokusmodus zeigt den Plan erst nach Rückkehr des Netzes; laufende Sessions und Satz-Logging funktionieren offline.)* Screen 2 nachgebaut; ein komplettes Training offline (Start → Sätze → Pause → Abschluss → online → Sync) läuft als neuer E2E-Test grün; ein Satz ist mit höchstens zwei Tipps erfasst; 390 px ohne horizontale Scrollleiste.

---

## F5 – Daily (Screen 3)

Route `/daily`.

- [x] **Tages-Challenge:** `SegmentedProgress` (3), je Übung eine Kachel mit Kategorie-`Badge` (Farben siehe Designsprache), Name, Zielwert mit Herleitung („22 Wdh. · 2 über deinem Bestwert“), Tausch-Button (Icon statt 🔀, deaktiviert wenn aufgebraucht, Hinweis „n× tauschen“) und `SetCheck`. Fußzeile „Aus deinem aktuellen Plan · je Übung zweimal tauschbar“.
- [x] **Dehnroutine:** `SegmentedControl` für den Fokus (Ganzkörper, Schultern, Hüfte, Rücken; Werte aus der bestehenden Auswahl), Liste mit Vorschaubild (44 px), Name, Muskel, Dauer (Mono), Primär-Button „Routine starten“. Die Dehnpläne je Trainingstag bleiben erreichbar.
- [x] **Cardio:** Kopf mit „optional“-Badge und „+ Eintragen“, drei Kennzahlen (Minuten, Strecke, Einheiten der Woche), letzte Einträge als `ListRow`. *(Umgesetzt: Min. heute, Min. Woche, Einheiten – ein Streckenfeld gibt es im Datenmodell nicht; neu dafür `GET /cardio-logs/week`.)*

**Gate F5:** Screen 3 nachgebaut; Tauschen und Abhaken offline wie bisher; Bilder ohne Verzerrung.

---

## F6 – Fortschritt (Screen 4)

Route `/progress`. Reine Frontend-Auswertung wie heute, keine neuen Endpunkte.

- [x] Zeitraum als `SegmentedControl` (4W, 3M, 6M, 1J, Alles).
- [x] Vier `StatTile`: Trainingstage/Woche (Ziel), Volumen (Δ zum Vorzeitraum), neue Rekorde, Serie (längste).
- [x] **Kraft und Rekorde:** je Übung Name, Δ im Zeitraum, `Plateau`-Badge (Bernstein, statt ⏸), `Sparkline` (Mint, bei Plateau Bernstein), geschätztes 1RM. Aufklappen zeigt den Verlauf wie heute.
- [x] **Trainingstage pro Woche:** Säulen der letzten 12 Wochen, Ziel erreicht Mint, darunter Kalenderwochen (Mono).
- [x] **Körperdaten:** drei Kacheln (Gewicht, Körperfett, Muskelmasse) mit Δ, „Messung eintragen“, Zeile „Fortschrittsfotos“ mit Datum des letzten Fotos.

**Gate F6:** Screen 4 nachgebaut; Diagramme haben Textalternativen (Δ und Wert als Text); alle Zeiträume mit wenig Daten gestaltet.

---

## F7 – Trainingsplan (Screen 5)

Route `/plan`.

- [x] **Hero „Aktuelle Phase“:** Phase (26 px), „Woche x von 8“, 8-teiliger `SegmentedProgress`, Satz zur Phase („Gewicht steigern bei 6–8 Wdh. Danach folgt {nächste Phase} ab {Datum}.“), Buttons „Pausieren“, „+1 Woche“, „Neu starten“.
- [x] **Rotation:** drei Kacheln Aufbau → Muskelausdauer → Negativ mit Farbpunkt und Regel, aktuelle hervorgehoben.
- [x] **Trainingstage:** `SegmentedControl` A–D (Kürzel + Tagesname), Titel mit „n Übungen · n Sätze“, Übungsliste mit Ziehgriff, Name, Muskel, Sätze × Wdh. (Mono), „+ Übung hinzufügen“. Bearbeiten über die bestehenden Dialoge, neu gestaltet.
- [x] **KI-Plan** als Zeile „Nächste Phase mit KI planen“ (Violett, „Eigener Schlüssel“) → `/plan/generate`. Export/Import und Bemerkungen in das `DropdownMenu` „Weitere Aktionen“.

### Datenanforderung

- [x] **Phase um eine Woche verlängern** (additionals P2.4): Feld am Trainingsplan (z. B. Zahl der Verlängerungswochen der aktuellen Phase), Scheduler und Phasenberechnung berücksichtigen es, Push-Erinnerung zum Phasenwechsel verschiebt sich mit. Migration, Unit-Test der Phasenberechnung, Offline-Verhalten wie bei „Pausieren“.

**Gate F7:** Screen 5 nachgebaut; „+1 Woche“ verschiebt den Phasenwechsel nachweislich (Test); Pausieren und Neustart wie bisher.

---

## F8 – Restliche Seiten

Ohne eigenen Screen; gebaut nur aus `components/ui` und den Mustern der Screens 1–5.

- [x] Fitnesstagebuch (`/diary`): Plan-Tabelle als `ListRow`s, „+ Satz“-Dialog mit `Stepper`, Heute-Sätze.
- [x] Historie (`/history`): nach Tag gruppiert, Tageskarte mit Sätzen, Bearbeiten/Löschen im `Dialog`, Übungsfilter als Such-/Auswahlfeld.
- [x] Übungen (`/exercises`, `/exercises/:id`): Suche, Filter-Pills (Muskelgruppe, Equipment), Karten mit Bild; Detailseite mit Bildern nebeneinander, Beschreibung, eigener Verlauf.
- [x] Ziele (`/goals`): Zielkarten mit `ProgressBar`, Vorschläge mit Stufen als `SegmentedControl` (Konservativ / Realistisch / Ambitioniert).
- [x] Ernährung (`/nutrition`): Profil-Formular, Supplements, Körperkomposition, Fortschrittsfotos (Kamera, Galerie, Vorher/Nachher).
- [x] Einstellungen (`/settings`): Gruppen als Karten (Timer, Benachrichtigungen, KI-Schlüssel, Export).
- [x] Login und Registrierung: zentrierte Karte, Logo-Kachel, Fehlermeldungen als `Callout` in Koralle.
- [x] Alle Emojis durch Icons ersetzt; `ink`- und `violet`-Palette aus `tailwind.config.js` entfernt; das Prüfskript aus F1 bricht ab jetzt die CI.

**Gate F8:** Prüfskript ohne Treffer, keine Emojis, alle Seiten erfüllen die Definition of Done.

---

## Später

Bewusst nach F8; jeweils erst mit eigenem kurzem Konzept.

- [ ] **Englisch:** Texte in eine Übersetzungsschicht ziehen (Muster wie `lib/i18n.tsx` der Learning-Plattform), Sprache in den Einstellungen. Bis dahin keine Vorarbeit erzwingen, aber neue Texte nicht in Hilfsfunktionen verstecken, sondern im JSX lassen, damit sie sich später finden lassen.
- [ ] **Schnell-Loggen per Sperrbildschirm-Benachrichtigung** (Satz abhaken aus der Push-Mitteilung) – nur wenn die Web-Push-Unterstützung der Zielgeräte es hergibt.
- [ ] **Plattenrechner** in der Satzzeile (welche Scheiben pro Seite) – nur bei echtem Bedarf.
- [ ] **Gemeinsames Design-Paket** mit der Learning-Plattform (Tokens und Basiskomponenten als eigenes Paket), sobald beide Apps umgestellt sind.

---

## Nicht-Ziele

- **Hellmodus** (festgelegt: nur dunkel). Tokens sind trotzdem so benannt, dass er später ohne Umbau ergänzt werden kann.
- **Tab-Leiste unten** (festgelegt: Menü wie bisher).
- Kontextwechsel Privat/Firma/Admin aus der Learning-Plattform – gibt es hier nicht.
- Verläufe außer der Hero-Fläche, Glas-Effekte, Emojis, Stockfotos.
- Neue Funktionen unter dem Etikett „Redesign“. Ausnahme ist nur „+1 Woche“ (F7), weil er aus additionals P2.4 schon geplant ist.

---

## Reihenfolge und Abhängigkeiten

| Phase | Hängt ab von | Liefert für | Aufwand (grob) |
|---|---|---|---|
| F1 Fundament | – | alles | M |
| F2 App-Shell | F1 | F3–F8 | S–M |
| F4 Training | F1, F2 | F3 („Training starten“ / „fortsetzen“) | M |
| F3 Dashboard | F2, F4 | – | S–M |
| F5 Daily | F2 | F3 (Checkliste) | S |
| F7 Plan | F2 | F3 (Phase im Kopf) | M (Datenänderung) |
| F6 Fortschritt | F2 | – | S–M |
| F8 Restliche Seiten | F1, F2 | – | M |

Empfohlene Reihenfolge: **F1 → F2 → F4 → F3 → F5 → F7 → F6 → F8.** Das Training zuerst, weil dort die meiste Zeit in der App verbracht wird und die Leitplanke „schnelles Loggen“ am stärksten greift; das Dashboard danach, weil sein Hero direkt in den Fokusmodus führt.

Größen: S = bis 1 Tag, M = wenige Tage, L = mehr als eine Woche (Abend-/Wochenendarbeit nicht eingerechnet).

---

## Definition of Done für UI

Ein UI-Punkt ist erst erledigt, wenn alles davon stimmt:

- [ ] Sieht aus wie der zugehörige Screen (Abstände, Größen, Farben, Zustände) – Vergleich per Screenshot im PR.
- [ ] Funktioniert bei **390 px** ohne horizontale Seitenscroll-Leiste und bei **1440 px** mit Seitenleiste.
- [ ] Vollständig per **Tastatur** bedienbar, sichtbarer Fokusring (2 px, Mint).
- [ ] Kontrast ≥ 4.5:1 für Text (≥ 3:1 ab 24 px); Zustände nie nur über Farbe.
- [ ] Touch-Ziele ≥ 44 px, im Training ≥ 48 px.
- [ ] Nur Tokens und `components/ui/*`, keine Rohfarben, keine Emojis.
- [ ] Leere Zustände, Ladezustände (`Skeleton`) und Fehlerzustände gestaltet.
- [ ] **Offline:** betroffene Aktionen funktionieren offline wie vorher; `pnpm test:e2e` grün; Offline-Reload zeigt die Seite mit Schriften.
- [ ] Lint, Typecheck, Unit-Tests grün; neue Logik mit Tests.
- [ ] Eintrag im `CHANGELOG.md` im bestehenden Format („Verifiziert: wie“).

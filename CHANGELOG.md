# Changelog

Kurzform-Protokoll für alle Änderungen ab jetzt — ein bis zwei Sätze pro Eintrag, kein
Konzept/Umgesetzt/Verifiziert-Aufbau mehr. Die ausführliche Historie bis hierhin steht in
`ROADMAP.md` und `ARCHITECTURE.md`; die bleiben unverändert stehen, werden aber nicht mehr
fortgeführt.

Format: `- **Titel** — was sich geändert hat und warum, falls nicht offensichtlich. Verifiziert: wie.`

## 2026-08-29

- **Workout-Flow optimiert (additionals P1.1)** — Der "+ Satz"-Dialog zeigt jetzt die letzte Leistung der gewählten Übung an und füllt Wdh./Gewicht/Satznummer damit vor; Wdh./kg haben große +/- Stepper statt reiner Tastatureingabe; nach dem Speichern bleibt der Dialog offen (Satznummer hochgezählt, Werte übernommen) statt sich zu schließen, für schnelles Loggen mehrerer Sätze hintereinander. Löschen einzelner Sätze gab es schon. Verifiziert: Playwright End-to-End (Vorbefüllung, Stepper, Mehrfach-Speichern, Aufräumen), kein Overflow bei 375px.
  - Dabei einen Bug gefunden und behoben: Der neue Gewichts-Input hatte kein `step`-Attribut mehr, wodurch der Browser bei Dezimalwerten (z. B. 80.6kg) das Absenden nativ und lautlos blockierte (kein Fehler, kein Handler-Aufruf) — behoben mit `step="any"`.

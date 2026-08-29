# Changelog

Kurzform-Protokoll für alle Änderungen ab jetzt — ein bis zwei Sätze pro Eintrag, kein
Konzept/Umgesetzt/Verifiziert-Aufbau mehr. Die ausführliche Historie bis hierhin steht in
`ROADMAP.md` und `ARCHITECTURE.md`; die bleiben unverändert stehen, werden aber nicht mehr
fortgeführt.

Format: `- **Titel** — was sich geändert hat und warum, falls nicht offensichtlich. Verifiziert: wie.`

## 2026-08-29

- **Workout-Flow optimiert (additionals P1.1)** — Der "+ Satz"-Dialog zeigt jetzt die letzte Leistung der gewählten Übung an und füllt Wdh./Gewicht/Satznummer damit vor; Wdh./kg haben große +/- Stepper statt reiner Tastatureingabe; nach dem Speichern bleibt der Dialog offen (Satznummer hochgezählt, Werte übernommen) statt sich zu schließen, für schnelles Loggen mehrerer Sätze hintereinander. Löschen einzelner Sätze gab es schon. Verifiziert: Playwright End-to-End (Vorbefüllung, Stepper, Mehrfach-Speichern, Aufräumen), kein Overflow bei 375px.
  - Dabei einen Bug gefunden und behoben: Der neue Gewichts-Input hatte kein `step`-Attribut mehr, wodurch der Browser bei Dezimalwerten (z. B. 80.6kg) das Absenden nativ und lautlos blockierte (kein Fehler, kein Handler-Aufruf) — behoben mit `step="any"`.
- **Timer verbessert (additionals P1.2)** — Sound und Vibration bei Timer-Ende waren schon da, aber immer aktiv; jetzt einzeln über Checkboxen abschaltbar (Vibration-Toggle nur sichtbar, wenn das Gerät `navigator.vibrate` unterstützt). Countdown läuft jetzt über einen absoluten Endzeitpunkt statt reinem Sekunden-Herunterzählen — bei App-Wechsel/Hintergrund (wo `setInterval` gedrosselt wird) synchronisiert sich der Timer beim Zurückkehren sofort über `visibilitychange`/`focus`, statt eine veraltete Restzeit zu zeigen. Verifiziert: Playwright (Toggles, Start, simulierter Hintergrund-Wechsel über 4s bei 3s-Timer → sofort "Fertig"/0:00 beim Zurückkehren), kein Overflow bei 375px.
- **PR-Erkennung (additionals P1.3)** — Beim Loggen eines Satzes (Plan-Tagebuch oder "+ Satz"-Dialog) wird jetzt rein clientseitig gegen die schon lokal gecachte Historie geprüft, ob Gewicht, Wiederholungen, geschätztes 1RM oder das Tagesvolumen für diese Übung einen neuen Bestwert erreichen — funktioniert dadurch auch offline, ohne Backend-Änderung. Anzeige als kurzes, selbst verschwindendes Toast oben am Bildschirm (~4,5s, wegklickbar), keine Modals/Badges. Kein PR beim allerersten Satz einer Übung (keine Baseline zum Schlagen). Verifiziert: Playwright (85kg×10 gegen bisher 79.5kg/8 Wdh. löst alle vier Kategorien aus, ein anschließender unauffälliger Satz erzeugt keinen zweiten Toast, Auto-Dismiss nach ~4,5s), kein Overflow bei 375px.

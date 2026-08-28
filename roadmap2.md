Fitnesstracker – TODO vor Hardening

🔴 P0 – Kritisch

☑ Trainingsablauf vollständig machen – Start, Sätze, Pause, Abbruch, Fortsetzen und Abschluss zuverlässig. (Als Buttons umgesetzt, offline-fähig wie das Satz-Logging — siehe ARCHITECTURE.md/ROADMAP.md.)
☑ Trainingsplan & Rotation finalisieren – Phasenwechsel, 8-Wochen-Zyklus, Pausen und Neustart eindeutig. (Pausieren/Fortsetzen/Phase neu starten als Buttons — siehe ARCHITECTURE.md/ROADMAP.md.)
☑ Progressionslogik festlegen – Klare Regeln für Steigerung, Fehlversuche und Deloads. (Aufbau/Negativ: Gewicht, Muskelausdauer: Wdh. — Vorschlag + Prefill im Plan-Tagebuch, siehe ARCHITECTURE.md/ROADMAP.md.)
☑ Offline-Sync fachlich fertigstellen – Offline-Trainings zuverlässig und vollständig synchronisieren. (Periodischer Retry, fehlgeschlagene Mutationen werden sichtbar statt still verworfen, Session-Queue jetzt auch im "ausstehend"-Badge — siehe ARCHITECTURE.md/ROADMAP.md.)
☐ Datenkonflikte definieren – Verhalten bei parallelen/Offline-Änderungen festlegen.

🟠 P1 – Wichtig

☐ Dashboard finalisieren – Heutiges Training, Fortschritt und Ziele übersichtlich.
☐ Fortschrittsansicht abrunden – Gewicht, Körperdaten, Kraft, Volumen, PRs und Zeiträume.
☐ Progress-Fotos komplettieren – Aufnahme, Upload, Datum, Galerie und Vorher/Nachher.
☐ Push-Einstellungen fertigstellen – Erinnerungen individuell aktivierbar und konfigurierbar.
☐ Workout-Historie vervollständigen – Vergangene Trainings ansehen und bearbeiten.
☐ Übungsverwaltung finalisieren – Übungen anlegen, bearbeiten, deaktivieren und korrekt verwenden.
☐ Ziele vollständig machen – Ziele erstellen, Fortschritt und Abschluss sauber behandeln.

🟡 P2 – Abrunden

☐ Wasser-Tracking finalisieren – Tagesziel, Eingabe und Verlauf.
☐ Supplement-Tracking finalisieren – Einnahmen, Status und Erinnerungen.
☐ Daily Challenge abrunden – Anzeige, Erledigung und Verlauf.
☐ Ernährungsrechner abrunden – Eingaben, Berechnung und Zielwerte.
☐ Export/Backup prüfen – Persönliche Daten sicher exportierbar machen.
☐ Empty/Error/Loading States – Alle zentralen Ansichten sauber behandeln.
☐ Mobile UX finalisieren – Touch-Bedienung und schnelle Eingaben optimieren.

🟢 P3 – Optional

☐ AI-Übungsvorschläge – Komfortfeature.
☐ Wearables/Health-Integrationen – Nach Feature Freeze.
☐ Erweiterte Statistiken – Nur bei echtem Mehrwert.
☐ Social Features – Nicht vor Hardening nötig.

🏁 Feature Freeze

☐ Keine neuen großen Features – Danach nur Fehlerbehebung/Stabilisierung.
☐ Kernflows komplett testen – Login → Dashboard → Training → Abschluss → Historie → Fortschritt.
☐ Offline-Kernflow testen – Offline erfassen → online gehen → Sync kontrollieren.

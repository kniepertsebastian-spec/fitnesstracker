import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type AppLanguage = "de" | "en";
const STORAGE_KEY = "fitnesstracker-language";

const ENGLISH: Record<string, string> = {
  "Menü öffnen": "Open menu", "Abmelden": "Log out", "Dashboard": "Dashboard",
  "Historie": "History", "Übungen": "Exercises", "Plan": "Plan", "Fortschritt": "Progress",
  "Ziele": "Goals", "Ernährung": "Nutrition", "Einstellungen": "Settings",
  "Anmelden": "Log in", "Registrieren": "Register", "Noch kein Konto?": "No account yet?",
  "Schon ein Konto?": "Already have an account?", "Passwort": "Password",
  "Anzeigename (optional)": "Display name (optional)", "Setup-Token": "Setup token",
  "Training": "Training", "Heute": "Today", "+ Satz": "+ Set", "Satz hinzufügen": "Add set",
  "Satz bearbeiten": "Edit set", "Satz": "Set", "Sätze": "Sets", "Wdh.": "Reps",
  "Gewicht (kg)": "Weight (kg)", "Bearbeiten": "Edit", "Löschen": "Delete",
  "Abbrechen": "Cancel", "Speichern": "Save", "Fertig": "Done", "Schließen": "Close",
  "Übung wählen…": "Choose exercise…", "Bitte eine Übung wählen": "Please choose an exercise",
  "Heute noch keine Sätze protokolliert.": "No sets logged today.",
  "Keine Einträge für diese Auswahl.": "No entries for this selection.",
  "Training starten": "Start workout", "Training läuft": "Workout in progress",
  "Kein Training aktiv": "No active workout", "Abschließen": "Finish",
  "Tages-Challenge": "Daily challenge", "Tages-Challenge lädt…": "Loading daily challenge…",
  "Passend zu deinem aktuellen Trainingsplan.": "Matched to your current training plan.",
  "Trainingsplan": "Training plan", "Aktuelle Phase": "Current phase", "Pausieren": "Pause",
  "Fortsetzen": "Resume", "Phase neu starten": "Restart phase", "Zum Plan": "View plan",
  "Übungen in dieser Phase": "Exercises in this phase", "+ Übung": "+ Exercise",
  "Noch keine Übungen für diese Phase.": "No exercises in this phase yet.",
  "Übung hinzufügen": "Add exercise", "Übung ersetzen": "Replace exercise", "Ersetzen": "Replace",
  "Hinzufügen": "Add", "Übung suchen…": "Search exercises…", "Übung": "Exercise",
  "Sätze (optional)": "Sets (optional)", "Wdh. (optional)": "Reps (optional)",
  "Nach oben": "Move up", "Nach unten": "Move down", "Trainingstag:": "Training day:",
  "Verlauf": "History", "Noch kein Phasenwechsel.": "No phase change yet.",
  "Generieren & Exportieren": "Generate & export",
  "Plan generieren & exportieren": "Generate & export plan",
  "KI-Trainingsplan-Generator": "AI training plan generator",
  "Plan konfigurieren & generieren": "Configure & generate plan", "Generiert…": "Generating…",
  "Ein paar Fragen zuerst": "A few questions first", "Schritt": "Step", "Zurück": "Back",
  "Weiter": "Continue", "Plan generieren": "Generate plan", "Was ist dein Hauptziel?": "What is your main goal?",
  "Muskelaufbau": "Muscle gain", "Kraftaufbau": "Strength", "Kraftausdauer": "Muscular endurance",
  "Fettabbau & Muskelerhalt": "Fat loss & muscle retention", "Allgemeine Fitness": "General fitness",
  "Wie oft und wie lange möchtest du trainieren?": "How often and how long do you want to train?",
  "Einheiten/Woche": "Sessions/week", "Minuten/Einheit": "Minutes/session",
  "Welches Equipment hast du?": "What equipment do you have?", "Nur Kurzhanteln": "Dumbbells only",
  "Vollausgestattetes Studio": "Fully equipped gym", "Wie ist dein Erfahrungsgrad?": "What is your experience level?",
  "Anfänger": "Beginner", "Fortgeschritten": "Intermediate", "Erfahren": "Advanced",
  "Welche Bereiche möchtest du priorisieren?": "Which areas do you want to prioritize?",
  "Bevorzugte Übungen (optional)": "Preferred exercises (optional)",
  "Übungen, die du vermeiden möchtest": "Exercises you want to avoid",
  "Körperliche Einschränkungen? (optional)": "Physical limitations? (optional)",
  "Plan exportieren / importieren": "Export / import plan", "Exportieren": "Export", "Datei": "File",
  "Importieren": "Import", "Bemerkungen": "Notes", "Bemerkungen speichern": "Save notes",
  "Aus der Trainingshistorie erkannt": "Detected from workout history",
  "Keine deutliche Asymmetrie in den letzten 8 Wochen erkannt.": "No clear imbalance detected in the last 8 weeks.",
  "KI-Technik-Check mit Gemini": "AI form check with Gemini", "Ausführung analysieren": "Analyze form",
  "Gemini analysiert…": "Gemini is analyzing…", "Das läuft gut": "What looks good",
  "Verbesserungen": "Improvements", "Sicherheit": "Safety", "Hoch": "High", "Mittel": "Medium", "Niedrig": "Low",
  "Übungsbibliothek": "Exercise library", "Alle Übungen": "All exercises", "Keine Übungen gefunden.": "No exercises found.",
  "Alle Muskelgruppen": "All muscle groups", "Alle Equipment": "All equipment",
  "Auch inaktive Übungen anzeigen": "Show inactive exercises", "Übung anlegen": "Create exercise",
  "Übung bearbeiten": "Edit exercise", "Beschreibung": "Description", "Equipment": "Equipment",
  "Kategorie": "Category", "Primäre Muskeln (Komma-getrennt)": "Primary muscles (comma-separated)",
  "Sekundäre Muskeln (Komma-getrennt)": "Secondary muscles (comma-separated)",
  "Video-URL": "Video URL", "Kein Video verfügbar.": "No video available.", "Video ansehen ↗": "Watch video ↗",
  "Übung nicht gefunden.": "Exercise not found.", "← Übungen": "← Exercises", "Inaktiv": "Inactive",
  "Ziel hinzufügen": "Add goal", "+ Ziel": "+ Goal", "Noch keine Ziele gesetzt.": "No goals set yet.",
  "Keine offenen Ziele.": "No open goals.", "Zu den Zielen": "View goals", "Zielwert": "Target value",
  "Zieldatum (optional)": "Target date (optional)", "Erreicht": "Achieved", "Stagniert": "Plateaued",
  "Vorschläge": "Suggestions", "Ernährung & Körper": "Nutrition & body", "Gewicht & Körperdaten": "Weight & body data",
  "Neue Messung": "New measurement", "Noch keine Messung erfasst.": "No measurement recorded yet.",
  "Grundumsatz (BMR)": "Basal metabolic rate (BMR)", "Gesamtumsatz (TDEE)": "Total expenditure (TDEE)",
  "Tagesbedarf": "Daily target", "Ziel-Kalorien": "Target calories", "Ziel-Protein": "Target protein",
  "Alter": "Age", "Größe (cm)": "Height (cm)", "Geschlecht": "Gender", "Aktivitätslevel": "Activity level",
  "Fortschritts-Fotos": "Progress photos", "Neues Vergleichsfoto": "New comparison photo",
  "Noch keine Fotos. Nur du kannst sie sehen.": "No photos yet. Only you can see them.", "Foto löschen": "Delete photo",
  "Kamera wechseln": "Switch camera", "Kamera wird gestartet…": "Starting camera…", "Galerie": "Gallery",
  "Vorher/Nachher": "Before/after", "Vorheriges Foto": "Previous photo", "Vorher wählen…": "Choose before…",
  "Nachher wählen…": "Choose after…", "Supplements": "Supplements", "Noch keine Supplements hinterlegt.": "No supplements yet.",
  "Uhrzeit": "Time", "Push-Benachrichtigungen": "Push notifications", "Pausen-Timer": "Rest timer",
  "Pause": "Rest", "Start": "Start", "Zurücksetzen": "Reset", "Sound bei Timer-Ende": "Sound when timer ends",
  "Vibration bei Timer-Ende": "Vibrate when timer ends", "Automatisch nach jedem Satz starten": "Start automatically after each set",
  "Installieren": "Install", "Später": "Later", "Neue Version verfügbar": "New version available",
  "Aktualisieren": "Update", "Alle Änderungen sind synchronisiert.": "All changes are synced.",
  "Export & Backup": "Export & backup", "Vollständiges Backup (JSON)": "Complete backup (JSON)",
  "Eigene Trainingsdaten als Datei sichern — unabhängig von der App nutzbar.": "Save your training data as a portable file.",
  "Trainingsvolumen": "Training volume", "Konsistenz": "Consistency",
  "Kraft & PRs": "Strength & PRs", "Zu wenige Datenpunkte": "Not enough data points",
  "Keine Messungen in diesem Zeitraum.": "No measurements in this period.",
  "Keine Sätze in diesem Zeitraum.": "No sets in this period.", "Cardio": "Cardio", "Dauer": "Duration",
  "Intensität": "Intensity", "Zeit": "Time", "Datum": "Date", "Art": "Type", "Name": "Name",
  "Lädt…": "Loading…", "Lädt hoch…": "Uploading…", "Entfernen": "Remove", "Übernehmen": "Apply",
  "Mehr laden": "Load more", "Erstelle Backup…": "Creating backup…", "Erstelle CSV…": "Creating CSV…",
  "Trainingslog (CSV)": "Workout log (CSV)", "Pausiert": "Paused", "Noch nicht synchronisiert": "Not synced yet",
  "Löschen fehlgeschlagen": "Delete failed", "Aufwärmpyramide anzeigen": "Show warm-up pyramid",
  "Aufwärmpyramide ausblenden": "Hide warm-up pyramid", "gespeichert — bereit für den nächsten Satz": "saved — ready for the next set",
  "Einklappen": "Collapse", "Übungen anzeigen": "Show exercises",
  "Homegym (Kurzhanteln, Bänder, Körpergewicht)": "Home gym (dumbbells, bands, bodyweight)",
  "Optional: konkrete Geräte, z. B. Kabelzug, Klimmzugstange…": "Optional: specific equipment, e.g. cable machine, pull-up bar…",
  "z. B. Rücken und Beinbeuger; Arme nur erhaltend…": "e.g. back and hamstrings; arms maintenance only…",
  "z. B. Knieprobleme, Rückenschmerzen…": "e.g. knee problems, back pain…",
  "Plan konnte nicht generiert werden.": "Plan could not be generated.",
  "Neuen API-Key eingeben zum Ändern": "Enter a new API key to change it",
  "Noch kein Anbieter konfiguriert.": "No provider configured yet.",
  "Anmeldung für Erinnerungen fehlgeschlagen.": "Enabling reminders failed.",
  "Gewicht (Übung)": "Weight (exercise)", "Wiederholungen (Übung)": "Repetitions (exercise)",
  "Körpergewicht": "Bodyweight", "Männlich": "Male", "Weiblich": "Female", "Divers": "Other",
  "Leicht aktiv (1-3x/Woche)": "Lightly active (1-3x/week)", "Mäßig aktiv (3-5x/Woche)": "Moderately active (3-5x/week)",
  "Sehr aktiv (6-7x/Woche)": "Very active (6-7x/week)", "Extrem aktiv + körperliche Arbeit": "Extremely active + physical work",
  "Vorheriger Monat": "Previous month", "Nächster Monat": "Next month",
  "Keine Sätze für diese Übung protokolliert.": "No sets logged for this exercise.",
  "Noch keine Trainings protokolliert.": "No workouts logged yet.", "Woche": "Week", "Wochen": "Weeks",
  "4 Wochen": "4 weeks", "3 Monate": "3 months", "Geschätztes 1RM": "Estimated 1RM", "Tagesvolumen": "Daily volume",
  "Trainierte Tage pro Woche, letzte": "Training days per week, last", "in Folge": "in a row",
  "Bitte Übung und Video angeben.": "Please provide an exercise and video.",
  "Das Video darf maximal 10 MB groß sein.": "The video must not exceed 10 MB.",
  "Übung, z. B. Kniebeuge": "Exercise, e.g. squat", "Foto aufnehmen": "Take photo",
  "Kamera mit Vorher-Vergleich": "Camera with before comparison", "Pausen-Timer öffnen": "Open rest timer",
  "Speichern fehlgeschlagen — bitte Eingaben prüfen": "Saving failed — please check your input",
  "Gewicht ist Pflicht.": "Weight is required.",
  "Kamera-Zugriff wird von diesem Browser nicht unterstützt.": "Camera access is not supported by this browser.",
  "Kamera-Zugriff wurde verweigert.": "Camera access was denied.", "Kamera konnte nicht gestartet werden.": "Camera could not be started.",
  "Einige Änderungen konnten nicht synchronisiert werden — deine Daten sind aber lokal gespeichert.": "Some changes could not be synced — your data is safely stored locally.",
  "Trainingsplan-Phasenwechsel": "Training plan phase change", "Neue Rekorde (Gewicht/Wdh.)": "New records (weight/reps)",
  "Ziel erreicht": "Goal achieved", "Fortschritts-Foto (wöchentlich)": "Progress photo (weekly)",
  "Tages-Challenge nicht abgeschlossen": "Daily challenge not completed", "Synchronisierungs-Fehler": "Sync errors",
  "noch ohne Push-Versand": "push delivery not active yet", "Deaktivieren": "Deactivate", "Aktivieren": "Activate",
};

function initialLanguage(): AppLanguage {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "de" || stored === "en") return stored;
  return navigator.language.toLowerCase().startsWith("de") ? "de" : "en";
}

function translateText(value: string): string {
  let result = value;
  for (const [de, en] of Object.entries(ENGLISH).sort((a, b) => b[0].length - a[0].length)) {
    result = result.replaceAll(de, en);
  }
  return result;
}

function translateDom(root: ParentNode) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node.parentElement?.closest("script, style, [data-no-translate]") || !node.nodeValue?.trim()) continue;
    const translated = translateText(node.nodeValue);
    if (translated !== node.nodeValue) node.nodeValue = translated;
  }
  const elements = root instanceof Element ? [root, ...root.querySelectorAll("*")] : [...root.querySelectorAll("*")];
  for (const element of elements) {
    for (const attribute of ["placeholder", "aria-label", "title"]) {
      const value = element.getAttribute(attribute);
      if (value) element.setAttribute(attribute, translateText(value));
    }
  }
}

interface LanguageContextValue {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
}
const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(initialLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
    if (language !== "en") return;
    translateDom(document.body);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData" && mutation.target.nodeValue) {
          const translated = translateText(mutation.target.nodeValue);
          if (translated !== mutation.target.nodeValue) mutation.target.nodeValue = translated;
        }
        for (const node of mutation.addedNodes) {
          if (node instanceof Element || node instanceof DocumentFragment) translateDom(node);
          else if (node.nodeType === Node.TEXT_NODE && node.nodeValue) node.nodeValue = translateText(node.nodeValue);
        }
      }
    });
    observer.observe(document.body, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
  }, [language]);

  const setLanguage = (next: AppLanguage) => {
    localStorage.setItem(STORAGE_KEY, next);
    setLanguageState(next);
    // Source strings are German; reload cleanly restores them when switching back.
    window.location.reload();
  };

  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}

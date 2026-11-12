// The server's error messages are partly English (framework defaults, older routes). Users see
// them in forms and toasts, so they are translated here, in one place: first exact known texts,
// then patterns, then a generic text per status code for the framework's own default messages.
// German messages from the server pass through unchanged.
const KNOWN: Record<string, string> = {
  "Invalid email or password": "E-Mail oder Passwort ist falsch.",
  "Email already registered": "Diese E-Mail-Adresse ist schon registriert.",
  "Invalid setup token": "Das Setup-Token ist falsch.",
  "Invalid reset token": "Das Reset-Token ist falsch.",
  "Password is wrong": "Das Passwort ist falsch.",
  "Current password is wrong": "Das aktuelle Passwort ist falsch.",
  "Invalid refresh token": "Die Sitzung ist abgelaufen. Bitte melde dich neu an.",
  "clientId already in use": "Dieser Eintrag gehört zu einem anderen Konto.",
  "Exercise already assigned to this training day": "Diese Übung ist an diesem Trainingstag schon eingetragen.",
  "Exercise already assigned to this phase": "Diese Übung ist in dieser Phase schon eingetragen.",
  "Validation error": "Die Eingabe ist ungültig. Bitte prüfe die Felder.",
  "Unauthorized": "Bitte melde dich an.",
  "Forbidden": "Dafür fehlt dir die Berechtigung.",
  "Not found": "Nicht gefunden.",
  "Conflict": "Das geht so nicht, weil es mit vorhandenen Daten kollidiert.",
  "Bad Request": "Die Anfrage war ungültig.",
  "Request failed": "Die Anfrage ist fehlgeschlagen.",
  "Too Many Requests": "Zu viele Anfragen. Bitte warte kurz und versuche es erneut.",
  "Internal Server Error": "Der Server hat ein Problem. Bitte versuche es später erneut.",
  "Bad Gateway": "Der Server ist gerade nicht erreichbar. Bitte versuche es später erneut.",
  "Service Unavailable": "Der Server ist gerade nicht erreichbar. Bitte versuche es später erneut.",
  "Gateway Timeout": "Der Server hat zu lange gebraucht. Bitte versuche es erneut.",
};

const NOT_FOUND_SUBJECTS: Record<string, string> = {
  Exercise: "Die Übung",
  Supplement: "Das Supplement",
  "Progress photo": "Das Foto",
  "Plan exercise": "Der Planeintrag",
  Goal: "Das Ziel",
  "Daily challenge item": "Der Challenge-Eintrag",
  "Body composition entry": "Der Messwert",
  "Workout session": "Die Trainingseinheit",
  "Workout log": "Der Satz",
  "Cardio log": "Der Cardio-Eintrag",
};

export function germanErrorMessage(status: number, message: string | undefined): string {
  const text = (message ?? "").trim();
  if (text in KNOWN) return KNOWN[text]!;
  const notFound = /^(.+) not found$/.exec(text);
  if (notFound) {
    const subject = NOT_FOUND_SUBJECTS[notFound[1]!];
    return subject ? `${subject} wurde nicht gefunden.` : "Nicht gefunden.";
  }
  const unknownSource = /^Unknown exercise source: (.+)$/.exec(text);
  if (unknownSource) return `Unbekannte Quelle: ${unknownSource[1]}.`;
  if (/^The report covers at most \d+ days$/.test(text)) return "Der gewählte Zeitraum ist zu lang.";
  if (/^'from' must not be after 'to'$/.test(text)) return "Das Startdatum liegt nach dem Enddatum.";
  if (text) return text;
  // No message at all: fall back to the status.
  if (status === 401) return KNOWN["Unauthorized"]!;
  if (status === 403) return KNOWN["Forbidden"]!;
  if (status === 404) return KNOWN["Not found"]!;
  if (status === 409) return KNOWN["Conflict"]!;
  if (status === 429) return KNOWN["Too Many Requests"]!;
  if (status >= 500) return KNOWN["Internal Server Error"]!;
  return KNOWN["Request failed"]!;
}

import { formatDuration, formatKg } from "./trainingSets";

export interface ShareableSummary {
  seconds: number;
  sets: number;
  volumeKg: number;
  records: number;
  cardioMinutes: number;
  aborted: boolean;
}

export function summaryText(summary: ShareableSummary): string {
  const parts = [
    formatDuration(summary.seconds),
    `${summary.sets} Sätze`,
    `${formatKg(Math.round(summary.volumeKg))} kg Volumen`,
  ];
  if (summary.records > 0) parts.push(`${summary.records} ${summary.records === 1 ? "Rekord" : "Rekorde"}`);
  if (summary.cardioMinutes > 0) parts.push(`${summary.cardioMinutes} Min. Cardio`);
  return `${summary.aborted ? "Training abgebrochen" : "Training abgeschlossen"}: ${parts.join(" · ")}`;
}

export type ShareResult = "shared" | "copied" | "cancelled" | "failed";

// Native share sheet where the browser has one, clipboard otherwise. Closing the share sheet
// without choosing a target is not an error.
export async function shareSummary(summary: ShareableSummary): Promise<ShareResult> {
  const text = summaryText(summary);
  try {
    if (typeof navigator.share === "function") {
      await navigator.share({ title: "Fitnesstracker", text });
      return "shared";
    }
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch (error) {
    return error instanceof DOMException && error.name === "AbortError" ? "cancelled" : "failed";
  }
}

import type {
  BodyCompositionEntryDto,
  BodyFatCalibrationDto,
  CreateBodyFatCalibrationInput,
  CreateBodyCompositionEntryInput,
  ImportBodyCompositionInput,
  ImportBodyCompositionResult,
  SaveScaleReportInput,
  ScaleReportDraft,
} from "@fitnesstracker/shared";
import { apiFetch, apiUpload } from "./client";

export function listBodyCompositionEntriesRequest() {
  return apiFetch<{ items: BodyCompositionEntryDto[] }>("/body-composition");
}

export function createBodyCompositionEntryRequest(input: CreateBodyCompositionEntryInput) {
  return apiFetch<BodyCompositionEntryDto>("/body-composition", { method: "POST", body: input });
}

export function deleteBodyCompositionEntryRequest(id: string) {
  return apiFetch<void>(`/body-composition/${id}`, { method: "DELETE" });
}

export function importBodyCompositionRequest(input: ImportBodyCompositionInput) {
  return apiFetch<ImportBodyCompositionResult>("/body-composition/import", { method: "POST", body: input });
}

// Reads a scale-report screenshot on the server (OCR, no AI); nothing is stored yet.
export function parseScaleReportRequest(file: File, timeZone: string) {
  const form = new FormData();
  form.append("image", file);
  return apiUpload<ScaleReportDraft>(`/body-composition/report/parse?tz=${encodeURIComponent(timeZone)}`, form);
}

export function saveScaleReportRequest(input: SaveScaleReportInput) {
  return apiFetch<BodyCompositionEntryDto>("/body-composition/report", { method: "POST", body: input });
}

export function listBodyFatCalibrationsRequest() {
  return apiFetch<{ items: BodyFatCalibrationDto[] }>("/body-fat-calibrations");
}

export function createBodyFatCalibrationRequest(input: CreateBodyFatCalibrationInput) {
  return apiFetch<BodyFatCalibrationDto>("/body-fat-calibrations", { method: "POST", body: input });
}

export function deleteBodyFatCalibrationRequest(id: string) {
  return apiFetch<void>(`/body-fat-calibrations/${id}`, { method: "DELETE" });
}

import type { AiSettingsDto, SaveAiSettingsInput } from "@fitnesstracker/shared";
import { apiFetch } from "./client";

export function getAiSettingsRequest() {
  return apiFetch<AiSettingsDto>("/ai-settings");
}

export function saveAiSettingsRequest(input: SaveAiSettingsInput) {
  return apiFetch<AiSettingsDto>("/ai-settings", { method: "PUT", body: input });
}

export function deleteAiSettingsRequest() {
  return apiFetch<void>("/ai-settings", { method: "DELETE" });
}

import type { AddWaterInput, SetWaterTargetInput, WaterStatusDto } from "@fitnesstracker/shared";
import { apiFetch } from "./client";

export function getWaterStatusRequest() {
  return apiFetch<WaterStatusDto>("/water");
}

export function addWaterRequest(input: AddWaterInput) {
  return apiFetch<WaterStatusDto>("/water/log", { method: "POST", body: input });
}

export function setWaterTargetRequest(input: SetWaterTargetInput) {
  return apiFetch<WaterStatusDto>("/water/target", { method: "PUT", body: input });
}

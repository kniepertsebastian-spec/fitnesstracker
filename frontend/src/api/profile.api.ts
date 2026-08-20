import type { ProfileDto, UpsertProfileInput } from "@fitnesstracker/shared";
import { apiFetch } from "./client";

export function getProfileRequest() {
  return apiFetch<ProfileDto | null>("/profile");
}

export function upsertProfileRequest(input: UpsertProfileInput) {
  return apiFetch<ProfileDto>("/profile", { method: "PUT", body: input });
}

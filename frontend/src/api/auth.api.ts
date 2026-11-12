import type { ChangePasswordInput, DeleteAccountInput, LoginInput, ResetPasswordInput, RegisterInput, UpdateNameInput, UpdateTimeZoneInput, UserDto } from "@fitnesstracker/shared";
import { apiFetch } from "./client";

export function registerRequest(input: RegisterInput) {
  return apiFetch<{ user: UserDto }>("/auth/register", { method: "POST", body: input });
}

export function loginRequest(input: LoginInput) {
  return apiFetch<{ user: UserDto; accessToken: string }>("/auth/login", {
    method: "POST",
    body: input,
  });
}

export function logoutRequest() {
  return apiFetch<void>("/auth/logout", { method: "POST" });
}

export function meRequest() {
  return apiFetch<UserDto>("/auth/me");
}

export function updateNameRequest(input: UpdateNameInput) {
  return apiFetch<UserDto>("/auth/me/name", { method: "PUT", body: input });
}

export function updateTimeZoneRequest(input: UpdateTimeZoneInput) {
  return apiFetch<UserDto>("/auth/me/time-zone", { method: "PUT", body: input });
}

export function changePasswordRequest(input: ChangePasswordInput) {
  return apiFetch<void>("/auth/me/password", { method: "PUT", body: input });
}

export function resetPasswordRequest(input: ResetPasswordInput) {
  return apiFetch<void>("/auth/reset-password", { method: "POST", body: input });
}

export function deleteAccountRequest(input: DeleteAccountInput) {
  return apiFetch<void>("/auth/me", { method: "DELETE", body: input });
}

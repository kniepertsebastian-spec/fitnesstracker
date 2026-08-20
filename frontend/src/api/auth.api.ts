import type { LoginInput, RegisterInput, UserDto } from "@fitnesstracker/shared";
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

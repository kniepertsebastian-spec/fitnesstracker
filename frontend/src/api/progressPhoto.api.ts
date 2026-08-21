import type { ProgressPhotoDto } from "@fitnesstracker/shared";
import { apiFetch, apiUpload } from "./client";

export function listProgressPhotosRequest() {
  return apiFetch<{ items: ProgressPhotoDto[] }>("/progress-photos");
}

export function uploadProgressPhotoRequest(file: File, takenAt?: string) {
  const formData = new FormData();
  formData.append("file", file);
  if (takenAt) formData.append("takenAt", takenAt);
  return apiUpload<ProgressPhotoDto>("/progress-photos", formData);
}

export function deleteProgressPhotoRequest(id: string) {
  return apiFetch<void>(`/progress-photos/${id}`, { method: "DELETE" });
}

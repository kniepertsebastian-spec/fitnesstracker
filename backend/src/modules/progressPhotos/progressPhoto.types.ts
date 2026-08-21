import type { ProgressPhoto } from "@prisma/client";
import type { ProgressPhotoDto } from "@fitnesstracker/shared";

export function toProgressPhotoDto(photo: ProgressPhoto): ProgressPhotoDto {
  return {
    id: photo.id,
    takenAt: photo.takenAt.toISOString(),
  };
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteProgressPhotoRequest,
  listProgressPhotosRequest,
  uploadProgressPhotoRequest,
} from "../api/progressPhoto.api";

const PROGRESS_PHOTOS_KEY = ["progress-photos"];

export function useProgressPhotos() {
  return useQuery({
    queryKey: PROGRESS_PHOTOS_KEY,
    queryFn: () => listProgressPhotosRequest().then((r) => r.items),
  });
}

export function useUploadProgressPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, takenAt }: { file: File; takenAt?: string }) =>
      uploadProgressPhotoRequest(file, takenAt),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROGRESS_PHOTOS_KEY }),
  });
}

export function useDeleteProgressPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProgressPhotoRequest(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROGRESS_PHOTOS_KEY }),
  });
}

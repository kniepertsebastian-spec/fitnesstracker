import { z } from "zod";

// The file itself is never exposed as a URL/path in the DTO — the frontend always fetches it as
// an authenticated blob via GET /progress-photos/:id/file, since these are private body photos.
export const progressPhotoDtoSchema = z.object({
  id: z.string().uuid(),
  takenAt: z.string(),
});
export type ProgressPhotoDto = z.infer<typeof progressPhotoDtoSchema>;

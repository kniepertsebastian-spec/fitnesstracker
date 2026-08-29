import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PrismaClient, ProgressPhoto } from "@prisma/client";
import { NotFoundError } from "../../errors/httpErrors.js";
import { env } from "../../config/env.js";
import { sendNotificationToUser } from "../push/push.service.js";

const UPLOADS_DIR = path.resolve(env.UPLOADS_DIR);

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

async function ensureUploadsDir() {
  await mkdir(UPLOADS_DIR, { recursive: true });
}

export function listPhotos(prisma: PrismaClient, userId: string) {
  return prisma.progressPhoto.findMany({ where: { userId }, orderBy: { takenAt: "desc" } });
}

export async function saveUploadedPhoto(
  prisma: PrismaClient,
  userId: string,
  buffer: Buffer,
  mimeType: string,
  takenAt: Date | undefined,
): Promise<ProgressPhoto> {
  await ensureUploadsDir();
  const extension = EXTENSION_BY_MIME[mimeType] ?? "bin";
  const filename = `${randomUUID()}.${extension}`;
  await writeFile(path.join(UPLOADS_DIR, filename), buffer);

  return prisma.progressPhoto.create({
    data: {
      userId,
      filename,
      mimeType,
      ...(takenAt ? { takenAt } : {}),
    },
  });
}

export async function getPhotoFileForUser(prisma: PrismaClient, userId: string, id: string) {
  const photo = await prisma.progressPhoto.findFirst({ where: { id, userId } });
  if (!photo) {
    throw new NotFoundError("Progress photo not found");
  }
  return { filePath: path.join(UPLOADS_DIR, photo.filename), mimeType: photo.mimeType };
}

export async function deletePhoto(prisma: PrismaClient, userId: string, id: string) {
  const photo = await prisma.progressPhoto.findFirst({ where: { id, userId } });
  if (!photo) {
    throw new NotFoundError("Progress photo not found");
  }
  await prisma.progressPhoto.delete({ where: { id } });
  await unlink(path.join(UPLOADS_DIR, photo.filename)).catch(() => {
    // Row is gone either way — a missing file on disk shouldn't surface as a user-facing error.
  });
}

const REMIND_AFTER_DAYS = 7;

// Weekly cadence derived from the latest photo's takenAt (or account creation if there's no
// photo yet at all) rather than a dedicated "last reminded" column — once someone is overdue
// this repeats on every daily tick until they upload again, which is fine for a once-a-week
// nudge (unlike the supplement reminder's exact-time, exactly-once-per-day requirement).
export async function sendDueReminders(prisma: PrismaClient): Promise<{ sent: number }> {
  const users = await prisma.user.findMany({
    include: { progressPhotos: { orderBy: { takenAt: "desc" }, take: 1 } },
  });

  const now = Date.now();
  let sent = 0;
  for (const user of users) {
    if (!user.remindProgressPhoto) continue; // Phase 30: per-reminder-type opt-out.
    const baseline = user.progressPhotos[0]?.takenAt ?? user.createdAt;
    const daysSince = (now - baseline.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince >= REMIND_AFTER_DAYS) {
      await sendNotificationToUser(prisma, user.id, {
        title: "Fortschritts-Foto",
        body: "Zeit für ein neues Vergleichsfoto?",
        url: "/nutrition?tab=koerper",
      });
      sent += 1;
    }
  }
  return { sent };
}

import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { PrismaClient, ProgressPhoto } from "@prisma/client";
import { HttpError, NotFoundError } from "../../errors/httpErrors.js";
import { env } from "../../config/env.js";
import { sendNotificationToUser } from "../push/push.service.js";

const UPLOADS_DIR = path.resolve(env.UPLOADS_DIR);

// Progress photos are private body-comparison shots — the client-declared upload mimetype is
// not trusted (an attacker can label anything "image/jpeg"), and neither is the raw byte
// content on disk. sharp both proves the bytes actually decode as one of these formats and,
// by re-encoding rather than storing the upload verbatim, strips EXIF/GPS/ICC metadata that a
// phone photo carries (sharp only preserves that when `.withMetadata()` is explicitly called).
const MIME_BY_FORMAT: Record<string, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};
const EXTENSION_BY_FORMAT: Record<string, string> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
};
// Generous enough for any real phone or DSLR photo; rules out a decompression-bomb-style image
// (tiny file, absurd pixel dimensions) tying up CPU/memory during re-encoding.
const MAX_DIMENSION_PX = 8000;

async function ensureUploadsDir() {
  await mkdir(UPLOADS_DIR, { recursive: true });
}

export function listPhotos(prisma: PrismaClient, userId: string) {
  return prisma.progressPhoto.findMany({ where: { userId }, orderBy: { takenAt: "desc" } });
}

async function reencodeAndValidate(buffer: Buffer): Promise<{ buffer: Buffer; mimeType: string; extension: string }> {
  const image = sharp(buffer, { failOn: "error" });
  const metadata = await image.metadata().catch(() => null);
  const format = metadata?.format;
  if (!format || !(format in MIME_BY_FORMAT)) {
    throw new HttpError(400, "Datei ist kein gültiges Bild (JPEG/PNG/WebP)");
  }
  if (!metadata.width || !metadata.height || metadata.width > MAX_DIMENSION_PX || metadata.height > MAX_DIMENSION_PX) {
    throw new HttpError(400, `Bildabmessungen zu groß (max. ${MAX_DIMENSION_PX}px)`);
  }

  // `.rotate()` bakes the EXIF orientation tag into the pixel data before it gets stripped, so
  // the photo doesn't end up sideways once the tag carrying that info is gone.
  const reencoded = await image.rotate().toFormat(format).toBuffer();
  return { buffer: reencoded, mimeType: MIME_BY_FORMAT[format], extension: EXTENSION_BY_FORMAT[format] };
}

export async function saveUploadedPhoto(
  prisma: PrismaClient,
  userId: string,
  buffer: Buffer,
  takenAt: Date | undefined,
): Promise<ProgressPhoto> {
  const { buffer: cleanBuffer, mimeType, extension } = await reencodeAndValidate(buffer);

  await ensureUploadsDir();
  const filename = `${randomUUID()}.${extension}`;
  await writeFile(path.join(UPLOADS_DIR, filename), cleanBuffer);

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

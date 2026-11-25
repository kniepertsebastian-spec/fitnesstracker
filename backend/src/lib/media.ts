import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";
import { HttpError } from "../errors/httpErrors.js";
import { loadSharp } from "./loadSharp.js";

/**
 * Media storage for the nutrition features: nutrition-label photos (Scan & Learn), cookbook pages
 * and temporary videos. Files live on a Docker volume (MEDIA_DIR), never in PostgreSQL.
 *
 * - `tmp/`   input for an AI analysis; deleted once the job is done, and swept by the worker's
 *            cleanup job after MEDIA_TMP_TTL_HOURS at the latest.
 * - `scans/` photos that stay with a learned food (the label as evidence for its values).
 */
export const MEDIA_KINDS = ["tmp", "scans"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export interface MediaConfig {
  dir: string;
  maxUploadBytes: number;
  maxEdgePx: number;
  webpQuality: number;
}

export function mediaConfigFromEnv(): MediaConfig {
  return {
    dir: path.resolve(env.MEDIA_DIR),
    maxUploadBytes: Math.round(env.MEDIA_MAX_UPLOAD_MB * 1024 * 1024),
    maxEdgePx: env.MEDIA_MAX_IMAGE_EDGE_PX,
    webpQuality: env.MEDIA_WEBP_QUALITY,
  };
}

// Pixel cap before decoding: a tiny file can still declare a gigantic canvas (decompression bomb).
const MAX_INPUT_PIXELS = 50_000_000;
const STORED_NAME = /^[0-9a-f-]{36}\.webp$/;

/** Absolute path of a stored file; refuses anything but a name this module generated. */
export function mediaPath(config: MediaConfig, kind: MediaKind, filename: string): string {
  if (!MEDIA_KINDS.includes(kind) || !STORED_NAME.test(filename)) throw new HttpError(400, "Ungültiger Dateiname");
  return path.join(config.dir, kind, filename);
}

export async function ensureMediaDirs(config: MediaConfig): Promise<void> {
  await Promise.all(MEDIA_KINDS.map((kind) => mkdir(path.join(config.dir, kind), { recursive: true })));
}

export interface StoredImage {
  kind: MediaKind;
  filename: string;
  path: string;
  bytes: number;
  width: number;
  height: number;
}

/**
 * Normalizes an uploaded photo and stores it as WebP: honors the EXIF orientation (then drops all
 * metadata, GPS included), scales the longest edge down to `maxEdgePx` (never up) and re-encodes.
 * 413 for an oversized upload, 415 for anything sharp can't read as an image.
 */
export async function storeImageAsWebp(input: Buffer, kind: MediaKind, config: MediaConfig = mediaConfigFromEnv()): Promise<StoredImage> {
  if (input.length === 0) throw new HttpError(400, "Leere Datei");
  if (input.length > config.maxUploadBytes) {
    throw new HttpError(413, `Die Datei ist zu groß (maximal ${Math.floor(config.maxUploadBytes / 1024 / 1024)} MB)`);
  }
  const sharp = await loadSharp();
  let output: { data: Buffer; info: { width: number; height: number; size: number } };
  try {
    output = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" })
      .rotate()
      .resize({ width: config.maxEdgePx, height: config.maxEdgePx, fit: "inside", withoutEnlargement: true })
      .webp({ quality: config.webpQuality })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new HttpError(415, "Das Bild konnte nicht gelesen werden");
  }
  await ensureMediaDirs(config);
  const filename = `${randomUUID()}.webp`;
  const target = mediaPath(config, kind, filename);
  await writeFile(target, output.data, { flag: "wx" });
  return { kind, filename, path: target, bytes: output.info.size, width: output.info.width, height: output.info.height };
}

import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../../config/env.js";
import { fetchWithTimeout } from "../../lib/fetchWithTimeout.js";
import { loadSharp } from "../../lib/loadSharp.js";

// Exercise images come from the public free-exercise-db repository. The app never hands that
// address to the browser: images are fetched once, kept on the server's disk (the uploads volume)
// and served from `/api/exercise-images/...` — no third-party request per visitor, and the pictures
// keep working when GitHub is unreachable.
const UPSTREAM_BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";
const PUBLIC_PREFIX = "/api/exercise-images/";

// "<Exercise_Name>/<n>.jpg" — the only shape the dataset uses. Anything else is refused, which
// also rules out path traversal.
const RELATIVE_PATH = /^[A-Za-z0-9_()%'-]+\/\d{1,2}\.(?:jpg|jpeg|png|webp)$/;

export const IMAGES_DIR = path.join(path.resolve(env.UPLOADS_DIR), "exercise-images");

export function isValidImagePath(relative: string): boolean {
  return RELATIVE_PATH.test(relative);
}

// Stored image addresses still point at GitHub (that is what the import wrote). On the way out
// they are rewritten to the local route; anything else is passed through untouched.
export function toLocalImageUrl(url: string): string {
  if (!url.startsWith(UPSTREAM_BASE)) return url;
  const relative = url.slice(UPSTREAM_BASE.length);
  // The smaller WebP version: a few KB instead of 60, which is what makes keeping all of them on the
  // phone for offline use reasonable.
  return isValidImagePath(relative) ? `${PUBLIC_PREFIX}${relative}?w=${WEB_IMAGE_WIDTH}` : url;
}

export function toLocalImageUrls(urls: string[]): string[] {
  return urls.map(toLocalImageUrl);
}

export function mimeTypeFor(relative: string): string {
  const ext = relative.slice(relative.lastIndexOf(".") + 1).toLowerCase();
  return ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
}

// The one size the app asks for. Fixed on purpose: a free width in the query would let anyone fill the disk
// with variants.
export const WEB_IMAGE_WIDTH = 600;
const VARIANT_DIR = path.join(IMAGES_DIR, `webp-${WEB_IMAGE_WIDTH}`);
const variantInFlight = new Map<string, Promise<Buffer | null>>();

// Returns the WebP version of an image, made on first use and kept on disk. Null if the original is not
// available (or sharp cannot run); the caller then serves the original.
export async function getExerciseImageWebp(relative: string): Promise<Buffer | null> {
  if (!isValidImagePath(relative)) return null;
  const file = path.join(VARIANT_DIR, `${relative}.webp`);
  try {
    return await readFile(file);
  } catch {
    // not made yet
  }
  const running = variantInFlight.get(relative);
  if (running) return running;
  const job = (async () => {
    const original = await getExerciseImage(relative);
    if (!original) return null;
    const sharp = await loadSharp();
    const bytes = await sharp(original).rotate().resize({ width: WEB_IMAGE_WIDTH, withoutEnlargement: true }).webp({ quality: 72 }).toBuffer();
    await mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    await writeFile(tmp, bytes);
    await rename(tmp, file);
    return bytes;
  })()
    .catch(() => null)
    .finally(() => variantInFlight.delete(relative));
  variantInFlight.set(relative, job);
  return job;
}

const inFlight = new Map<string, Promise<Buffer | null>>();

// Returns the image bytes from disk, downloading and keeping them first if this is the first time.
export async function getExerciseImage(relative: string): Promise<Buffer | null> {
  if (!isValidImagePath(relative)) return null;
  const file = path.join(IMAGES_DIR, relative);
  try {
    return await readFile(file);
  } catch {
    // not stored yet
  }
  const running = inFlight.get(relative);
  if (running) return running;
  const job = (async () => {
    const res = await fetchWithTimeout(`${UPSTREAM_BASE}${relative}`);
    if (!res.ok) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    await mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    await writeFile(tmp, bytes);
    await rename(tmp, file); // never a half-written file under the final name
    return bytes;
  })()
    .catch(() => null)
    .finally(() => inFlight.delete(relative));
  inFlight.set(relative, job);
  return job;
}

async function exists(file: string) {
  return stat(file).then(
    () => true,
    () => false,
  );
}

// Fetches every image the catalog references that isn't on disk yet, a few at a time, in the
// background after boot. Failures are skipped; the next boot (or the first request) retries.
export async function prefetchExerciseImages(
  urlLists: string[][],
  log: { info: (msg: string) => void },
  concurrency = 4,
): Promise<void> {
  const wanted = new Set<string>();
  for (const url of urlLists.flat()) {
    if (!url.startsWith(UPSTREAM_BASE)) continue;
    const relative = url.slice(UPSTREAM_BASE.length);
    if (isValidImagePath(relative)) wanted.add(relative);
  }
  const queue = [...wanted].filter(Boolean);
  const missing: string[] = [];
  for (const relative of queue) {
    if (!(await exists(path.join(IMAGES_DIR, relative)))) missing.push(relative);
  }
  if (missing.length === 0) return;
  log.info(`Exercise images: fetching ${missing.length} missing file(s) from free-exercise-db`);
  let fetched = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    for (let relative = missing.pop(); relative; relative = missing.pop()) {
      if (await getExerciseImage(relative)) fetched += 1;
    }
  });
  await Promise.all(workers);
  log.info(`Exercise images: ${fetched} stored locally`);
}

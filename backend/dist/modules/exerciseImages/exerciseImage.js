import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../../config/env.js";
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
export function isValidImagePath(relative) {
    return RELATIVE_PATH.test(relative);
}
// Stored image addresses still point at GitHub (that is what the import wrote). On the way out
// they are rewritten to the local route; anything else is passed through untouched.
export function toLocalImageUrl(url) {
    if (!url.startsWith(UPSTREAM_BASE))
        return url;
    const relative = url.slice(UPSTREAM_BASE.length);
    return isValidImagePath(relative) ? `${PUBLIC_PREFIX}${relative}` : url;
}
export function toLocalImageUrls(urls) {
    return urls.map(toLocalImageUrl);
}
export function mimeTypeFor(relative) {
    const ext = relative.slice(relative.lastIndexOf(".") + 1).toLowerCase();
    return ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
}
const inFlight = new Map();
// Returns the image bytes from disk, downloading and keeping them first if this is the first time.
export async function getExerciseImage(relative) {
    if (!isValidImagePath(relative))
        return null;
    const file = path.join(IMAGES_DIR, relative);
    try {
        return await readFile(file);
    }
    catch {
        // not stored yet
    }
    const running = inFlight.get(relative);
    if (running)
        return running;
    const job = (async () => {
        const res = await fetch(`${UPSTREAM_BASE}${relative}`);
        if (!res.ok)
            return null;
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
async function exists(file) {
    return stat(file).then(() => true, () => false);
}
// Fetches every image the catalog references that isn't on disk yet, a few at a time, in the
// background after boot. Failures are skipped; the next boot (or the first request) retries.
export async function prefetchExerciseImages(urlLists, log, concurrency = 4) {
    const wanted = new Set();
    for (const url of urlLists.flat()) {
        if (!url.startsWith(UPSTREAM_BASE))
            continue;
        const relative = url.slice(UPSTREAM_BASE.length);
        if (isValidImagePath(relative))
            wanted.add(relative);
    }
    const queue = [...wanted].filter(Boolean);
    const missing = [];
    for (const relative of queue) {
        if (!(await exists(path.join(IMAGES_DIR, relative))))
            missing.push(relative);
    }
    if (missing.length === 0)
        return;
    log.info(`Exercise images: fetching ${missing.length} missing file(s) from free-exercise-db`);
    let fetched = 0;
    const workers = Array.from({ length: concurrency }, async () => {
        for (let relative = missing.pop(); relative; relative = missing.pop()) {
            if (await getExerciseImage(relative))
                fetched += 1;
        }
    });
    await Promise.all(workers);
    log.info(`Exercise images: ${fetched} stored locally`);
}
//# sourceMappingURL=exerciseImage.js.map
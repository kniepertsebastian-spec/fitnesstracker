import { spawn } from "node:child_process";
import { ConflictError } from "../errors/httpErrors.js";
import { OUTGOING_TIMEOUT_MS } from "./fetchWithTimeout.js";
import { loadSharp } from "./loadSharp.js";

// Local text recognition for screenshots and photos (Tesseract, German + English). Shared by the
// AI-explained body analysis and the plain scale-report import, so both read an image the same way.

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const TESSERACT_TIMEOUT_MS = OUTGOING_TIMEOUT_MS;

function runTesseract(image: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("tesseract", ["stdin", "stdout", "-l", "deu+eng", "--psm", "6"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    // A stuck recognition must not hold the request (and a CPU core) forever.
    let timedOut = false;
    const killTimer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, TESSERACT_TIMEOUT_MS);
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", () => {
      clearTimeout(killTimer);
      reject(new ConflictError("Lokale Texterkennung ist auf dem Server nicht verfügbar. Bitte Tesseract installieren oder das Docker-Image aktualisieren."));
    });
    child.on("close", (code) => {
      clearTimeout(killTimer);
      if (timedOut) {
        reject(new ConflictError("Die Texterkennung hat zu lange gedauert (über 60 Sekunden). Bitte lade ein kleineres oder schärferes Bild hoch."));
        return;
      }
      if (code !== 0) {
        reject(new ConflictError(`Die lokale Texterkennung ist fehlgeschlagen: ${Buffer.concat(stderr).toString("utf8").slice(0, 200)}`));
        return;
      }
      resolve(Buffer.concat(stdout).toString("utf8").trim());
    });
    child.stdin.on("error", () => undefined);
    child.stdin.end(image);
  });
}

export async function recognizeImageText(input: Buffer, mimeType: string): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
    throw new ConflictError("Bitte eine JPG-, PNG- oder WebP-Datei hochladen.");
  }
  if (input.length > MAX_IMAGE_BYTES) throw new ConflictError("Das Bild darf maximal 10 MB groß sein.");

  let sharp: Awaited<ReturnType<typeof loadSharp>>;
  try {
    sharp = await loadSharp();
  } catch (error) {
    console.error("Failed to load sharp — text recognition unavailable:", error);
    throw new ConflictError("Bildverarbeitung derzeit nicht verfügbar.");
  }

  let prepared: Buffer;
  try {
    prepared = await sharp(input).rotate().resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true }).grayscale().normalize().png().toBuffer();
  } catch {
    throw new ConflictError("Das Bild konnte nicht gelesen werden. Bitte lade einen Screenshot oder ein Foto erneut hoch.");
  }
  const text = await runTesseract(prepared);
  if (text.length < 8) {
    throw new ConflictError("Auf dem Bild wurden zu wenige lesbare Angaben erkannt. Bitte lade ein schärferes Bild hoch.");
  }
  return text;
}

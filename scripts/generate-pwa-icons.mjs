// Regenerates the PWA icons in frontend/public/icons from the app's logo (a mint tile with the
// lucide "dumbbell", see components/layout/Logo.tsx). Run from the repo root after changing the
// brand colors:  node scripts/generate-pwa-icons.mjs
//
// sharp is a backend dependency, so it's resolved from there instead of adding it to the root.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sharp = createRequire(path.join(root, "backend/package.json"))("sharp");

// Colors from frontend/src/styles/index.css (--accent, --on-accent).
const ACCENT = "#34e3a4";
const ON_ACCENT = "#04140d";

// lucide-react "dumbbell" paths (24 × 24 grid, stroke icon).
const DUMBBELL = [
  "M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z",
  "m2.5 21.5 1.4-1.4",
  "m20.1 3.9 1.4-1.4",
  "M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z",
  "m9.6 14.4 4.8-4.8",
];

// 512-unit canvas. `tile`: the colored shape; `glyph`: the dumbbell's edge length.
function svg({ tile, glyph }) {
  const scale = glyph / 24;
  const offset = (512 - glyph) / 2;
  const background =
    tile.radius === null
      ? `<rect width="512" height="512" fill="${ACCENT}"/>`
      : `<rect x="${tile.inset}" y="${tile.inset}" width="${512 - 2 * tile.inset}" height="${512 - 2 * tile.inset}" rx="${tile.radius}" fill="${ACCENT}"/>`;
  const paths = DUMBBELL.map((d) => `<path d="${d}"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${background}<g transform="translate(${offset} ${offset}) scale(${scale})" fill="none" stroke="${ON_ACCENT}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${paths}</g></svg>`;
}

const icons = [
  // "any": a rounded tile with transparent corners, fine on any launcher background.
  { file: "icon-192.png", size: 192, art: svg({ tile: { inset: 32, radius: 104 }, glyph: 250 }) },
  { file: "icon-512.png", size: 512, art: svg({ tile: { inset: 32, radius: 104 }, glyph: 250 }) },
  // "maskable": full bleed, the glyph inside the 80 % safe zone — the OS applies its own mask.
  { file: "icon-512-maskable.png", size: 512, art: svg({ tile: { radius: null }, glyph: 230 }) },
  // iOS rounds the corners itself and fills transparency with black, so: opaque and full bleed.
  { file: "apple-touch-icon.png", size: 180, art: svg({ tile: { radius: null }, glyph: 260 }) },
];

for (const { file, size, art } of icons) {
  const out = path.join(root, "frontend/public/icons", file);
  await sharp(Buffer.from(art), { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toFile(out);
  console.log("wrote", path.relative(root, out));
}

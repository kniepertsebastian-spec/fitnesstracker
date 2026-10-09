#!/usr/bin/env node
// Lists Hex colors and legacy Tailwind palettes (ink/violet/red/emerald/amber) in frontend JSX
// outside components/ui. See docs/ROADMAP-UI.md (F1). Report only; pass --strict to fail (from F8).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const root = new URL("../frontend/src", import.meta.url).pathname;
const strict = process.argv.includes("--strict");
const PALETTE = /\b(?:[a-z-]+:)*(?:bg|text|border|ring|from|to|via|fill|stroke|divide|outline|placeholder|accent|decoration|shadow)-(?:ink|violet|red|emerald|amber)-\d{2,3}\b/g;
const HEX = /#[0-9a-fA-F]{3,8}\b/g;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (p.endsWith(".tsx")) yield p;
  }
}

let hits = 0;
for (const file of walk(root)) {
  const rel = relative(root, file);
  if (rel.startsWith(`components${sep}ui${sep}`) || rel.includes("UiKitPage")) continue;
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, i) => {
      const found = [...(line.match(PALETTE) ?? []), ...(line.match(HEX) ?? [])];
      for (const m of found) {
        hits++;
        if (!process.argv.includes("--summary")) console.log(`${rel}:${i + 1}  ${m}`);
      }
    });
}
console.log(`\n${hits} Treffer`);
if (strict && hits > 0) process.exit(1);

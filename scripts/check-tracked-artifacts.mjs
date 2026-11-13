#!/usr/bin/env node
// Fails when Git tracks installed dependencies or build output (node_modules/, dist/, build/).
// Once, ~43,000 such files were committed by accident; this keeps it from happening again.
// Runs in CI before anything is installed (it only needs git and node).
import { execFileSync } from "node:child_process";

const FORBIDDEN = /(^|\/)(node_modules|dist|build)\//;

export function findForbidden(paths) {
  return paths.filter((p) => FORBIDDEN.test(p));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  const bad = findForbidden(out.split("\0").filter(Boolean));
  if (bad.length > 0) {
    console.error(`Git tracks ${bad.length} file(s) from node_modules/, dist/ or build/. First entries:`);
    for (const p of bad.slice(0, 10)) console.error(`  ${p}`);
    console.error("Remove them with `git rm -r --cached <path>` (they are listed in .gitignore).");
    process.exit(1);
  }
  console.log("OK: no node_modules/, dist/ or build/ files are tracked.");
}

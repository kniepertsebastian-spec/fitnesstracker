import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadSharp } from "./loadSharp.js";
import { mediaPath, storeImageAsWebp, type MediaConfig } from "./media.js";

let config: MediaConfig;

beforeAll(async () => {
  config = { dir: await mkdtemp(path.join(tmpdir(), "media-test-")), maxUploadBytes: 2 * 1024 * 1024, maxEdgePx: 512, webpQuality: 80 };
});
afterAll(async () => {
  await rm(config.dir, { recursive: true, force: true });
});

async function png(width: number, height: number): Promise<Buffer> {
  const sharp = await loadSharp();
  return sharp({ create: { width, height, channels: 3, background: { r: 139, g: 92, b: 246 } } }).png().toBuffer();
}

describe("storeImageAsWebp", () => {
  it("stores a downscaled WebP under the kind's folder", async () => {
    const stored = await storeImageAsWebp(await png(2000, 1000), "tmp", config);
    expect(stored).toMatchObject({ kind: "tmp", width: 512, height: 256 });
    expect(stored.filename).toMatch(/^[0-9a-f-]{36}\.webp$/);
    expect(stored.path).toBe(path.join(config.dir, "tmp", stored.filename));
    const data = await readFile(stored.path);
    // RIFF....WEBP
    expect(data.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(data.subarray(8, 12).toString("ascii")).toBe("WEBP");
    expect(stored.bytes).toBe(data.length);
  });

  it("never upscales a small image", async () => {
    const stored = await storeImageAsWebp(await png(100, 80), "scans", config);
    expect(stored).toMatchObject({ kind: "scans", width: 100, height: 80 });
  });

  it("refuses an oversized upload with 413 before decoding it", async () => {
    const big = Buffer.alloc(config.maxUploadBytes + 1, 1);
    await expect(storeImageAsWebp(big, "tmp", config)).rejects.toMatchObject({ statusCode: 413 });
  });

  it("refuses data that is not an image with 415 and an empty file with 400", async () => {
    await expect(storeImageAsWebp(Buffer.from("not an image at all"), "tmp", config)).rejects.toMatchObject({ statusCode: 415 });
    await expect(storeImageAsWebp(Buffer.alloc(0), "tmp", config)).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("mediaPath", () => {
  it("only accepts generated names, so a path can't escape the media folder", () => {
    expect(() => mediaPath(config, "tmp", "../../etc/passwd")).toThrow();
    expect(() => mediaPath(config, "tmp", "x.webp")).toThrow();
    expect(() => mediaPath(config, "other" as never, "00000000-0000-0000-0000-000000000000.webp")).toThrow();
    expect(mediaPath(config, "scans", "00000000-0000-0000-0000-000000000000.webp")).toBe(
      path.join(config.dir, "scans", "00000000-0000-0000-0000-000000000000.webp"),
    );
  });
});

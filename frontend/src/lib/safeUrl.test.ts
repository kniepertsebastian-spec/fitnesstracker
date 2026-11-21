import { describe, expect, it } from "vitest";
import { safeExternalUrl } from "./safeUrl";

describe("safeExternalUrl", () => {
  it("accepts https and http URLs", () => {
    expect(safeExternalUrl("https://www.youtube.com/watch?v=abc")).toBe("https://www.youtube.com/watch?v=abc");
    expect(safeExternalUrl("http://example.com/video")).toBe("http://example.com/video");
  });

  it("trims surrounding whitespace", () => {
    expect(safeExternalUrl("  https://example.com/x  ")).toBe("https://example.com/x");
  });

  it("is case-insensitive for the scheme", () => {
    expect(safeExternalUrl("HTTPS://example.com/")).toBe("https://example.com/");
  });

  it("blocks script and data URLs", () => {
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(safeExternalUrl("JavaScript:alert(1)")).toBeNull();
    expect(safeExternalUrl(" javascript:alert(1)")).toBeNull();
    expect(safeExternalUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(safeExternalUrl("vbscript:msgbox(1)")).toBeNull();
  });

  it("blocks other schemes", () => {
    expect(safeExternalUrl("ftp://example.com/file")).toBeNull();
    expect(safeExternalUrl("file:///etc/passwd")).toBeNull();
    expect(safeExternalUrl("mailto:someone@example.com")).toBeNull();
  });

  it("rejects empty, missing, relative and broken URLs", () => {
    expect(safeExternalUrl("")).toBeNull();
    expect(safeExternalUrl("   ")).toBeNull();
    expect(safeExternalUrl(null)).toBeNull();
    expect(safeExternalUrl(undefined)).toBeNull();
    expect(safeExternalUrl("/videos/squat.mp4")).toBeNull();
    expect(safeExternalUrl("www.youtube.com/watch?v=abc")).toBeNull();
    expect(safeExternalUrl("https://")).toBeNull();
    expect(safeExternalUrl("not a url")).toBeNull();
  });
});

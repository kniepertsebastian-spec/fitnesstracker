import { describe, expect, it } from "vitest";
import { createExerciseSchema } from "./exercise.schema";

describe("exercise videoUrl", () => {
  it.each(["https://example.com/v.mp4", "http://example.com/v"])("accepts %s", (videoUrl) => {
    expect(createExerciseSchema.safeParse({ name: "Curl", videoUrl }).success).toBe(true);
  });
  it.each(["javascript:alert(1)", "data:text/html,x", "ftp://example.com/v", "not a url"])("rejects %s", (videoUrl) => {
    expect(createExerciseSchema.safeParse({ name: "Curl", videoUrl }).success).toBe(false);
  });
});

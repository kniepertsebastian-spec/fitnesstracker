import { describe, expect, it } from "vitest";
import { estimateBodyFatCunBae, fatFreeMassIndex } from "./bodyFat.js";

describe("estimateBodyFatCunBae", () => {
  it("matches the published equation for a tall, heavy man (BMI 35.1, 29 y)", () => {
    expect(estimateBodyFatCunBae({ weightKg: 120.3, heightCm: 185, age: 29, gender: "MALE" })).toBe(36.1);
  });

  it("gives typical values for an average adult of each sex (BMI 25, 40 y)", () => {
    const weightKg = 25 * 1.7 ** 2;
    expect(estimateBodyFatCunBae({ weightKg, heightCm: 170, age: 40, gender: "MALE" })).toBe(23.4);
    expect(estimateBodyFatCunBae({ weightKg, heightCm: 170, age: 40, gender: "FEMALE" })).toBe(35.5);
  });

  it("returns null instead of NaN for missing or impossible inputs", () => {
    expect(estimateBodyFatCunBae({ weightKg: 0, heightCm: 180, age: 30, gender: "MALE" })).toBeNull();
    expect(estimateBodyFatCunBae({ weightKg: 80, heightCm: Number.NaN, age: 30, gender: "MALE" })).toBeNull();
  });

  it("stays within 0-100 %", () => {
    const value = estimateBodyFatCunBae({ weightKg: 40, heightCm: 190, age: 18, gender: "MALE" });
    expect(value).not.toBeNull();
    expect(value!).toBeGreaterThanOrEqual(0);
    expect(value!).toBeLessThanOrEqual(100);
  });
});

describe("fatFreeMassIndex", () => {
  it("derives fat-free mass per m² from weight and body fat", () => {
    // 120.3 kg at 20.4 % -> 95.8 kg fat-free at 1.85 m
    expect(fatFreeMassIndex(120.3, 20.4, 185)).toBe(28);
  });

  it("returns null for unusable inputs", () => {
    expect(fatFreeMassIndex(80, 100, 180)).toBeNull();
    expect(fatFreeMassIndex(80, -1, 180)).toBeNull();
    expect(fatFreeMassIndex(80, 20, 0)).toBeNull();
  });
});

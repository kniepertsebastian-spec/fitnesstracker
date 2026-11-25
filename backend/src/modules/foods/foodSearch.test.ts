import { describe, expect, it } from "vitest";
import { searchTerms } from "./food.service.js";

describe("searchTerms", () => {
  it("adds the BLS word for everyday terms, only for the whole query", () => {
    expect(searchTerms("Ei")).toEqual(["Ei", "Hühnerei"]);
    expect(searchTerms(" nudeln ")).toEqual(["nudeln", "Teigwaren"]);
    expect(searchTerms("Eiweißpulver")).toEqual(["Eiweißpulver"]);
    expect(searchTerms("Hafer   Flocken")).toEqual(["Hafer Flocken"]);
  });
});

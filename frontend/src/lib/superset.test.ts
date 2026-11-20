import { describe, expect, it } from "vitest";
import { stepAfterPairedSet, type PairMember } from "./superset";

const A = (done: number, total = 3): PairMember => ({ id: "A", done, total });
const B = (done: number, total = 3): PairMember => ({ id: "B", done, total });

describe("stepAfterPairedSet", () => {
  it("goes from A to B without a pause", () => {
    expect(stepAfterPairedSet("A", 1, A(1), B(0))).toEqual({ kind: "switch", id: "B", rest: false });
  });

  it("goes back from B to A and starts the pause — not on to a third exercise", () => {
    expect(stepAfterPairedSet("B", 1, A(1), B(1))).toEqual({ kind: "switch", id: "A", rest: true });
    expect(stepAfterPairedSet("B", 2, A(2), B(2))).toEqual({ kind: "switch", id: "A", rest: true });
  });

  it("finishes after the last set of both", () => {
    expect(stepAfterPairedSet("B", 3, A(3), B(3))).toEqual({ kind: "finished", rest: true });
  });

  it("copes with a partner that has fewer sets", () => {
    // A: 3 sets, B: 2. After B's 2nd set the round is over and A goes on alone.
    expect(stepAfterPairedSet("B", 2, A(2, 3), B(2, 2))).toEqual({ kind: "switch", id: "A", rest: true });
    // A's 3rd set: B is complete, so the round counts as done and the pairing ends.
    expect(stepAfterPairedSet("A", 3, A(3, 3), B(2, 2))).toEqual({ kind: "finished", rest: true });
  });

  it("copes with B being logged first", () => {
    expect(stepAfterPairedSet("B", 1, A(0), B(1))).toEqual({ kind: "switch", id: "A", rest: false });
  });

  it("returns to the partner when the anchor has no sets left but the partner does", () => {
    expect(stepAfterPairedSet("A", 2, A(2, 2), B(2, 3))).toEqual({ kind: "switch", id: "B", rest: true });
  });
});

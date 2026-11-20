// A superset is exactly two exercises, done alternately: A set 1 → B set 1 → (pause) → A set 2 → ...
// This decides where to go after a set of the pair was logged. Pure, so the flow is unit-tested.

export interface PairMember {
  id: string;
  // Sets logged for the exercise *including* the one just logged.
  done: number;
  // Sets planned for the exercise.
  total: number;
}

export type PairStep =
  // Go to this exercise; `rest` says whether the superset pause starts now (a round is finished).
  | { kind: "switch"; id: string; rest: boolean }
  // Both exercises are done: the pairing ends, the superset pause still applies.
  | { kind: "finished"; rest: true };

const complete = (m: PairMember) => m.done >= m.total;

export function stepAfterPairedSet(entryId: string, setNumber: number, anchor: PairMember, partner: PairMember): PairStep {
  const other = entryId === anchor.id ? partner : anchor;
  // The round is over once the other exercise has its set of this number (or has no sets left).
  const roundDone = complete(other) || other.done >= setNumber;
  if (!roundDone) return { kind: "switch", id: other.id, rest: false };
  // New round: always back to the exercise the superset was started on, never on to a third one.
  if (!complete(anchor)) return { kind: "switch", id: anchor.id, rest: true };
  if (!complete(partner)) return { kind: "switch", id: partner.id, rest: true };
  return { kind: "finished", rest: true };
}

// A group of exercises done alternately: A set 1 → B set 1 → (C set 1) → pause → A set 2 → ...
// Superset, compound set, pre-/post-exhaust and giant set all work like this; only the members and the
// pause differ. This decides where to go after a set of a member was logged. Pure, so the flow is
// unit-tested.

export interface PairMember {
  id: string;
  // Sets logged for the exercise *including* the one just logged.
  done: number;
  // Sets planned for the exercise.
  total: number;
}

export type PairStep =
  // Go to this exercise; `rest` says whether the group pause starts now (a round is finished).
  | { kind: "switch"; id: string; rest: boolean }
  // Every member is done: the group ends, the pause still applies.
  | { kind: "finished"; rest: true };

const complete = (m: PairMember) => m.done >= m.total;

// `members` are in the order they are done in. After a member's set number `setNumber`: on to the next
// member that still owes this round's set (no pause); once nobody does, the round is over — pause, and
// back to the first member that has sets left, never past the group.
export function stepAfterGroupSet(entryId: string, setNumber: number, members: PairMember[]): PairStep {
  const at = members.findIndex((m) => m.id === entryId);
  const ring = members.map((_, k) => members[(at + 1 + k) % members.length]).filter((m) => m.id !== entryId);
  const owing = ring.find((m) => !complete(m) && m.done < setNumber);
  if (owing) return { kind: "switch", id: owing.id, rest: false };
  const next = members.find((m) => !complete(m));
  return next ? { kind: "switch", id: next.id, rest: true } : { kind: "finished", rest: true };
}

// The two-exercise case (a manual superset).
export function stepAfterPairedSet(entryId: string, setNumber: number, anchor: PairMember, partner: PairMember): PairStep {
  return stepAfterGroupSet(entryId, setNumber, [anchor, partner]);
}

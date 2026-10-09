// F9: the training view walks through Aufwärmen → Kraft → Cardio → Dehnen. Strength progress is
// derived from the logged sets; the other sections keep a small per-session status here
// (localStorage, keyed by the session's clientId) so a reload or a short trip to another page
// does not reset them. Like the stretch checkmarks this is per-device UI state, not account data:
// the cardio entries themselves go through the offline queue.

export type Stage = "warmup" | "kraft" | "cardio" | "stretch";
export type StageStatus = "open" | "done" | "skipped";

export interface SectionState {
  status: StageStatus;
  // Indices of the planned cardio items already saved (warm-up / after sections).
  doneItems: number[];
  // Minutes actually logged in this section, for the summary.
  minutesLogged: number;
}

export interface StageState {
  warmup: SectionState;
  cardio: SectionState;
  stretch: SectionState;
}

export const STAGE_LABELS: Record<Stage, string> = {
  warmup: "Aufwärmen",
  kraft: "Kraft",
  cardio: "Cardio",
  stretch: "Dehnen",
};

const emptySection = (): SectionState => ({ status: "open", doneItems: [], minutesLogged: 0 });
export const emptyStageState = (): StageState => ({ warmup: emptySection(), cardio: emptySection(), stretch: emptySection() });

const key = (sessionClientId: string) => `training-stages:${sessionClientId}`;

function isSection(value: unknown): value is SectionState {
  const v = value as SectionState | null;
  return (
    !!v &&
    ["open", "done", "skipped"].includes(v.status) &&
    Array.isArray(v.doneItems) &&
    typeof v.minutesLogged === "number"
  );
}

export function loadStageState(sessionClientId: string): StageState {
  try {
    const raw = localStorage.getItem(key(sessionClientId));
    if (!raw) return emptyStageState();
    const parsed = JSON.parse(raw) as Partial<StageState>;
    return {
      warmup: isSection(parsed.warmup) ? parsed.warmup : emptySection(),
      cardio: isSection(parsed.cardio) ? parsed.cardio : emptySection(),
      stretch: isSection(parsed.stretch) ? parsed.stretch : emptySection(),
    };
  } catch {
    return emptyStageState();
  }
}

export function saveStageState(sessionClientId: string, state: StageState) {
  try {
    localStorage.setItem(key(sessionClientId), JSON.stringify(state));
  } catch {
    // storage unavailable — the in-memory state still works for this visit
  }
}

export function stretchStorageKey(sessionClientId: string) {
  return `training-stretch:${sessionClientId}`;
}

// Which section to show when the user hasn't picked one: the first one not finished yet, in
// training order. Strength counts as finished once every planned set is logged.
export function defaultStage(stages: Stage[], state: StageState, kraftDone: boolean): Stage {
  const finished = (s: Stage) => (s === "kraft" ? kraftDone : state[s].status !== "open");
  return stages.find((s) => !finished(s)) ?? stages[stages.length - 1] ?? "kraft";
}

import type { CardioPlanItem, CardioSlot, StretchItemDto } from "@fitnesstracker/shared";

// Week status, stretch plan and cardio plan all derive their days from the same plan exercises,
// so the day label is the shared key. A plan without split days has one day with label null.
export function matchDay<T extends { dayLabel: string | null }>(days: T[] | undefined, dayLabel: string | null): T | null {
  if (!days) return null;
  return days.find((d) => d.dayLabel === dayLabel) ?? null;
}

export function cardioMinutes(items: CardioPlanItem[], slot?: CardioSlot): number {
  return items.filter((i) => !slot || i.slot === slot).reduce((sum, i) => sum + i.durationMinutes, 0);
}

// Hold time plus ~15 s to get into each position, rounded up to whole minutes.
export function stretchMinutes(items: StretchItemDto[]): number {
  if (items.length === 0) return 0;
  const seconds = items.reduce((sum, i) => sum + i.holdSeconds * i.sets + 15, 0);
  return Math.max(1, Math.ceil(seconds / 60));
}

export function formatHold(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

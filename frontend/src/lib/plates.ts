// Plate calculator for a barbell: which plates go on each side for a target total weight.

export const DEFAULT_BAR_KG = 20;
// Common gym plates, heaviest first (kg, per plate).
const PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];

export interface PlateLoad {
  // Plates for ONE side, heaviest first.
  plates: number[];
  // Weight that cannot be made with the plates above (e.g. 21 kg on a 20 kg bar), per side.
  remainderKg: number;
}

// Greedy works because every plate is a multiple of the next smaller one's half-steps down to
// 1.25 kg. Returns null when the target is lighter than the bar itself.
export function platesPerSide(totalKg: number, barKg = DEFAULT_BAR_KG): PlateLoad | null {
  if (totalKg < barKg) return null;
  let left = Math.round(((totalKg - barKg) / 2) * 100) / 100;
  const plates: number[] = [];
  for (const plate of PLATES_KG) {
    while (left + 1e-9 >= plate) {
      plates.push(plate);
      left = Math.round((left - plate) * 100) / 100;
    }
  }
  return { plates, remainderKg: left };
}

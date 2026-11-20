// Axis helpers for the progress chart: round tick values and calendar ticks. Pure, unit-tested.

// A "nice" step (1, 2, 2.5, 5 × 10^n) that gives about `target` ticks across [min, max].
export function niceTicks(min: number, max: number, target = 5): { ticks: number[]; lo: number; hi: number } {
  if (!(max > min)) {
    const v = Number.isFinite(min) ? min : 0;
    const pad = v === 0 ? 1 : Math.abs(v) * 0.1;
    return niceTicks(v - pad, v + pad, target);
  }
  const rough = (max - min) / Math.max(1, target);
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / pow;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * pow;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v / step) * step);
  return { ticks, lo, hi };
}

const DAY = 86_400_000;

// Calendar ticks across [t0, t1] (ms): month starts when the span is long, otherwise weekly or every few
// days — never more than `maxTicks`.
export function timeTicks(t0: number, t1: number, maxTicks = 6): number[] {
  const span = t1 - t0;
  if (!(span > 0)) return [t0];
  const out: number[] = [];
  if (span > 75 * DAY) {
    // First of a month, every 1, 2, 3 or 6 months, whatever fits.
    const months = Math.ceil(span / (30.4 * DAY));
    const every = [1, 2, 3, 6, 12].find((n) => months / n <= maxTicks) ?? 12;
    const start = new Date(t0);
    const y = start.getUTCFullYear();
    let m = start.getUTCMonth() + (start.getUTCDate() > 1 ? 1 : 0);
    m = Math.ceil(m / every) * every;
    for (;;) {
      const t = Date.UTC(y + Math.floor(m / 12), m % 12, 1);
      if (t > t1) break;
      if (t >= t0) out.push(t);
      m += every;
    }
    return out;
  }
  const step = [1, 2, 3, 7, 14].find((d) => span / (d * DAY) <= maxTicks) ?? 14;
  const first = Math.ceil(t0 / (step * DAY)) * step * DAY;
  for (let t = first; t <= t1; t += step * DAY) out.push(t);
  return out;
}

const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

export function formatTick(t: number, span: number): string {
  const d = new Date(t);
  if (span > 75 * DAY) return d.getUTCMonth() === 0 ? `${MONTHS[0]} ${String(d.getUTCFullYear()).slice(2)}` : MONTHS[d.getUTCMonth()];
  return `${d.getUTCDate()}. ${MONTHS[d.getUTCMonth()]}`;
}

export function formatFullDay(t: number): string {
  const d = new Date(t);
  return d.toLocaleDateString("de-DE", { timeZone: "UTC", weekday: "short", day: "numeric", month: "long", year: "numeric" });
}

export function formatValue(value: number, unit: string): string {
  const rounded = unit === "Wdh." ? Math.round(value) : Math.round(value * 10) / 10;
  const text = rounded.toLocaleString("de-DE", { maximumFractionDigits: 1 });
  return unit === "Wdh." ? `${text} Wdh.` : `${text} ${unit}`;
}

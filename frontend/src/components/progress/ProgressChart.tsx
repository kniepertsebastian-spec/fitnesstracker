import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { formatFullDay, formatTick, formatValue, niceTicks, timeTicks } from "../../lib/chartScale";
import type { PhaseBand, SeriesPoint } from "../../lib/progressSeries";
import { cn } from "../ui";

export interface ChartSeries {
  id: string;
  label: string;
  // A CSS colour value, always one of the --chart-N tokens.
  color: string;
  points: SeriesPoint[];
}

interface Props {
  series: ChartSeries[];
  bands: PhaseBand[];
  unit: string;
  // The visible stretch of time (ms): the chart always spans it, so ranges compare.
  domain: { from: number; to: number };
  ariaLabel: string;
  height?: number;
  // Width used until the real one is measured (and on the server, which has no layout).
  initialWidth?: number;
}

const MARGIN = { top: 22, right: 14, bottom: 26, left: 46 };
const DAY = 86_400_000;
// Markers on every training day up to this many points (and only while they have room); beyond it only the records keep one.
const MARKER_LIMIT = 45;

function useWidth(ref: React.RefObject<HTMLElement | null>, fallback = 320): number {
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setWidth(Math.max(240, Math.round(el.getBoundingClientRect().width)));
    read();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

// A line chart over time: one value per training day, one axis, phase stretches as quiet bands, records as
// ringed dots. A crosshair snaps to the nearest training day and a tooltip lists every series at it (pointer
// or arrow keys); the table view in the card carries the same numbers without hovering.
export function ProgressChart({ series, bands, unit, domain, ariaLabel, height = 260, initialWidth = 320 }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const width = useWidth(box, initialWidth);
  const [active, setActive] = useState<number | null>(null);

  const plotW = width - MARGIN.left - MARGIN.right;
  const plotH = height - MARGIN.top - MARGIN.bottom;
  const span = Math.max(DAY, domain.to - domain.from);

  const allDays = useMemo(() => [...new Set(series.flatMap((s) => s.points.map((p) => p.t)))].sort((a, b) => a - b), [series]);

  const y = useMemo(() => {
    const values = series.flatMap((s) => s.points.map((p) => p.value));
    if (values.length === 0) return { ticks: [0, 1], lo: 0, hi: 1 };
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = Math.max((max - min) * 0.1, max * 0.02, 0.5);
    const { ticks, lo, hi } = niceTicks(Math.max(0, min - pad), max + pad, 4);
    return { ticks, lo: Math.max(0, lo), hi };
  }, [series]);

  const x = (t: number) => MARGIN.left + ((t - domain.from) / span) * plotW;
  const yy = (v: number) => MARGIN.top + (1 - (v - y.lo) / (y.hi - y.lo || 1)) * plotH;
  const xTicks = useMemo(() => timeTicks(domain.from, domain.to, Math.max(2, Math.floor(plotW / 70))), [domain, plotW]);

  const nearestDay = (clientX: number, rect: DOMRect): number | null => {
    if (allDays.length === 0) return null;
    const t = domain.from + ((clientX - rect.left - MARGIN.left) / plotW) * span;
    let best = allDays[0];
    for (const d of allDays) if (Math.abs(d - t) < Math.abs(best - t)) best = d;
    return best;
  };

  const onPointer = (e: PointerEvent<SVGRectElement>) => {
    setActive(nearestDay(e.clientX, e.currentTarget.ownerSVGElement!.getBoundingClientRect()));
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (allDays.length === 0) return;
    const i = active === null ? -1 : allDays.indexOf(active);
    let next: number | null = null;
    if (e.key === "ArrowLeft") next = allDays[Math.max(0, (i === -1 ? allDays.length : i) - 1)];
    else if (e.key === "ArrowRight") next = allDays[Math.min(allDays.length - 1, i + 1)];
    else if (e.key === "Home") next = allDays[0];
    else if (e.key === "End") next = allDays.at(-1) as number;
    else if (e.key === "Escape") setActive(null);
    if (next !== null) {
      e.preventDefault();
      setActive(next);
    }
  };

  const band = (t: number) => bands.find((b) => t >= b.from && t <= b.to);
  const activeX = active === null ? null : x(active);
  const tooltipLeft = activeX === null ? 0 : activeX > width * 0.6 ? activeX - 12 : activeX + 12;
  const flip = activeX !== null && activeX > width * 0.6;

  return (
    <div
      ref={box}
      className="relative rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent"
      tabIndex={0}
      role="group"
      aria-label={`${ariaLabel}. Mit den Pfeiltasten durch die Trainingstage gehen.`}
      onKeyDown={onKey}
      onFocus={() => active === null && allDays.length > 0 && setActive(allDays.at(-1) as number)}
      onBlur={() => setActive(null)}
    >
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel} className="block select-none">
        {/* Phases: alternate quiet washes, named at the top where there is room. */}
        {bands.map((b, i) => {
          const x0 = Math.max(MARGIN.left, x(b.from));
          const x1 = Math.min(width - MARGIN.right, x(b.to));
          if (x1 - x0 < 2) return null;
          return (
            <g key={`${b.label}-${i}`}>
              {i % 2 === 0 && <rect x={x0} y={MARGIN.top} width={x1 - x0} height={plotH} fill="var(--surface-2)" opacity={0.45} />}
              {x1 - x0 > 54 && (
                <text x={x0 + 6} y={MARGIN.top - 8} fontSize={10.5} fill="var(--text-faint)">
                  {b.label.length > (x1 - x0) / 6 ? `${b.label.slice(0, Math.max(3, Math.floor((x1 - x0) / 6) - 1))}…` : b.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Grid and y axis: hairlines, recessive. */}
        {y.ticks.map((t) => (
          <g key={t}>
            <line x1={MARGIN.left} x2={width - MARGIN.right} y1={yy(t)} y2={yy(t)} stroke="var(--border-subtle)" strokeWidth={1} />
            <text x={MARGIN.left - 8} y={yy(t) + 4} textAnchor="end" fontSize={11} fill="var(--text-faint)" className="tabular">
              {t.toLocaleString("de-DE", { maximumFractionDigits: 1 })}
            </text>
          </g>
        ))}
        <text x={MARGIN.left - 8} y={12} textAnchor="end" fontSize={10.5} fill="var(--text-faint)">
          {unit}
        </text>
        {xTicks.map((t) => (
          <text key={t} x={x(t)} y={height - 8} textAnchor="middle" fontSize={11} fill="var(--text-faint)">
            {formatTick(t, span)}
          </text>
        ))}

        {series.map((s) => {
          const pts = s.points;
          if (pts.length === 0) return null;
          const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.t).toFixed(1)},${yy(p.value).toFixed(1)}`).join(" ");
          // A dot per training day only where there is room for it (about 12 px apart); otherwise just the records.
          const showAll = pts.length <= MARKER_LIMIT && plotW / Math.max(1, pts.length) >= 12;
          return (
            <g key={s.id}>
              {/* A single series gets a faint wash under its line; several would only muddy each other. */}
              {series.length === 1 && pts.length > 1 && (
                <path d={`${path} L${x(pts.at(-1)!.t).toFixed(1)},${yy(y.lo)} L${x(pts[0].t).toFixed(1)},${yy(y.lo)} Z`} fill={s.color} opacity={0.1} />
              )}
              <path d={path} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {pts.map((p) =>
                showAll || p.record ? (
                  <g key={p.dayKey}>
                    {p.record && <circle cx={x(p.t)} cy={yy(p.value)} r={8} fill="none" stroke={s.color} strokeWidth={1.5} opacity={0.8} />}
                    <circle cx={x(p.t)} cy={yy(p.value)} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
                  </g>
                ) : null,
              )}
            </g>
          );
        })}

        {active !== null && (
          <g pointerEvents="none">
            <line x1={x(active)} x2={x(active)} y1={MARGIN.top} y2={MARGIN.top + plotH} stroke="var(--border-strong)" strokeWidth={1} />
            {series.map((s) => {
              const p = s.points.find((q) => q.t === active);
              return p ? <circle key={s.id} cx={x(p.t)} cy={yy(p.value)} r={5.5} fill={s.color} stroke="var(--surface)" strokeWidth={2} /> : null;
            })}
          </g>
        )}

        {/* The hit area is the whole plot: the pointer only has to be near a day, not on a dot. */}
        <rect
          x={MARGIN.left}
          y={MARGIN.top}
          width={Math.max(0, plotW)}
          height={plotH}
          fill="transparent"
          style={{ touchAction: "pan-y" }}
          onPointerMove={onPointer}
          onPointerDown={onPointer}
          onPointerLeave={(e) => e.pointerType === "mouse" && setActive(null)}
        />
      </svg>

      {active !== null && (
        <div
          role="status"
          className={cn(
            "pointer-events-none absolute top-1 z-10 min-w-36 max-w-56 rounded-lg border border-border-strong bg-surface-2 px-3 py-2 shadow-lg",
            flip && "-translate-x-full",
          )}
          style={{ left: tooltipLeft }}
        >
          <p className="text-xs text-text-subtle">{formatFullDay(active)}</p>
          {band(active) && <p className="text-xs text-text-faint">{band(active)!.label}</p>}
          <ul className="mt-1 flex flex-col gap-1">
            {series.map((s) => {
              const p = s.points.find((q) => q.t === active);
              return (
                <li key={s.id} className="flex items-center gap-2">
                  <span aria-hidden className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: s.color }} />
                  <span className="min-w-0 flex-1">
                    <span className="tabular block font-numeric text-body font-semibold text-text">
                      {p ? formatValue(p.value, unit) : "–"}
                      {p?.record && <span className="ml-1.5 text-xs font-medium text-text-2">Rekord</span>}
                    </span>
                    <span className="block truncate text-xs text-text-subtle">{s.label}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

// The same numbers as a table: every training day of the shown exercises, newest first.
export function ProgressTable({ series, unit }: { series: ChartSeries[]; unit: string }) {
  const [shown, setShown] = useState(20);
  const days = useMemo(() => [...new Set(series.flatMap((s) => s.points.map((p) => p.t)))].sort((a, b) => b - a), [series]);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-small">
        <caption className="sr-only">Verlauf je Trainingstag</caption>
        <thead>
          <tr className="text-left text-overline text-text-faint">
            <th scope="col" className="py-1.5 pr-3 font-semibold">
              Tag
            </th>
            {series.map((s) => (
              <th key={s.id} scope="col" className="px-2 py-1.5 text-right font-semibold">
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ background: s.color }} />
                  <span className="max-w-32 truncate">{s.label}</span>
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.slice(0, shown).map((t) => (
            <tr key={t} className="border-t border-border-subtle">
              <th scope="row" className="py-1.5 pr-3 text-left font-normal text-text-2">
                {formatFullDay(t)}
              </th>
              {series.map((s) => {
                const p = s.points.find((q) => q.t === t);
                return (
                  <td key={s.id} className="tabular px-2 py-1.5 text-right font-numeric text-text">
                    {p ? formatValue(p.value, unit) : "–"}
                    {p?.record && <span className="ml-1 text-xs text-accent-text">Rekord</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {days.length > shown && (
        <button type="button" className="mt-2 text-small text-accent-text hover:text-accent-text-hover" onClick={() => setShown((n) => n + 30)}>
          Mehr anzeigen
        </button>
      )}
    </div>
  );
}

interface SparklineProps {
  values: number[];
  color?: string;
}

// Hand-rolled instead of pulling in a charting library — a single trend line over a handful of
// data points doesn't need Recharts/D3's weight for a personal, single-user app; a plain SVG
// polyline is a few lines of math and has zero bundle-size cost. Scales to fill its container
// width via viewBox, so the parent controls actual pixel size purely with CSS.
export function Sparkline({ values, color = "#a78bfa" }: SparklineProps) {
  if (values.length < 2) {
    return <div className="flex h-16 items-center justify-center text-xs text-ink-600">Zu wenige Datenpunkte</div>;
  }

  const width = 300;
  const height = 64;
  const padding = 4;
  const min = Math.min(...values);
  const max = Math.max(...values);
  // A flat series (min === max) would divide by zero — draw it as a flat mid-height line instead.
  const range = max - min || 1;

  const points = values.map((v, i) => {
    const x = padding + (i / (values.length - 1)) * (width - padding * 2);
    const y = padding + (1 - (v - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-16 w-full" preserveAspectRatio="none">
      <polyline points={points.join(" ")} fill="none" stroke={color} strokeWidth={2} />
    </svg>
  );
}

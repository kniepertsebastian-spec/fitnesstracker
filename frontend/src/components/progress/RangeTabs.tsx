import { PROGRESS_RANGE_LABELS, type ProgressRange } from "../../lib/progressRange";

const RANGES: ProgressRange[] = ["4w", "3m", "1y", "all"];

interface RangeTabsProps {
  selected: ProgressRange;
  onSelect: (range: ProgressRange) => void;
}

// Same visual pattern as trainingPlan/PhaseTabs — a single tab bar driving every card on the
// page, rather than each card getting its own range picker.
export function RangeTabs({ selected, onSelect }: RangeTabsProps) {
  return (
    <div className="mb-4 flex gap-1 rounded-lg border border-ink-800 bg-ink-900 p-1">
      {RANGES.map((range) => (
        <button
          key={range}
          onClick={() => onSelect(range)}
          className={`flex-1 rounded-md py-1.5 text-sm font-medium ${
            selected === range ? "bg-violet-500 text-ink-950" : "text-ink-400 hover:text-ink-200"
          }`}
        >
          {PROGRESS_RANGE_LABELS[range]}
        </button>
      ))}
    </div>
  );
}

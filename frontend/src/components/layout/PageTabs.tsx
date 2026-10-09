import { SegmentedControl } from "../ui";

interface PageTab {
  key: string;
  label: string;
}

interface Props {
  tabs: readonly PageTab[];
  active: string;
  onChange: (key: string) => void;
}

// A segmented control for swapping between sections of a page without leaving it — used where a
// page has accumulated several independent cards (see e.g. NutritionPage) that don't all need to
// be visible/scrolled through at once.
export function PageTabs({ tabs, active, onChange }: Props) {
  return (
    <SegmentedControl
      label="Abschnitt"
      className="mb-4"
      value={active}
      onChange={onChange}
      options={tabs.map((t) => ({ value: t.key, label: t.label }))}
    />
  );
}

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
    <div className="mb-4 flex gap-1 rounded-lg bg-slate-900 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
            active === tab.key ? "bg-violet-500 text-slate-950" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

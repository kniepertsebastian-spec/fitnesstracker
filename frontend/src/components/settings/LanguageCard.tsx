import { useLanguage, type AppLanguage } from "../../i18n";

const OPTIONS: Array<{ value: AppLanguage; label: string }> = [
  { value: "de", label: "Deutsch" },
  { value: "en", label: "English" },
];

export function LanguageCard() {
  const { language, setLanguage } = useLanguage();
  return (
    <div className="rounded-lg border border-ink-800 bg-ink-900 p-4" data-no-translate>
      <p className="text-sm font-medium text-ink-300">Sprache / Language</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => setLanguage(option.value)}
            aria-pressed={language === option.value}
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${
              language === option.value
                ? "border-violet-500 bg-violet-500/10 text-violet-300"
                : "border-ink-700 text-ink-300 hover:bg-ink-800"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

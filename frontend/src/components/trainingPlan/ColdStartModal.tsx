import { useState } from "react";
import type { ColdStartInput } from "@fitnesstracker/shared";

interface Props {
  onSubmit: (input: ColdStartInput) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

const EQUIPMENT_OPTIONS: { value: ColdStartInput["equipment"]; label: string }[] = [
  { value: "homegym", label: "Homegym (Kurzhanteln, Bänder, Körpergewicht)" },
  { value: "dumbbells", label: "Nur Kurzhanteln" },
  { value: "fullgym", label: "Vollausgestattetes Studio" },
];

const EXPERIENCE_OPTIONS: { value: ColdStartInput["experience"]; label: string }[] = [
  { value: "beginner", label: "Anfänger" },
  { value: "intermediate", label: "Fortgeschritten" },
  { value: "advanced", label: "Erfahren" },
];

const STEP_COUNT = 4;

// A short step-by-step wizard rather than one long form — asked once per generation for a
// cold-start user (not enough workout history yet for the warm-start path to have anything
// useful to inject), so it needs to stay quick.
export function ColdStartModal({ onSubmit, onCancel, isSubmitting }: Props) {
  const [step, setStep] = useState(1);
  const [frequencyPerWeek, setFrequencyPerWeek] = useState(3);
  const [equipment, setEquipment] = useState<ColdStartInput["equipment"]>("homegym");
  const [experience, setExperience] = useState<ColdStartInput["experience"]>("beginner");
  const [limitations, setLimitations] = useState("");

  const next = () => setStep((s) => Math.min(STEP_COUNT, s + 1));
  const back = () => setStep((s) => Math.max(1, s - 1));

  const handleFinish = () => {
    onSubmit({ frequencyPerWeek, equipment, experience, limitations: limitations || undefined });
  };

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/60 sm:items-center">
      <div className="w-full max-w-sm rounded-t-2xl bg-ink-900 p-4 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Ein paar Fragen zuerst</h2>
          <span className="text-xs text-ink-500">
            Schritt {step}/{STEP_COUNT}
          </span>
        </div>

        {step === 1 && (
          <div>
            <label className="mb-2 block text-sm text-ink-400">
              Wie oft möchtest du pro Woche trainieren?
            </label>
            <input
              type="number"
              min={1}
              max={7}
              value={frequencyPerWeek}
              onChange={(e) => setFrequencyPerWeek(Number(e.target.value))}
              className="w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2"
            />
          </div>
        )}

        {step === 2 && (
          <div>
            <label className="mb-2 block text-sm text-ink-400">Welches Equipment hast du?</label>
            <div className="flex flex-col gap-2">
              {EQUIPMENT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setEquipment(opt.value)}
                  className={`rounded-lg border px-3 py-2 text-left text-sm ${
                    equipment === opt.value
                      ? "border-violet-500 bg-violet-500/10 text-violet-300"
                      : "border-ink-700 text-ink-300 hover:bg-ink-800"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <label className="mb-2 block text-sm text-ink-400">Wie ist dein Erfahrungsgrad?</label>
            <div className="flex flex-col gap-2">
              {EXPERIENCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setExperience(opt.value)}
                  className={`rounded-lg border px-3 py-2 text-left text-sm ${
                    experience === opt.value
                      ? "border-violet-500 bg-violet-500/10 text-violet-300"
                      : "border-ink-700 text-ink-300 hover:bg-ink-800"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <label className="mb-2 block text-sm text-ink-400">
              Körperliche Einschränkungen? (optional)
            </label>
            <textarea
              value={limitations}
              onChange={(e) => setLimitations(e.target.value)}
              rows={3}
              placeholder="z. B. Knieprobleme, Rückenschmerzen…"
              className="w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm"
            />
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={step === 1 ? onCancel : back}
            className="flex-1 rounded-lg border border-ink-700 py-2 text-ink-300 hover:bg-ink-800"
          >
            {step === 1 ? "Abbrechen" : "Zurück"}
          </button>
          {step < STEP_COUNT ? (
            <button
              onClick={next}
              className="flex-1 rounded-lg bg-violet-500 py-2 font-medium text-ink-950 hover:bg-violet-400"
            >
              Weiter
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={isSubmitting}
              className="flex-1 rounded-lg bg-violet-500 py-2 font-medium text-ink-950 hover:bg-violet-400 disabled:opacity-50"
            >
              {isSubmitting ? "Generiert…" : "Plan generieren"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

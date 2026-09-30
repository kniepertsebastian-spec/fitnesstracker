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

const GOAL_OPTIONS: { value: ColdStartInput["goal"]; label: string }[] = [
  { value: "muscle_gain", label: "Muskelaufbau" },
  { value: "strength", label: "Kraftaufbau" },
  { value: "endurance", label: "Kraftausdauer" },
  { value: "fat_loss", label: "Fettabbau & Muskelerhalt" },
  { value: "general_fitness", label: "Allgemeine Fitness" },
];

const STEP_COUNT = 7;

// A step-by-step wizard rather than one long form. It opens before every generation, because
// goals, available time, equipment and limitations can change even when history already exists.
export function ColdStartModal({ onSubmit, onCancel, isSubmitting }: Props) {
  const [step, setStep] = useState(1);
  const [frequencyPerWeek, setFrequencyPerWeek] = useState(3);
  const [equipment, setEquipment] = useState<ColdStartInput["equipment"]>("homegym");
  const [experience, setExperience] = useState<ColdStartInput["experience"]>("beginner");
  const [goal, setGoal] = useState<ColdStartInput["goal"]>("muscle_gain");
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState(60);
  const [equipmentDetails, setEquipmentDetails] = useState("");
  const [priorityMuscles, setPriorityMuscles] = useState("");
  const [preferredExercises, setPreferredExercises] = useState("");
  const [avoidedExercises, setAvoidedExercises] = useState("");
  const [limitations, setLimitations] = useState("");

  const next = () => setStep((s) => Math.min(STEP_COUNT, s + 1));
  const back = () => setStep((s) => Math.max(1, s - 1));

  const handleFinish = () => {
    onSubmit({
      frequencyPerWeek,
      equipment,
      experience,
      goal,
      sessionDurationMinutes,
      equipmentDetails: equipmentDetails.trim() || undefined,
      priorityMuscles: priorityMuscles.trim() || undefined,
      preferredExercises: preferredExercises.trim() || undefined,
      avoidedExercises: avoidedExercises.trim() || undefined,
      limitations: limitations.trim() || undefined,
    });
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
            <label className="mb-2 block text-sm text-ink-400">Was ist dein Hauptziel?</label>
            <div className="flex flex-col gap-2">
              {GOAL_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setGoal(option.value)}
                  className={`rounded-lg border px-3 py-2 text-left text-sm ${
                    goal === option.value
                      ? "border-violet-500 bg-violet-500/10 text-violet-300"
                      : "border-ink-700 text-ink-300 hover:bg-ink-800"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <label className="mb-2 block text-sm text-ink-400">
              Wie oft und wie lange möchtest du trainieren?
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="mb-1 block text-xs text-ink-500">Einheiten/Woche</span>
                <input
                  type="number"
                  min={1}
                  max={7}
                  value={frequencyPerWeek}
                  onChange={(e) => setFrequencyPerWeek(Number(e.target.value))}
                  className="w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2"
                />
              </div>
              <div>
                <span className="mb-1 block text-xs text-ink-500">Minuten/Einheit</span>
                <input
                  type="number"
                  min={15}
                  max={240}
                  step={5}
                  value={sessionDurationMinutes}
                  onChange={(e) => setSessionDurationMinutes(Number(e.target.value))}
                  className="w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2"
                />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
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
            <textarea
              value={equipmentDetails}
              onChange={(event) => setEquipmentDetails(event.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Optional: konkrete Geräte, z. B. Kabelzug, Klimmzugstange…"
              className="mt-3 w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm"
            />
          </div>
        )}

        {step === 4 && (
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

        {step === 5 && (
          <div>
            <label className="mb-2 block text-sm text-ink-400">Welche Bereiche möchtest du priorisieren?</label>
            <textarea
              value={priorityMuscles}
              onChange={(event) => setPriorityMuscles(event.target.value)}
              rows={3}
              maxLength={500}
              placeholder="z. B. Rücken und Beinbeuger; Arme nur erhaltend…"
              className="w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm"
            />
          </div>
        )}

        {step === 6 && (
          <div className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-sm text-ink-400">Bevorzugte Übungen (optional)</label>
              <textarea
                value={preferredExercises}
                onChange={(event) => setPreferredExercises(event.target.value)}
                rows={2}
                maxLength={500}
                placeholder="z. B. Kniebeugen, Rudern…"
                className="w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-ink-400">Übungen, die du vermeiden möchtest</label>
              <textarea
                value={avoidedExercises}
                onChange={(event) => setAvoidedExercises(event.target.value)}
                rows={2}
                maxLength={500}
                placeholder="z. B. Dips, Ausfallschritte…"
                className="w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm"
              />
            </div>
          </div>
        )}

        {step === 7 && (
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

import { useState } from "react";
import type { ColdStartInput } from "@fitnesstracker/shared";
import { Button, Dialog, Field, Input, Textarea, cn } from "../ui";

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
    <Dialog
      open
      onOpenChange={(next) => !next && onCancel()}
      title="Ein paar Fragen zuerst"
      description={`Schritt ${step} von ${STEP_COUNT}`}
      footer={
        <>
          <Button variant="ghost" onClick={step === 1 ? onCancel : back}>
            {step === 1 ? "Abbrechen" : "Zurück"}
          </Button>
          {step < STEP_COUNT ? (
            <Button variant="primary" onClick={next}>
              Weiter
            </Button>
          ) : (
            <Button variant="primary" disabled={isSubmitting} onClick={handleFinish}>
              {isSubmitting ? "Generiert…" : "Plan generieren"}
            </Button>
          )}
        </>
      }
    >
      {step === 1 && (
        <Choices label="Was ist dein Hauptziel?" options={GOAL_OPTIONS} value={goal} onChange={setGoal} />
      )}

      {step === 2 && (
        <div className="flex flex-col gap-3">
          <p className="text-small font-medium text-text-muted">Wie oft und wie lange möchtest du trainieren?</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Einheiten/Woche">
              {(p) => (
                <Input {...p} type="number" min={1} max={7} inputMode="numeric" value={frequencyPerWeek} onChange={(e) => setFrequencyPerWeek(Number(e.target.value))} />
              )}
            </Field>
            <Field label="Minuten/Einheit">
              {(p) => (
                <Input {...p} type="number" min={15} max={240} step={5} inputMode="numeric" value={sessionDurationMinutes} onChange={(e) => setSessionDurationMinutes(Number(e.target.value))} />
              )}
            </Field>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-3">
          <Choices label="Welches Equipment hast du?" options={EQUIPMENT_OPTIONS} value={equipment} onChange={setEquipment} />
          <Textarea
            aria-label="Konkrete Geräte"
            value={equipmentDetails}
            onChange={(event) => setEquipmentDetails(event.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Optional: konkrete Geräte, z. B. Kabelzug, Klimmzugstange…"
          />
        </div>
      )}

      {step === 4 && (
        <Choices label="Wie ist dein Erfahrungsgrad?" options={EXPERIENCE_OPTIONS} value={experience} onChange={setExperience} />
      )}

      {step === 5 && (
        <Field label="Welche Bereiche möchtest du priorisieren?">
          {(p) => (
            <Textarea {...p} value={priorityMuscles} onChange={(event) => setPriorityMuscles(event.target.value)} rows={3} maxLength={500} placeholder="z. B. Rücken und Beinbeuger; Arme nur erhaltend…" />
          )}
        </Field>
      )}

      {step === 6 && (
        <div className="flex flex-col gap-3">
          <Field label="Bevorzugte Übungen (optional)">
            {(p) => (
              <Textarea {...p} value={preferredExercises} onChange={(event) => setPreferredExercises(event.target.value)} rows={2} maxLength={500} placeholder="z. B. Kniebeugen, Rudern…" />
            )}
          </Field>
          <Field label="Übungen, die du vermeiden möchtest">
            {(p) => (
              <Textarea {...p} value={avoidedExercises} onChange={(event) => setAvoidedExercises(event.target.value)} rows={2} maxLength={500} placeholder="z. B. Dips, Ausfallschritte…" />
            )}
          </Field>
        </div>
      )}

      {step === 7 && (
        <Field label="Körperliche Einschränkungen? (optional)">
          {(p) => (
            <Textarea {...p} value={limitations} onChange={(e) => setLimitations(e.target.value)} rows={3} placeholder="z. B. Knieprobleme, Rückenschmerzen…" />
          )}
        </Field>
      )}
    </Dialog>
  );
}

// Single-choice answer list (one tap = chosen).
function Choices<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-2">
      <p className="text-small font-medium text-text-muted">{label}</p>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "min-h-11 rounded-lg border px-3 py-2 text-left text-body transition-colors duration-150",
            value === opt.value
              ? "border-accent-border bg-accent-soft text-accent"
              : "border-border-strong text-text-muted hover:bg-surface-2",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

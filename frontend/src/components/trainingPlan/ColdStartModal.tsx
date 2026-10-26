import { useState } from "react";
import {
  DEFAULT_EQUIPMENT,
  EQUIPMENT_TAGS,
  type ColdStartInput,
  type EquipmentTag,
  type SplitPreference,
} from "@fitnesstracker/shared";
import { Check } from "lucide-react";
import { Button, Dialog, Field, Input, Textarea, Toggle, cn } from "../ui";

interface Props {
  onSubmit: (input: ColdStartInput) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  // Last saved answers; the wizard starts prefilled with them.
  initial?: ColdStartInput | null;
}

const EQUIPMENT_LABELS: Record<EquipmentTag, string> = {
  machine: "Geräte/Maschinen",
  dumbbell: "Kurzhanteln",
  barbell: "Langhantel (inkl. SZ-Stange)",
  cable: "Kabelturm",
  "body only": "Ohne Geräte (Körpergewicht)",
  kettlebells: "Kettlebells",
  bands: "Bänder",
  "medicine ball": "Medizinball",
  "exercise ball": "Gymnastikball",
  "foam roll": "Faszienrolle",
  other: "Sonstiges",
};

const SPLIT_OPTIONS: { value: SplitPreference | "custom"; label: string }[] = [
  { value: "auto", label: "Egal – passend zur Trainingshäufigkeit" },
  { value: "full_body", label: "Ganzkörper" },
  { value: "upper_lower", label: "Oberkörper / Unterkörper" },
  { value: "push_pull_legs", label: "Push / Pull / Beine" },
  { value: "bro_split", label: "Bro-Split (ein Muskel pro Tag, ideal ab 5×/Woche)" },
  { value: "custom", label: "Custom Split – eigene Trainingstage und Muskelgruppen" },
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

const STEP_COUNT = 9;

// A step-by-step wizard rather than one long form. It opens before every generation, because
// goals, available time, equipment and limitations can change even when history already exists.
export function ColdStartModal({ onSubmit, onCancel, isSubmitting, initial }: Props) {
  const [step, setStep] = useState(1);
  const [frequencyPerWeek, setFrequencyPerWeek] = useState(initial?.frequencyPerWeek ?? 3);
  const [split, setSplit] = useState<SplitPreference | "custom">(initial?.split ?? "auto");
  const [customSplit, setCustomSplit] = useState(initial?.customSplit ?? "Push: Brust, Schultern, Trizeps\nPull: Rücken, Bizeps\nBeine: Quadrizeps, Beinbeuger, Gesäß, Waden");
  const [equipment, setEquipment] = useState<EquipmentTag[]>(initial?.equipment ?? DEFAULT_EQUIPMENT);
  const [experience, setExperience] = useState<ColdStartInput["experience"]>(initial?.experience ?? "intermediate");
  const [goal, setGoal] = useState<ColdStartInput["goal"]>(initial?.goal ?? "muscle_gain");
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState(initial?.sessionDurationMinutes ?? 60);
  const [equipmentDetails, setEquipmentDetails] = useState(initial?.equipmentDetails ?? "");
  const [priorityMuscles, setPriorityMuscles] = useState(initial?.priorityMuscles ?? "");
  const [preferredExercises, setPreferredExercises] = useState(initial?.preferredExercises ?? "");
  const [avoidedExercises, setAvoidedExercises] = useState(initial?.avoidedExercises ?? "");
  const [limitations, setLimitations] = useState(initial?.limitations ?? "");
  const [includeCardio, setIncludeCardio] = useState(initial?.includeCardio ?? false);
  const [includeStretching, setIncludeStretching] = useState(initial?.includeStretching ?? false);

  const toggleEquipment = (tag: EquipmentTag) =>
    setEquipment((current) => (current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag]));
  const canContinue = step !== 4 || equipment.length > 0;

  const next = () => setStep((s) => Math.min(STEP_COUNT, s + 1));
  const back = () => setStep((s) => Math.max(1, s - 1));

  const handleFinish = () => {
    onSubmit({
      frequencyPerWeek,
      split,
      equipment,
      experience,
      goal,
      sessionDurationMinutes,
      equipmentDetails: equipmentDetails.trim() || undefined,
      priorityMuscles: priorityMuscles.trim() || undefined,
      preferredExercises: preferredExercises.trim() || undefined,
      avoidedExercises: avoidedExercises.trim() || undefined,
      limitations: limitations.trim() || undefined,
      includeCardio,
      includeStretching,
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
            <Button variant="primary" onClick={next} disabled={!canContinue}>
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
          <Choices label="Welchen Split bevorzugst du?" options={SPLIT_OPTIONS} value={split} onChange={setSplit} />
          {split === "custom" && (
            <Field label="Trainingstage und Muskelgruppen (eine Zeile pro Tag)">
              {(p) => <Textarea {...p} value={customSplit} onChange={(event) => setCustomSplit(event.target.value)} rows={5} maxLength={2000} placeholder={"Push: Brust, Schultern, Trizeps\nPull: Rücken, Bizeps\nBeine: Quadrizeps, Beinbeuger, Gesäß, Waden"} />}
            </Field>
          )}
          {split === "custom" && <p className="text-xs text-text-subtle">Format: Tagesname: Muskelgruppe 1, Muskelgruppe 2. Unterstützt deutsche und englische Muskelbezeichnungen.</p>}
        </div>
      )}

      {step === 4 && (
        <div className="flex flex-col gap-3">
          <p className="text-small font-medium text-text-muted">Mit welchen Mitteln sollen Übungen vorkommen?</p>
          <p className="text-xs text-text-subtle">Nicht angehakte Mittel werden komplett ausgeschlossen.</p>
          <div role="group" aria-label="Erlaubte Mittel" className="flex flex-col gap-1.5">
            {EQUIPMENT_TAGS.map((tag) => {
              const on = equipment.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleEquipment(tag)}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-left text-body transition-colors duration-150",
                    on ? "border-accent-border bg-accent-soft text-accent" : "border-border-strong text-text-muted hover:bg-surface-2",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                      on ? "border-accent bg-accent text-on-accent" : "border-border-strong",
                    )}
                  >
                    {on && <Check size={14} strokeWidth={3} />}
                  </span>
                  {EQUIPMENT_LABELS[tag]}
                </button>
              );
            })}
          </div>
          {equipment.length === 0 && <p className="text-xs text-danger-text">Mindestens ein Mittel auswählen.</p>}
          <Textarea
            aria-label="Konkrete Geräte"
            value={equipmentDetails}
            onChange={(event) => setEquipmentDetails(event.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Optional: konkrete Geräte, z. B. Beinpresse, Klimmzugstange…"
          />
        </div>
      )}

      {step === 5 && (
        <Choices label="Wie ist dein Erfahrungsgrad?" options={EXPERIENCE_OPTIONS} value={experience} onChange={setExperience} />
      )}

      {step === 6 && (
        <Field label="Welche Bereiche möchtest du priorisieren?">
          {(p) => (
            <Textarea {...p} value={priorityMuscles} onChange={(event) => setPriorityMuscles(event.target.value)} rows={3} maxLength={500} placeholder="z. B. Rücken und Beinbeuger; Arme nur erhaltend…" />
          )}
        </Field>
      )}

      {step === 7 && (
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

      {step === 8 && (
        <Field label="Körperliche Einschränkungen? (optional)">
          {(p) => (
            <Textarea {...p} value={limitations} onChange={(e) => setLimitations(e.target.value)} rows={3} placeholder="z. B. Knieprobleme, Rückenschmerzen…" />
          )}
        </Field>
      )}

      {step === 9 && (
        <div className="flex flex-col gap-3">
          <p className="text-small text-text-subtle">
            Beim Übernehmen des Plans werden Cardio und Dehnen passend zu den neuen Trainingstagen vorgeschlagen.
            Ohne Häkchen bleiben deine bisherigen Cardio- und Dehnpläne unverändert.
          </p>
          <Toggle label="Cardio mitplanen (nach Hauptziel, Aufwärmen und danach)" checked={includeCardio} onChange={setIncludeCardio} />
          <Toggle label="Dehnen mitplanen (eine Routine pro Trainingstag)" checked={includeStretching} onChange={setIncludeStretching} />
        </div>
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

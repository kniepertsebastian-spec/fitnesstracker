import { useState } from "react";
import { usePlanQuestions } from "../../hooks/useAiPlanGenerator";
import {
  DEFAULT_EQUIPMENT,
  EQUIPMENT_TAGS,
  PERIODIZATIONS,
  PERIODIZATION_INFO,
  SET_SCHEME_INFO,
  TECHNIQUES,
  TECHNIQUE_INFO,
  techniqueAllowedFor,
  type ColdStartInput,
  type EquipmentTag,
  type Periodization,
  type SplitPreference,
  type Technique,
} from "@fitnesstracker/shared";
import { TechniqueInfoButton } from "../training/TechniqueInfoButton";
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

// The last step shows the AI's follow-up questions to the answers of steps 1-9.
const STEP_COUNT = 11;
const TECHNIQUES_STEP = 10;
const QUESTIONS_STEP = 11;

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
  const [techniques, setTechniques] = useState<Technique[]>(initial?.techniques ?? []);
  const [schemes, setSchemes] = useState<Array<"PYRAMID" | "TIME_BASED">>(initial?.schemes ?? ["PYRAMID", "TIME_BASED"]);
  const [periodizations, setPeriodizations] = useState<Periodization[]>(initial?.periodizations ?? ["LINEAR", "WAVE"]);

  const questions = usePlanQuestions();
  const [answers, setAnswers] = useState<Record<number, string>>({});
  // Answers of steps 1-9 the shown questions were asked for; changed answers ask again.
  const [askedFor, setAskedFor] = useState<string | null>(null);

  const toggleEquipment = (tag: EquipmentTag) =>
    setEquipment((current) => (current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag]));
  const canContinue = step !== 4 || equipment.length > 0;

  const back = () => setStep((s) => Math.max(1, s - 1));

  const buildInput = (): ColdStartInput => ({
    frequencyPerWeek,
    split,
    customSplit: split === "custom" ? customSplit.trim() : undefined,
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
    techniques,
    schemes,
    periodizations,
  });

  const next = () => {
    const target = Math.min(STEP_COUNT, step + 1);
    if (target === QUESTIONS_STEP) {
      const input = buildInput();
      const key = JSON.stringify(input);
      if (key !== askedFor) {
        setAskedFor(key);
        setAnswers({});
        questions.mutate(input);
      }
    }
    setStep(target);
  };

  const handleFinish = () => {
    const asked = questions.data?.questions ?? [];
    const followUps = asked
      .map((q, i) => ({ question: q.question, answer: (answers[i] ?? "").trim() }))
      .filter((f) => f.answer.length > 0);
    onSubmit({ ...buildInput(), followUps: followUps.length > 0 ? followUps : undefined });
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
            <Button variant="primary" disabled={isSubmitting || questions.isPending} onClick={handleFinish}>
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
                    on ? "border-accent-border bg-accent-soft text-accent-text" : "border-border-strong text-text-muted hover:bg-surface-2",
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

      {step === TECHNIQUES_STEP && (
        <TechniqueChoices
          experience={experience}
          techniques={techniques}
          onTechniques={setTechniques}
          schemes={schemes}
          onSchemes={setSchemes}
          periodizations={periodizations}
          onPeriodizations={setPeriodizations}
        />
      )}

      {step === QUESTIONS_STEP && (
        <FollowUpQuestions
          loading={questions.isPending}
          failed={questions.isError}
          questions={questions.data?.questions ?? []}
          answers={answers}
          onAnswer={(index, value) => setAnswers((a) => ({ ...a, [index]: value }))}
        />
      )}
    </Dialog>
  );
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

interface TechniqueChoicesProps {
  experience: ColdStartInput["experience"];
  techniques: Technique[];
  onTechniques: (next: Technique[]) => void;
  schemes: Array<"PYRAMID" | "TIME_BASED">;
  onSchemes: (next: Array<"PYRAMID" | "TIME_BASED">) => void;
  periodizations: Periodization[];
  onPeriodizations: (next: Periodization[]) => void;
}

// What the AI may use besides straight sets. Nothing is chosen for the user; the AI then uses what
// was ticked sparingly (a few per training day at most) and only where it makes sense.
function TechniqueChoices({ experience, techniques, onTechniques, schemes, onSchemes, periodizations, onPeriodizations }: TechniqueChoicesProps) {
  const recommended = TECHNIQUES.filter((t) => techniqueAllowedFor(t, experience) && ["SUPERSET", "DROPSET", "NEGATIVES", "PRE_EXHAUST"].includes(t));
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-small font-medium text-text-muted">Intensitätstechniken</p>
        <p className="mt-1 text-small text-text-subtle">
          Was darf die KI einbauen? Sie setzt Techniken nur sparsam und nur dort ein, wo sie Sinn machen — nicht in
          jeder Übung. Ohne Häkchen gibt es normale Sätze. Mit (i) siehst du, was dahintersteckt.
        </p>
        <div className="mt-3 flex flex-col gap-1.5">
          {TECHNIQUES.map((t) => {
            const allowed = techniqueAllowedFor(t, experience);
            const checked = techniques.includes(t);
            return (
              <div key={t} className="flex items-center gap-1">
                <label
                  className={cn(
                    "flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2",
                    checked ? "border-accent-border bg-accent-soft" : "border-border-strong",
                    !allowed && "opacity-60",
                  )}
                >
                  <input type="checkbox" className="h-4 w-4 shrink-0 accent-accent" checked={checked} onChange={() => onTechniques(toggle(techniques, t))} />
                  <span className="min-w-0">
                    <span className="block text-body text-text">{TECHNIQUE_INFO[t].label}</span>
                    <span className="block text-xs text-text-subtle">
                      {TECHNIQUE_INFO[t].short}
                      {!allowed ? " · für dein Erfahrungslevel noch nicht vorgesehen" : ""}
                    </span>
                  </span>
                </label>
                <TechniqueInfoButton subject={{ kind: "technique", id: t }} />
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={() => onTechniques(recommended)}>
            Empfehlung für mein Level
          </Button>
          <Button size="sm" variant="ghost" disabled={techniques.length === 0} onClick={() => onTechniques([])}>
            Keine
          </Button>
        </div>
      </div>

      <div>
        <p className="text-small font-medium text-text-muted">Satzschemata</p>
        <p className="mt-1 text-small text-text-subtle">Die KI darf sich selbst dafür entscheiden. Gleichbleibende Sätze bleiben der Normalfall.</p>
        <div className="mt-3 flex flex-col gap-1.5">
          {(["PYRAMID", "TIME_BASED"] as const).map((s) => (
            <div key={s} className="flex items-center gap-1">
              <label className={cn("flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2", schemes.includes(s) ? "border-accent-border bg-accent-soft" : "border-border-strong")}>
                <input type="checkbox" className="h-4 w-4 shrink-0 accent-accent" checked={schemes.includes(s)} onChange={() => onSchemes(toggle(schemes, s))} />
                <span className="min-w-0">
                  <span className="block text-body text-text">{SET_SCHEME_INFO[s].label}</span>
                  <span className="block text-xs text-text-subtle">{SET_SCHEME_INFO[s].short}</span>
                </span>
              </label>
              <TechniqueInfoButton subject={{ kind: "scheme", id: s }} />
            </div>
          ))}
          {PERIODIZATIONS.map((p) => (
            <div key={p} className="flex items-center gap-1">
              <label className={cn("flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2", periodizations.includes(p) ? "border-accent-border bg-accent-soft" : "border-border-strong")}>
                <input type="checkbox" className="h-4 w-4 shrink-0 accent-accent" checked={periodizations.includes(p)} onChange={() => onPeriodizations(toggle(periodizations, p))} />
                <span className="min-w-0">
                  <span className="block text-body text-text">{PERIODIZATION_INFO[p].label}</span>
                  <span className="block text-xs text-text-subtle">{PERIODIZATION_INFO[p].short}</span>
                </span>
              </label>
              <TechniqueInfoButton subject={{ kind: "periodization", id: p }} />
            </div>
          ))}
        </div>
      </div>
    </div>
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
              ? "border-accent-border bg-accent-soft text-accent-text"
              : "border-border-strong text-text-muted hover:bg-surface-2",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

interface FollowUpProps {
  loading: boolean;
  failed: boolean;
  questions: { question: string; suggestions: string[] }[];
  answers: Record<number, string>;
  onAnswer: (index: number, value: string) => void;
}

// The AI's follow-up questions; every answer is optional, a tap on a suggestion fills it in.
function FollowUpQuestions({ loading, failed, questions, answers, onAnswer }: FollowUpProps) {
  if (loading) {
    return <p className="text-small text-text-subtle">Die KI schaut sich deine Antworten an und überlegt Rückfragen…</p>;
  }
  if (failed || questions.length === 0) {
    return (
      <p className="text-small text-text-subtle">
        Rückfragen sind gerade nicht verfügbar. Du kannst den Plan trotzdem direkt generieren.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="text-small text-text-subtle">
        Ein paar Rückfragen, damit der Plan genauer passt. Alles optional, leere Antworten werden übersprungen.
      </p>
      {questions.map((q, index) => (
        <div key={index} className="flex flex-col gap-2">
          <Field label={q.question}>
            {(p) => (
              <Input {...p} value={answers[index] ?? ""} onChange={(e) => onAnswer(index, e.target.value)} placeholder="Deine Antwort (optional)" />
            )}
          </Field>
          {q.suggestions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {q.suggestions.map((s) => {
                const active = (answers[index] ?? "") === s;
                return (
                  <Button key={s} size="sm" variant={active ? "selected" : "ghost"} aria-pressed={active} onClick={() => onAnswer(index, active ? "" : s)}>
                    {s}
                  </Button>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

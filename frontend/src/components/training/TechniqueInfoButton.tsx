import { useState } from "react";
import { Info } from "lucide-react";
import {
  PERIODIZATION_INFO,
  SET_SCHEME_INFO,
  TECHNIQUE_INFO,
  type Periodization,
  type SetScheme,
  type Technique,
} from "@fitnesstracker/shared";
import { Dialog, IconButton, cn } from "../ui";

export type TechniqueInfoSubject =
  | { kind: "technique"; id: Technique }
  | { kind: "scheme"; id: Exclude<SetScheme, "STRAIGHT"> }
  | { kind: "periodization"; id: Periodization };

interface Section {
  heading: string;
  text: string;
}

function content(subject: TechniqueInfoSubject): { title: string; sections: Section[]; note?: string } {
  if (subject.kind === "technique") {
    const i = TECHNIQUE_INFO[subject.id];
    return {
      title: i.label,
      sections: [
        { heading: "Was ist das?", text: i.what },
        { heading: "So geht’s", text: i.how },
        { heading: "Wofür sinnvoll", text: i.goodFor },
        { heading: "Wann besser nicht", text: i.avoid },
      ],
      note: i.note,
    };
  }
  if (subject.kind === "scheme") {
    const i = SET_SCHEME_INFO[subject.id];
    return {
      title: i.label,
      sections: [
        { heading: "Was ist das?", text: i.what },
        { heading: "So geht’s", text: i.how },
        { heading: "Wofür sinnvoll", text: i.goodFor },
        { heading: "Wann besser nicht", text: i.avoid },
      ],
    };
  }
  const i = PERIODIZATION_INFO[subject.id];
  return {
    title: i.label,
    sections: [
      { heading: "Was ist das?", text: i.what },
      { heading: "So geht’s", text: i.how },
    ],
  };
}

export function subjectLabel(subject: TechniqueInfoSubject): string {
  return content(subject).title;
}

// (i) next to a technique, set scheme or week pattern: explains what it is, how it is done, when it
// makes sense and when not. Used in the plan questionnaire, the draft preview and the focus mode.
export function TechniqueInfoButton({ subject, className }: { subject: TechniqueInfoSubject; className?: string }) {
  const [open, setOpen] = useState(false);
  const info = content(subject);
  return (
    <>
      <IconButton
        aria-label={`Info: ${info.title}`}
        title="Was ist das?"
        className={cn("border-transparent bg-transparent", className)}
        onClick={() => setOpen(true)}
      >
        <Info size={16} aria-hidden />
      </IconButton>
      <Dialog open={open} onOpenChange={setOpen} title={info.title}>
        <div className="flex flex-col gap-3">
          {info.sections.map((s) => (
            <div key={s.heading}>
              <p className="text-overline text-text-faint">{s.heading}</p>
              <p className="mt-0.5 text-small text-text-2">{s.text}</p>
            </div>
          ))}
          {info.note && (
            <p className="rounded-lg border border-border bg-surface-2 p-3 text-xs text-text-subtle">{info.note}</p>
          )}
          <p className="text-xs text-text-faint">
            Allgemeine Trainingsinformation, keine individuelle Beratung. Bei Beschwerden oder Vorerkrankungen vorher
            mit einer Fachperson sprechen.
          </p>
        </div>
      </Dialog>
    </>
  );
}

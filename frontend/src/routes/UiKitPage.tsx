import { useState } from "react";
import { Dumbbell, Flame, Inbox, MoreHorizontal, Trophy } from "lucide-react";
import {
  Badge,
  Button,
  ButtonLink,
  Callout,
  Card,
  CheckRow,
  Dialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  IconButton,
  ListRow,
  ProgressBar,
  SegmentedControl,
  SegmentedProgress,
  SetCheck,
  Sheet,
  Skeleton,
  StatTile,
  StatusPill,
  Stepper,
  Toast,
} from "../components/ui";
import type { BadgeTone, StatusPillTone } from "../components/ui";

const BADGE_TONES: BadgeTone[] = ["accent", "info", "warning", "danger", "violet", "neutral"];
const PILL_TONES: StatusPillTone[] = ["synced", "syncing", "pending", "offline", "failed"];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-overline uppercase text-text-subtle">{title}</h2>
      <div className="flex flex-wrap items-start gap-3">{children}</div>
    </section>
  );
}

/** Visual check page for `components/ui` — only routed in the dev build (see App.tsx). */
export function UiKitPage() {
  const [dialog, setDialog] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [range, setRange] = useState("3M");
  const [kg, setKg] = useState(62.5);
  const [reps, setReps] = useState(8);
  const [checked, setChecked] = useState(false);
  const [setState, setSetState] = useState<"open" | "current" | "done">("current");

  return (
    <div className="min-h-full bg-bg px-4 py-6 text-text lg:px-10">
      <h1 className="mb-6 text-h1 lg:text-h1-lg">Komponenten</h1>

      <Section title="Button">
        <Button variant="primary" size="lg" iconLeft={<Dumbbell size={18} />}>Training starten</Button>
        <Button variant="secondary">Sekundär</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="dashed">+ Satz</Button>
        <Button variant="danger">Löschen</Button>
        <Button variant="secondary" disabled>Deaktiviert</Button>
        <Button size="sm">Klein</Button>
        <ButtonLink to="/" variant="ghost">Als Link</ButtonLink>
        <IconButton aria-label="Mehr"><MoreHorizontal size={18} /></IconButton>
      </Section>

      <Section title="Badge">
        {BADGE_TONES.map((tone) => (
          <Badge key={tone} tone={tone}>{tone}</Badge>
        ))}
        <Badge tone="warning"><Flame size={12} aria-hidden /> 3 Wochen Serie</Badge>
      </Section>

      <Section title="StatusPill">
        {PILL_TONES.map((tone) => (
          <StatusPill key={tone} tone={tone}>{tone}</StatusPill>
        ))}
      </Section>

      <Section title="Card">
        <Card title="Karte" action={<Badge tone="accent">Aktion</Badge>} className="w-72">
          <p className="text-body text-text-muted">Inhalt der Karte.</p>
        </Card>
        <Card variant="hero" className="w-72">
          <p className="text-overline uppercase text-accent">Heute dran</p>
          <p className="mt-1 text-h2-hero">Tag A – Brust</p>
        </Card>
      </Section>

      <Section title="StatTile">
        <StatTile label="Volumen" value="12 480" unit="kg" sub="+8 % zur Vorwoche" subTone="accent" />
        <StatTile label="Körpergewicht" value="78,4" unit="kg" sub="−0,6 in 3 Monaten" />
      </Section>

      <Section title="Fortschritt">
        <div className="w-72 space-y-3">
          <ProgressBar value={65} label="Beispiel" />
          <ProgressBar value={30} size={8} tone="info" label="Beispiel" />
          <SegmentedProgress segments={8} done={3} label="Phase" />
          <SegmentedProgress segments={["done", "done", "current", "open"]} label="Übungen" />
        </div>
      </Section>

      <Section title="SegmentedControl / Stepper">
        <SegmentedControl
          label="Zeitraum"
          value={range}
          onChange={setRange}
          options={["4W", "3M", "6M", "1J", "Alles"].map((v) => ({ value: v, label: v }))}
        />
        <div className="w-44"><Stepper label="Gewicht" value={kg} onChange={setKg} step={2.5} unit="kg" /></div>
        <div className="w-44"><Stepper label="Wiederholungen" value={reps} onChange={setReps} /></div>
      </Section>

      <Section title="CheckRow / SetCheck">
        <div className="w-80 space-y-1">
          <CheckRow checked={checked} onClick={() => setChecked((v) => !v)} title="Dehnroutine" meta="8 Min." />
          <CheckRow checked title="Tages-Challenge" meta="3 von 3" />
        </div>
        <SetCheck state="open" aria-label="Offen" />
        <SetCheck
          state={setState}
          aria-label="Satz abhaken"
          onClick={() => setSetState((s) => (s === "done" ? "current" : "done"))}
        />
        <SetCheck state="done" aria-label="Erledigt" />
      </Section>

      <Section title="ListRow / EmptyState">
        <Card className="w-80">
          <ListRow prefix="1" value="4 × 6–8">Bankdrücken</ListRow>
          <ListRow prefix="2" value="3 × 10">Schrägbank</ListRow>
        </Card>
        <Card className="w-80">
          <EmptyState icon={<Inbox size={20} />} text="Noch kein Training." action={<Button variant="primary" size="sm">Starten</Button>} />
        </Card>
      </Section>

      <Section title="Callout / Toast">
        <div className="w-80 space-y-2">
          <Callout tone="info">Hinweis zur Phase.</Callout>
          <Callout tone="warning">Du bist offline.</Callout>
          <Callout tone="danger">Anmeldung fehlgeschlagen.</Callout>
        </div>
        <Toast icon={<Trophy size={20} />} overline="Neuer Rekord" className="w-80">Bankdrücken · 82,5 kg</Toast>
      </Section>

      <Section title="Dialog / Sheet / DropdownMenu / Skeleton">
        <Button onClick={() => setDialog(true)}>Dialog</Button>
        <Button onClick={() => setSheet(true)}>Sheet</Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton aria-label="Weitere Aktionen"><MoreHorizontal size={18} /></IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Exportieren</DropdownMenuItem>
            <DropdownMenuItem tone="danger">Löschen</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Skeleton className="h-10 w-48" />
      </Section>

      <Dialog
        open={dialog}
        onOpenChange={setDialog}
        title="Training beenden?"
        description="Alle Sätze bleiben gespeichert."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(false)}>Abbrechen</Button>
            <Button variant="primary" onClick={() => setDialog(false)}>Abschließen</Button>
          </>
        }
      >
        <p className="text-body text-text-muted">Dialoginhalt.</p>
      </Dialog>
      <Sheet open={sheet} onOpenChange={setSheet} title="Menü">
        <p className="p-4 text-body text-text-muted">Sheet-Inhalt.</p>
      </Sheet>
    </div>
  );
}

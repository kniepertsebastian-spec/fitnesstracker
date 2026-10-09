import { useEffect, useState } from "react";
import type { TrainingPlanDto } from "@fitnesstracker/shared";
import { useUpdateTrainingPlanRemarks } from "../../hooks/useTrainingPlan";
import { Button, Callout, Textarea } from "../ui";

// Remarks the next AI plan takes into account, plus asymmetries detected from the last 8 weeks.
// Rendered inside a Dialog on /plan ("Weitere Aktionen" → "Bemerkungen").
export function TrainingPlanRemarksCard({ plan, onSaved }: { plan: TrainingPlanDto; onSaved?: () => void }) {
  const updateRemarks = useUpdateTrainingPlanRemarks();
  const [remarks, setRemarks] = useState(plan.remarks ?? "");

  useEffect(() => setRemarks(plan.remarks ?? ""), [plan.remarks]);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-small text-text-subtle">
        Eigene Hinweise und erkannte Ungleichgewichte werden beim nächsten KI-Plan berücksichtigt.
      </p>

      {plan.detectedAsymmetries.length > 0 ? (
        <Callout tone="warning">
          <p className="font-medium text-text">Aus der Trainingshistorie erkannt</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {plan.detectedAsymmetries.map((remark) => (
              <li key={remark}>{remark}</li>
            ))}
          </ul>
        </Callout>
      ) : (
        <p className="text-small text-text-faint">Keine deutliche Asymmetrie in den letzten 8 Wochen erkannt.</p>
      )}

      <Textarea
        aria-label="Bemerkungen"
        value={remarks}
        onChange={(event) => setRemarks(event.target.value)}
        maxLength={2000}
        rows={4}
        placeholder="z. B. linke Schulter empfindlich, mehr Fokus auf Beinbeuger…"
      />
      <div className="flex justify-end">
        <Button
          variant="primary"
          disabled={updateRemarks.isPending || remarks.trim() === (plan.remarks ?? "")}
          onClick={() => updateRemarks.mutate({ remarks: remarks.trim() || null }, { onSuccess: onSaved })}
        >
          {updateRemarks.isPending ? "Speichert…" : "Speichern"}
        </Button>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import type { TrainingPlanDto } from "@fitnesstracker/shared";
import { useUpdateTrainingPlanRemarks } from "../../hooks/useTrainingPlan";

export function TrainingPlanRemarksCard({ plan }: { plan: TrainingPlanDto }) {
  const updateRemarks = useUpdateTrainingPlanRemarks();
  const [remarks, setRemarks] = useState(plan.remarks ?? "");

  useEffect(() => setRemarks(plan.remarks ?? ""), [plan.remarks]);

  return (
    <div className="rounded-lg border border-ink-800 bg-ink-900 p-4">
      <p className="text-sm font-medium text-ink-300">Bemerkungen</p>
      <p className="mt-1 text-xs text-ink-500">
        Eigene Hinweise und erkannte Ungleichgewichte werden beim nächsten KI-Plan berücksichtigt.
      </p>

      {plan.detectedAsymmetries.length > 0 ? (
        <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="text-xs font-medium text-amber-300">Aus der Trainingshistorie erkannt</p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-amber-100/80">
            {plan.detectedAsymmetries.map((remark) => <li key={remark}>{remark}</li>)}
          </ul>
        </div>
      ) : (
        <p className="mt-3 text-xs text-ink-600">Keine deutliche Asymmetrie in den letzten 8 Wochen erkannt.</p>
      )}

      <textarea
        value={remarks}
        onChange={(event) => setRemarks(event.target.value)}
        maxLength={2000}
        rows={3}
        placeholder="z. B. linke Schulter empfindlich, mehr Fokus auf Beinbeuger…"
        className="mt-3 w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm"
      />
      <button
        onClick={() => updateRemarks.mutate({ remarks: remarks.trim() || null })}
        disabled={updateRemarks.isPending || remarks.trim() === (plan.remarks ?? "")}
        className="mt-2 rounded-lg bg-ink-800 px-3 py-1.5 text-sm font-medium text-ink-200 hover:bg-ink-700 disabled:opacity-50"
      >
        {updateRemarks.isPending ? "Speichert…" : "Bemerkungen speichern"}
      </button>
    </div>
  );
}

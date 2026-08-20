import { useState } from "react";
import { ApiError } from "../../api/client";
import { BODY_METRIC_INFO, categorizeBodyFat } from "../../data/bodyMetricsInfo";
import {
  useBodyCompositionEntries,
  useCreateBodyCompositionEntry,
  useDeleteBodyCompositionEntry,
} from "../../hooks/useBodyComposition";
import { useProfile } from "../../hooks/useProfile";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function trendArrow(current: number, previous: number | null | undefined): string {
  if (previous === null || previous === undefined) return "";
  if (current > previous) return "↑";
  if (current < previous) return "↓";
  return "→";
}

export function BodyCompositionCard() {
  const { data: entries, isLoading } = useBodyCompositionEntries();
  const { data: profile } = useProfile();
  const createEntry = useCreateBodyCompositionEntry();
  const deleteEntry = useDeleteBodyCompositionEntry();

  const [weightKg, setWeightKg] = useState("");
  const [bodyFatPercent, setBodyFatPercent] = useState("");
  const [muscleMassKg, setMuscleMassKg] = useState("");
  const [bodyWaterPercent, setBodyWaterPercent] = useState("");
  const [error, setError] = useState<string | null>(null);

  const latest = entries?.[0];
  const previous = entries?.[1];

  const handleAdd = async () => {
    const weight = Number(weightKg);
    if (!weight || weight <= 0) {
      setError("Gewicht ist Pflicht.");
      return;
    }
    setError(null);
    try {
      await createEntry.mutateAsync({
        weightKg: weight,
        bodyFatPercent: bodyFatPercent ? Number(bodyFatPercent) : undefined,
        muscleMassKg: muscleMassKg ? Number(muscleMassKg) : undefined,
        bodyWaterPercent: bodyWaterPercent ? Number(bodyWaterPercent) : undefined,
      });
      setWeightKg("");
      setBodyFatPercent("");
      setMuscleMassKg("");
      setBodyWaterPercent("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Konnte nicht gespeichert werden.");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-ink-800 bg-ink-900 p-4">
        <p className="mb-2 text-sm font-medium text-ink-300">Neue Messung</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs text-ink-500">Gewicht (kg)</label>
            <input
              type="number"
              step="0.1"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              className="w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-ink-500">Körperfett (%)</label>
            <input
              type="number"
              step="0.1"
              value={bodyFatPercent}
              onChange={(e) => setBodyFatPercent(e.target.value)}
              className="w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-ink-500">Muskelmasse (kg)</label>
            <input
              type="number"
              step="0.1"
              value={muscleMassKg}
              onChange={(e) => setMuscleMassKg(e.target.value)}
              className="w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-ink-500">Wasseranteil (%)</label>
            <input
              type="number"
              step="0.1"
              value={bodyWaterPercent}
              onChange={(e) => setBodyWaterPercent(e.target.value)}
              className="w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-1.5 text-sm"
            />
          </div>
        </div>
        <button
          onClick={handleAdd}
          className="mt-3 w-full rounded-lg bg-violet-500 py-2 text-sm font-medium text-ink-950 hover:bg-violet-400"
        >
          Speichern
        </button>
        {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      </div>

      {isLoading ? (
        <p className="text-ink-500">Lädt…</p>
      ) : latest ? (
        <div className="rounded-lg border border-ink-800 bg-ink-900 p-4">
          <p className="mb-2 text-sm text-ink-500">Letzte Messung ({formatDate(latest.measuredAt)})</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-ink-500">{BODY_METRIC_INFO.weightKg.label}</p>
              <p className="text-lg font-semibold text-ink-100">
                {latest.weightKg} kg{" "}
                <span className="text-sm text-ink-500">{trendArrow(latest.weightKg, previous?.weightKg)}</span>
              </p>
            </div>
            {latest.bodyFatPercent !== null && (
              <div>
                <p className="text-ink-500">{BODY_METRIC_INFO.bodyFatPercent.label}</p>
                <p className="text-lg font-semibold text-violet-400">
                  {latest.bodyFatPercent}%{" "}
                  <span className="text-sm text-ink-500">
                    {trendArrow(latest.bodyFatPercent, previous?.bodyFatPercent)}
                  </span>
                </p>
                {categorizeBodyFat(latest.bodyFatPercent, profile?.gender) && (
                  <p className="text-xs text-ink-600">
                    {categorizeBodyFat(latest.bodyFatPercent, profile?.gender)}
                  </p>
                )}
              </div>
            )}
            {latest.muscleMassKg !== null && (
              <div>
                <p className="text-ink-500">{BODY_METRIC_INFO.muscleMassKg.label}</p>
                <p className="text-lg font-semibold text-ink-100">
                  {latest.muscleMassKg} kg{" "}
                  <span className="text-sm text-ink-500">
                    {trendArrow(latest.muscleMassKg, previous?.muscleMassKg)}
                  </span>
                </p>
              </div>
            )}
            {latest.bodyWaterPercent !== null && (
              <div>
                <p className="text-ink-500">{BODY_METRIC_INFO.bodyWaterPercent.label}</p>
                <p className="text-lg font-semibold text-ink-100">
                  {latest.bodyWaterPercent}%{" "}
                  <span className="text-sm text-ink-500">
                    {trendArrow(latest.bodyWaterPercent, previous?.bodyWaterPercent)}
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="text-ink-500">Noch keine Messung erfasst.</p>
      )}

      <div>
        <h2 className="mb-2 text-sm font-medium text-ink-400">Was bedeuten die Werte?</h2>
        <div className="flex flex-col gap-2">
          {Object.values(BODY_METRIC_INFO).map((info) => (
            <div key={info.label} className="rounded-lg border border-ink-800 bg-ink-900 p-3 text-sm">
              <p className="font-medium text-ink-200">{info.label}</p>
              <p className="text-ink-400">{info.description}</p>
            </div>
          ))}
        </div>
      </div>

      {entries && entries.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-medium text-ink-400">Verlauf</h2>
          <div className="flex flex-col gap-2">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-lg border border-ink-800 bg-ink-900 px-3 py-2 text-sm"
              >
                <div>
                  <p className="text-ink-300">{formatDate(entry.measuredAt)}</p>
                  <p className="text-xs text-ink-500">
                    {entry.weightKg} kg
                    {entry.bodyFatPercent !== null && ` · ${entry.bodyFatPercent}% KF`}
                    {entry.muscleMassKg !== null && ` · ${entry.muscleMassKg}kg Muskeln`}
                    {entry.bodyWaterPercent !== null && ` · ${entry.bodyWaterPercent}% Wasser`}
                  </p>
                </div>
                <button
                  onClick={() => deleteEntry.mutate(entry.id)}
                  className="text-xs text-red-400 hover:underline"
                >
                  Löschen
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

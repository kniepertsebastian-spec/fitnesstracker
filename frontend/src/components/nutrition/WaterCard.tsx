import { useState } from "react";
import { ApiError } from "../../api/client";
import { useAddWater, useSetWaterTarget, useWaterStatus } from "../../hooks/useWater";

const QUICK_ADD_ML = [100, 250, 500];

function formatDayLabel(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("de-DE", { weekday: "short" });
}

export function WaterCard() {
  const { data: status, isLoading } = useWaterStatus();
  const addWater = useAddWater();
  const setTarget = useSetWaterTarget();
  const [targetInput, setTargetInput] = useState("");
  const [targetError, setTargetError] = useState<string | null>(null);

  if (isLoading || !status) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <p className="text-sm text-slate-500">Wasser lädt…</p>
      </div>
    );
  }

  const progress = Math.min(status.today.amountMl / status.targetMl, 1);
  const orderedHistory = [...status.history].reverse();

  const handleSetTarget = async () => {
    setTargetError(null);
    const value = Number(targetInput);
    if (!value || value <= 0) return;
    try {
      await setTarget.mutateAsync(value);
      setTargetInput("");
    } catch (err) {
      setTargetError(err instanceof ApiError ? err.message : "Zielwert konnte nicht gesetzt werden.");
    }
  };

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      <p className="text-sm text-slate-500">Wasser heute</p>
      <p className="text-2xl font-semibold text-sky-400">
        {status.today.amountMl} <span className="text-base text-slate-500">/ {status.targetMl} ml</span>
      </p>
      {!status.isCustomTarget && (
        <p className="text-xs text-slate-600">Vorschlag basierend auf Profil bzw. Standardwert</p>
      )}

      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
        <div className="h-full rounded-full bg-sky-500" style={{ width: `${progress * 100}%` }} />
      </div>

      <div className="mt-3 flex gap-2">
        {QUICK_ADD_ML.map((ml) => (
          <button
            key={ml}
            onClick={() => addWater.mutate(ml)}
            className="flex-1 rounded-lg bg-slate-800 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-700"
          >
            +{ml} ml
          </button>
        ))}
        <button
          onClick={() => addWater.mutate(-250)}
          className="rounded-lg border border-slate-700 px-3 text-sm text-slate-400 hover:bg-slate-800"
        >
          -250
        </button>
      </div>

      <div className="mt-4 flex items-end justify-between gap-1">
        {orderedHistory.map((day) => {
          const dayProgress = Math.min(day.amountMl / status.targetMl, 1);
          return (
            <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-16 w-full items-end rounded bg-slate-800">
                <div className="w-full rounded bg-sky-600" style={{ height: `${dayProgress * 100}%` }} />
              </div>
              <span className="text-[10px] text-slate-600">{formatDayLabel(day.date)}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex gap-2">
        <input
          type="number"
          placeholder="Eigenes Ziel (ml)"
          value={targetInput}
          onChange={(e) => setTargetInput(e.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm"
        />
        <button
          onClick={handleSetTarget}
          className="rounded-lg border border-slate-700 px-3 text-sm text-slate-300 hover:bg-slate-800"
        >
          Setzen
        </button>
      </div>
      {targetError && <p className="mt-1 text-xs text-red-400">{targetError}</p>}
    </div>
  );
}

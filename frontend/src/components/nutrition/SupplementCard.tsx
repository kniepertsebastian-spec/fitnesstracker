import { useState } from "react";
import { ApiError } from "../../api/client";
import {
  useCreateSupplement,
  useDeleteSupplement,
  useSupplements,
  useUpdateSupplement,
} from "../../hooks/useSupplements";

export function SupplementCard() {
  const { data: supplements, isLoading } = useSupplements();
  const createSupplement = useCreateSupplement();
  const updateSupplement = useUpdateSupplement();
  const deleteSupplement = useDeleteSupplement();

  const [name, setName] = useState("");
  const [time, setTime] = useState("08:00");
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!name.trim()) return;
    setError(null);
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      await createSupplement.mutateAsync({ name: name.trim(), reminderTime: time, timeZone });
      setName("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Konnte nicht gespeichert werden.");
    }
  };

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      <p className="mb-1 text-sm font-medium text-slate-300">Supplement-Erinnerungen</p>
      <p className="mb-3 text-xs text-slate-500">
        Tägliche Push-Erinnerung zur eingestellten Uhrzeit — benötigt aktivierte
        Push-Benachrichtigungen (siehe Trainingsplan-Seite).
      </p>

      {isLoading ? (
        <p className="mb-3 text-sm text-slate-500">Lädt…</p>
      ) : supplements && supplements.length > 0 ? (
        <div className="mb-3 flex flex-col gap-2">
          {supplements.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-lg bg-slate-800 px-3 py-2 text-sm"
            >
              <div>
                <p className={s.enabled ? "text-slate-200" : "text-slate-500 line-through"}>{s.name}</p>
                <p className="text-xs text-slate-500">{s.reminderTime}</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => updateSupplement.mutate({ id: s.id, input: { enabled: !s.enabled } })}
                  className="text-xs text-violet-400 hover:underline"
                >
                  {s.enabled ? "Pausieren" : "Aktivieren"}
                </button>
                <button
                  onClick={() => deleteSupplement.mutate(s.id)}
                  className="text-xs text-red-400 hover:underline"
                >
                  Löschen
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mb-3 text-sm text-slate-600">Noch keine Supplements hinterlegt.</p>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Name (z. B. Kreatin)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm"
        />
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
        />
        <button
          onClick={handleAdd}
          className="shrink-0 rounded-lg border border-slate-700 px-3 text-sm text-slate-300 hover:bg-slate-800"
        >
          +
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}

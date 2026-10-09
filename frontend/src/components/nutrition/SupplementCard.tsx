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
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="mb-1 text-sm font-medium text-text-muted">Supplement-Erinnerungen</p>
      <p className="mb-3 text-xs text-text-faint">
        Tägliche Push-Erinnerung zur eingestellten Uhrzeit — benötigt aktivierte
        Push-Benachrichtigungen (siehe Trainingsplan-Seite).
      </p>

      {isLoading ? (
        <p className="mb-3 text-sm text-text-faint">Lädt…</p>
      ) : supplements && supplements.length > 0 ? (
        <div className="mb-3 flex flex-col gap-2">
          {supplements.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm"
            >
              <div>
                <p className={s.enabled ? "text-text-2" : "text-text-faint line-through"}>{s.name}</p>
                <p className="text-xs text-text-faint">{s.reminderTime}</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => updateSupplement.mutate({ id: s.id, input: { enabled: !s.enabled } })}
                  className="text-xs text-accent hover:underline"
                >
                  {s.enabled ? "Pausieren" : "Aktivieren"}
                </button>
                <button
                  onClick={() => deleteSupplement.mutate(s.id)}
                  className="text-xs text-danger-text hover:underline"
                >
                  Löschen
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mb-3 text-sm text-text-faint">Noch keine Supplements hinterlegt.</p>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Name (z. B. Kreatin)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-border-strong bg-bg px-3 py-1.5 text-sm"
        />
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="rounded-lg border border-border-strong bg-bg px-2 py-1.5 text-sm"
        />
        <button
          onClick={handleAdd}
          className="shrink-0 rounded-lg border border-border-strong px-3 text-sm text-text-muted hover:bg-surface-2"
        >
          +
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-danger-text">{error}</p>}
    </div>
  );
}

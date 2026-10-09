import { useState } from "react";
import { ApiError } from "../../api/client";
import {
  useCreateSupplement,
  useDeleteSupplement,
  useSupplements,
  useUpdateSupplement,
} from "../../hooks/useSupplements";
import { Pill, Plus, Trash2 } from "lucide-react";
import { Button, Callout, Card, EmptyState, IconButton, Input, ListRow, Skeleton } from "../ui";

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
    <Card title="Supplement-Erinnerungen" className="lg:max-w-xl">
      <p className="mb-3 text-small text-text-subtle">
        Tägliche Push-Erinnerung zur eingestellten Uhrzeit — benötigt aktivierte Benachrichtigungen (siehe
        Einstellungen).
      </p>

      {isLoading ? (
        <Skeleton className="mb-3 h-16 w-full" />
      ) : supplements && supplements.length > 0 ? (
        <div className="mb-3">
          {supplements.map((s) => (
            <ListRow key={s.id}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className={s.enabled ? "text-body text-text-2" : "text-body text-text-faint line-through"}>{s.name}</p>
                  <p className="tabular font-mono text-xs text-text-faint">{s.reminderTime}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => updateSupplement.mutate({ id: s.id, input: { enabled: !s.enabled } })}
                  >
                    {s.enabled ? "Pausieren" : "Aktivieren"}
                  </Button>
                  <IconButton
                    aria-label={`${s.name} löschen`}
                    className="border-transparent bg-transparent hover:text-danger-text"
                    onClick={() => deleteSupplement.mutate(s.id)}
                  >
                    <Trash2 size={16} aria-hidden />
                  </IconButton>
                </div>
              </div>
            </ListRow>
          ))}
        </div>
      ) : (
        <EmptyState icon={<Pill size={18} aria-hidden />} text="Noch keine Supplements hinterlegt." className="py-4" />
      )}

      <div className="flex gap-2">
        <Input
          aria-label="Name des Supplements"
          placeholder="Name (z. B. Kreatin)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-w-0 flex-1"
        />
        <Input aria-label="Uhrzeit der Erinnerung" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-28" />
        <IconButton aria-label="Supplement hinzufügen" onClick={handleAdd}>
          <Plus size={18} aria-hidden />
        </IconButton>
      </div>
      {error && (
        <Callout tone="danger" className="mt-3">
          {error}
        </Callout>
      )}
    </Card>
  );
}

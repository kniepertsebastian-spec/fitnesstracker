import { Clock, Pencil, Trash2 } from "lucide-react";
import type { LocalWorkoutLog } from "../../offline/db";
import { useDeleteWorkoutLog } from "../../hooks/useWorkoutLogs";
import { estimateOneRepMax } from "../../lib/oneRepMax";
import { formatKg } from "../../lib/trainingSets";
import { EmptyState, IconButton, ListRow } from "../ui";
import { Dumbbell } from "lucide-react";

interface Props {
  logs: LocalWorkoutLog[];
  onEdit: (log: LocalWorkoutLog) => void;
}

// Deterministic per groupId so the same superset always renders the same color within one list,
// without tracking color assignment anywhere.
const SUPERSET_COLORS = ["border-l-accent", "border-l-warning", "border-l-info", "border-l-danger"];

function supersetColor(groupId: string): string {
  let hash = 0;
  for (let i = 0; i < groupId.length; i++) hash = (hash * 31 + groupId.charCodeAt(i)) >>> 0;
  return SUPERSET_COLORS[hash % SUPERSET_COLORS.length];
}

// Today's logged sets as list rows. RIR and the 1RM estimate fold into the subtitle line so the
// row stays readable at 390 px.
export function WorkoutLogTable({ logs, onEdit }: Props) {
  const deleteLog = useDeleteWorkoutLog();

  if (logs.length === 0) {
    return <EmptyState icon={<Dumbbell size={18} aria-hidden />} text="Heute noch keine Sätze protokolliert." />;
  }

  return (
    <div>
      {logs.map((log) => {
        const oneRepMax = estimateOneRepMax(log.weightKg, log.reps);
        const subtitle = [
          log.rir !== null ? `RIR ${log.rir}` : null,
          oneRepMax ? `≈ 1RM ${Math.round(oneRepMax)} kg` : null,
        ]
          .filter(Boolean)
          .join(" · ");

        return (
          <div
            key={log.clientId}
            data-testid="today-set"
            className={log.supersetGroupId ? `border-l-2 pl-3 ${supersetColor(log.supersetGroupId)}` : undefined}
          >
            <ListRow
              prefix={log.setNumber}
              value={`${log.reps} × ${formatKg(log.weightKg)} kg`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate text-body">
                    {log.exerciseName}
                    {log.id === null && (
                      <Clock size={14} aria-label="Noch nicht synchronisiert" className="shrink-0 text-warning" />
                    )}
                  </p>
                  {subtitle && <p className="truncate text-xs text-text-faint">{subtitle}</p>}
                </div>
                <span className="flex shrink-0">
                  <IconButton
                    aria-label={`${log.exerciseName} Satz ${log.setNumber} bearbeiten`}
                    className="h-9 w-9 border-transparent bg-transparent"
                    onClick={() => onEdit(log)}
                  >
                    <Pencil size={16} aria-hidden />
                  </IconButton>
                  <IconButton
                    aria-label={`${log.exerciseName} Satz ${log.setNumber} löschen`}
                    className="h-9 w-9 border-transparent bg-transparent hover:text-danger-text"
                    onClick={() => deleteLog.mutate(log.clientId)}
                  >
                    <Trash2 size={16} aria-hidden />
                  </IconButton>
                </span>
              </div>
            </ListRow>
          </div>
        );
      })}
    </div>
  );
}

import type { LocalWorkoutLog } from "../../offline/db";
import { useDeleteWorkoutLog } from "../../hooks/useWorkoutLogs";
import { estimateOneRepMax } from "../../lib/oneRepMax";

interface Props {
  logs: LocalWorkoutLog[];
  onEdit: (log: LocalWorkoutLog) => void;
}

// Small fixed palette (not the primary violet accent, so a superset tag doesn't compete with
// buttons/links) — deterministic per groupId so the same group always renders the same color
// within one table, without needing to track color assignment anywhere.
const SUPERSET_COLORS = ["border-l-emerald-500", "border-l-amber-500", "border-l-sky-500", "border-l-rose-500"];

function supersetColor(groupId: string): string {
  let hash = 0;
  for (let i = 0; i < groupId.length; i++) hash = (hash * 31 + groupId.charCodeAt(i)) >>> 0;
  return SUPERSET_COLORS[hash % SUPERSET_COLORS.length];
}

export function WorkoutLogTable({ logs, onEdit }: Props) {
  const deleteLog = useDeleteWorkoutLog();

  if (logs.length === 0) {
    return <p className="py-8 text-center text-ink-500">Noch keine Sätze protokolliert.</p>;
  }

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-ink-800 text-left text-ink-400">
          <th className="py-2 pr-2">Übung</th>
          <th className="py-2 pr-2">Satz</th>
          <th className="py-2 pr-2">Wdh.</th>
          <th className="py-2 pr-2">kg</th>
          <th className="py-2"></th>
        </tr>
      </thead>
      <tbody>
        {logs.map((log) => {
          const oneRepMax = estimateOneRepMax(log.weightKg, log.reps);
          // RIR and the 1RM estimate fold into a subtitle line under the exercise name instead
          // of their own columns — two more columns pushed the table past 375px width (verified
          // via a real horizontal-overflow check), which this app's mobile layout deliberately
          // avoids (wrap/vertical-scroll only, see ARCHITECTURE.md).
          const subtitleParts = [
            log.rir !== null ? `RIR ${log.rir}` : null,
            oneRepMax ? `≈1RM ${Math.round(oneRepMax)}kg` : null,
          ].filter(Boolean);

          return (
            <tr
              key={log.clientId}
              className={`border-b border-ink-900 ${
                log.supersetGroupId ? `border-l-2 ${supersetColor(log.supersetGroupId)}` : ""
              }`}
            >
              <td className="py-2 pr-2 pl-2">
                <p>
                  {log.exerciseName}
                  {log.id === null && (
                    <span className="ml-1 text-xs text-amber-500" title="Noch nicht synchronisiert">
                      ⏳
                    </span>
                  )}
                </p>
                {subtitleParts.length > 0 && (
                  <p className="text-xs text-ink-500">{subtitleParts.join(" · ")}</p>
                )}
              </td>
              <td className="py-2 pr-2">{log.setNumber}</td>
              <td className="py-2 pr-2">{log.reps}</td>
              <td className="py-2 pr-2">{log.weightKg}</td>
              <td className="py-2">
                <div className="flex justify-end gap-3">
                  <button onClick={() => onEdit(log)} className="text-violet-400 hover:underline">
                    Bearbeiten
                  </button>
                  <button
                    onClick={() => deleteLog.mutate(log.clientId)}
                    className="text-red-400 hover:underline"
                  >
                    Löschen
                  </button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

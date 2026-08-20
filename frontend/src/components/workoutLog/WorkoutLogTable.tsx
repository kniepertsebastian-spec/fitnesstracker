import type { LocalWorkoutLog } from "../../offline/db";
import { useDeleteWorkoutLog } from "../../hooks/useWorkoutLogs";

interface Props {
  logs: LocalWorkoutLog[];
  onEdit: (log: LocalWorkoutLog) => void;
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
        {logs.map((log) => (
          <tr key={log.clientId} className="border-b border-ink-900">
            <td className="py-2 pr-2">
              {log.exerciseName}
              {log.id === null && (
                <span className="ml-1 text-xs text-amber-500" title="Noch nicht synchronisiert">
                  ⏳
                </span>
              )}
            </td>
            <td className="py-2 pr-2">{log.setNumber}</td>
            <td className="py-2 pr-2">{log.reps}</td>
            <td className="py-2 pr-2">{log.weightKg}</td>
            <td className="flex justify-end gap-3 py-2">
              <button onClick={() => onEdit(log)} className="text-violet-400 hover:underline">
                Bearbeiten
              </button>
              <button
                onClick={() => deleteLog.mutate(log.clientId)}
                className="text-red-400 hover:underline"
              >
                Löschen
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

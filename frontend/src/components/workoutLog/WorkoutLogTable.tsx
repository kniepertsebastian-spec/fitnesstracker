import type { WorkoutLogDto } from "@fitnesstracker/shared";
import { useDeleteWorkoutLog } from "../../hooks/useWorkoutLogs";

interface Props {
  logs: WorkoutLogDto[];
  onEdit: (log: WorkoutLogDto) => void;
}

export function WorkoutLogTable({ logs, onEdit }: Props) {
  const deleteLog = useDeleteWorkoutLog();

  if (logs.length === 0) {
    return <p className="py-8 text-center text-slate-500">Noch keine Sätze protokolliert.</p>;
  }

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-slate-800 text-left text-slate-400">
          <th className="py-2 pr-2">Übung</th>
          <th className="py-2 pr-2">Satz</th>
          <th className="py-2 pr-2">Wdh.</th>
          <th className="py-2 pr-2">kg</th>
          <th className="py-2"></th>
        </tr>
      </thead>
      <tbody>
        {logs.map((log) => (
          <tr key={log.id} className="border-b border-slate-900">
            <td className="py-2 pr-2">{log.exerciseName}</td>
            <td className="py-2 pr-2">{log.setNumber}</td>
            <td className="py-2 pr-2">{log.reps}</td>
            <td className="py-2 pr-2">{log.weightKg}</td>
            <td className="flex justify-end gap-3 py-2">
              <button onClick={() => onEdit(log)} className="text-sky-400 hover:underline">
                Bearbeiten
              </button>
              <button
                onClick={() => deleteLog.mutate(log.id)}
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

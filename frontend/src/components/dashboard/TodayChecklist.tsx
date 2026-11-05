import { useNavigate } from "react-router-dom";
import { Card, CheckRow } from "../ui";

export interface ChecklistRow {
  key: string;
  title: string;
  meta?: string;
  done: boolean;
  to: string;
}

// Where something gets ticked off is where it happens (diary/training, Daily, Nutrition) — the
// dashboard only mirrors the state and links there, it is never a second source of truth.
export function TodayChecklist({ rows }: { rows: ChecklistRow[] }) {
  const navigate = useNavigate();
  const doneCount = rows.filter((r) => r.done).length;

  return (
    <Card
      title="Heute"
      action={
        <span className="tabular text-small text-text-subtle">
          {doneCount} von {rows.length} erledigt
        </span>
      }
    >
      <div className="flex flex-col gap-1">
        {rows.map((row) => (
          <CheckRow
            key={row.key}
            checked={row.done}
            title={row.title}
            meta={row.meta}
            onClick={() => navigate(row.to)}
          />
        ))}
      </div>
    </Card>
  );
}

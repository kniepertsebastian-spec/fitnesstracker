import Dexie, { type Table } from "dexie";
import type { WorkoutLogDto } from "@fitnesstracker/shared";

// `id` is null until the row's create mutation has synced and the server assigned a real id —
// a set logged offline is fully usable (editable, deletable) before that happens, so the app
// can never require a server id to exist. `clientId` is the one stable identity throughout.
export type LocalWorkoutLog = Omit<WorkoutLogDto, "id"> & { id: string | null };

export type MutationOp = "create" | "update" | "delete";

export interface PendingMutation {
  id?: number;
  clientId: string;
  op: MutationOp;
  payload: Record<string, unknown>;
  queuedAt: string;
}

class OfflineDb extends Dexie {
  workoutLogs!: Table<LocalWorkoutLog, string>;
  pendingMutations!: Table<PendingMutation, number>;

  constructor() {
    super("fitnesstracker-offline");
    this.version(1).stores({
      workoutLogs: "clientId, performedAt",
      pendingMutations: "++id, clientId, queuedAt",
    });
  }
}

export const offlineDb = new OfflineDb();

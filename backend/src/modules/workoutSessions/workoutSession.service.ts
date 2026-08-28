import type { PrismaClient } from "@prisma/client";
import type { CreateWorkoutSessionInput, WorkoutSessionStatus } from "@fitnesstracker/shared";
import { NotFoundError } from "../../errors/httpErrors.js";

const TERMINAL_STATUSES: WorkoutSessionStatus[] = ["COMPLETED", "ABORTED"];

// At most one session is ever "open" (ACTIVE or PAUSED) per user in normal use — the frontend
// only offers "Start" when it has none locally. `orderBy updatedAt desc` is just a safety net in
// case that invariant is ever violated (e.g. two devices racing), so the client always gets a
// single, most-recently-touched session back rather than an ambiguous list.
export function getOpenWorkoutSession(prisma: PrismaClient, userId: string) {
  return prisma.workoutSession.findFirst({
    where: { userId, status: { in: ["ACTIVE", "PAUSED"] } },
    orderBy: { updatedAt: "desc" },
  });
}

// Idempotent by clientId, same pattern as createWorkoutLog: a retried "Start" (flaky connection,
// or the offline sync queue replaying) returns the existing session instead of creating a
// second one.
//
// Datenkonflikte (roadmap2.md P0.5): two devices can each start a session offline, unaware of
// each other — both queue a "create" with their own clientId, and both eventually sync. Without
// reconciliation that leaves two simultaneously "open" (ACTIVE/PAUSED) sessions server-side,
// silently violating the "at most one open session" invariant the rest of the app assumes.
// Policy: most-recent-action-wins, consistent with how a concurrent edit/delete on the same
// WorkoutLog row already resolves (whichever mutation reaches the server last stands) — creating
// a new session closes out any other session still open for that user.
export async function createWorkoutSession(
  prisma: PrismaClient,
  userId: string,
  input: CreateWorkoutSessionInput,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.workoutSession.findUnique({ where: { clientId: input.clientId } });
    if (existing) {
      // A retried create of the same session (idempotency), not a new one — nothing to reconcile.
      return existing;
    }
    await tx.workoutSession.updateMany({
      where: { userId, status: { in: ["ACTIVE", "PAUSED"] } },
      data: { status: "ABORTED", endedAt: new Date() },
    });
    return tx.workoutSession.create({ data: { clientId: input.clientId, userId } });
  });
}

async function findOwnedWorkoutSession(prisma: PrismaClient, userId: string, idOrClientId: string) {
  const existing = await prisma.workoutSession.findFirst({
    where: { userId, OR: [{ id: idOrClientId }, { clientId: idOrClientId }] },
  });
  if (!existing) {
    throw new NotFoundError("Workout session not found");
  }
  return existing;
}

// A terminal status is final: once one device completes/aborts a session, a stale offline status
// change from another device (which never saw that happen) should never resurrect or overwrite
// it — e.g. a queued "Pause" from a device that was offline when the session got completed
// elsewhere. Treated as a benign no-op (the session's fate is already settled, nothing to
// reconcile) rather than a conflict that would need surfacing as a "fehlgeschlagen" mutation.
export async function updateWorkoutSessionStatus(
  prisma: PrismaClient,
  userId: string,
  idOrClientId: string,
  status: WorkoutSessionStatus,
) {
  const existing = await findOwnedWorkoutSession(prisma, userId, idOrClientId);
  if (TERMINAL_STATUSES.includes(existing.status)) {
    return existing;
  }
  return prisma.workoutSession.update({
    where: { id: existing.id },
    data: {
      status,
      endedAt: TERMINAL_STATUSES.includes(status) ? new Date() : existing.endedAt,
    },
  });
}

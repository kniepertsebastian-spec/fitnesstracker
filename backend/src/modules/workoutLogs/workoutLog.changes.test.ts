import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { listWorkoutLogChanges } from "./workoutLog.service.js";

describe("listWorkoutLogChanges", () => {
  it("splits changed rows into upserts and tombstones, scoped to the user and the moment", async () => {
    const since = new Date("2026-10-20T10:00:00Z");
    const rows = [
      { id: "1", clientId: "live-a", deletedAt: null },
      { id: "2", clientId: "gone-b", deletedAt: new Date("2026-10-20T10:05:00Z") },
      { id: "3", clientId: "live-c", deletedAt: null },
    ];
    const findMany = vi.fn().mockResolvedValue(rows);
    const prisma = { workoutLog: { findMany } } as unknown as PrismaClient;

    const changes = await listWorkoutLogChanges(prisma, "user-1", since);

    expect(changes.items.map((r) => r.clientId)).toEqual(["live-a", "live-c"]);
    expect(changes.deletedClientIds).toEqual(["gone-b"]);
    // Soft-deleted rows must be included (no `deletedAt: null` filter), strictly after `since`.
    expect(findMany.mock.calls[0][0].where).toEqual({ userId: "user-1", updatedAt: { gt: since } });
  });
});

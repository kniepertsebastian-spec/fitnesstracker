import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UNDO_WINDOW_MS, useUndoStore } from "./undoStore";

describe("undoStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("hides the record at once and deletes it only after the undo window", async () => {
    const commit = vi.fn().mockResolvedValue(undefined);
    useUndoStore.getState().scheduleDelete("a", "Übung gelöscht", commit);
    expect(useUndoStore.getState().pendingIds.has("a")).toBe(true);
    expect(useUndoStore.getState().toasts).toHaveLength(1);

    vi.advanceTimersByTime(UNDO_WINDOW_MS - 1);
    expect(commit).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(useUndoStore.getState().toasts).toHaveLength(0);
    expect(useUndoStore.getState().pendingIds.has("a")).toBe(false);
  });

  it("undo brings the record back and never calls the server", async () => {
    const commit = vi.fn().mockResolvedValue(undefined);
    useUndoStore.getState().scheduleDelete("b", "Übung gelöscht", commit);
    useUndoStore.getState().undo("b");
    expect(useUndoStore.getState().pendingIds.has("b")).toBe(false);
    expect(useUndoStore.getState().toasts).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS * 2);
    expect(commit).not.toHaveBeenCalled();
  });

  it("shows the record again when the delete fails", async () => {
    const commit = vi.fn().mockRejectedValue(new Error("offline"));
    useUndoStore.getState().scheduleDelete("c", "Übung gelöscht", commit);
    await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS);
    expect(commit).toHaveBeenCalled();
    expect(useUndoStore.getState().pendingIds.has("c")).toBe(false);
  });
});

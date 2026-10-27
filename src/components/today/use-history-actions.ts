"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAppState } from "@/components/app/app-context";
import { showUndoToast, toast } from "@/components/ui/toast";
import { makeBatchId } from "@/lib/change-log";
import { changeIdOfBatch, type MemoryAction } from "@/lib/memory/app-actions";
import { checkRedo, checkUndo } from "@/lib/memory/app-history";

type BatchedAction = Extract<MemoryAction, { batchId?: string }>;

/**
 * Edits, Undo and "Bring back" for Today and History. Every result shows as a
 * toast next to where the user is looking (a reason when a change can't be
 * reversed, never a silent no-op), and every edit can be undone from it.
 */
export function useHistoryActions() {
  const { state, dispatch, sync } = useAppState();
  // Toast buttons run later, so they read the newest state, not this render's.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const redo = useCallback(
    (changeId: string, label: string) => {
      const check = checkRedo(stateRef.current, changeId);
      if (!check.ok) {
        toast.add({ title: "Can’t bring it back", description: check.reason });
        return;
      }
      dispatch({ type: "redo-change", changeId });
      toast.add({ title: `Brought back: ${label}` });
    },
    [dispatch],
  );

  const undo = useCallback(
    (changeId: string, label: string) => {
      const check = checkUndo(stateRef.current, changeId);
      if (!check.ok) {
        toast.add({ title: "Can’t undo", description: check.reason });
        return;
      }
      dispatch({ type: "undo-change", changeId });
      const id = toast.add({
        title: `Undone: ${label}`,
        description: "It’s hidden, not deleted.",
        actionProps: {
          children: "Bring back",
          onClick: () => {
            toast.close(id);
            redo(changeId, label);
          },
        },
      });
    },
    [dispatch, redo],
  );

  /** Run an edit and offer Undo for it. */
  const act = useCallback(
    (action: BatchedAction, title: string) => {
      const batchId = makeBatchId();
      dispatch({ ...action, batchId });
      showUndoToast({
        title,
        onUndo: () => {
          const changeId = changeIdOfBatch(stateRef.current, batchId);
          if (changeId) undo(changeId, title);
        },
      });
    },
    [dispatch, undo],
  );

  return { act, undo, redo, isReadOnly: sync.isReadOnly };
}

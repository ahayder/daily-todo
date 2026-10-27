"use client";

import { useCallback, useState } from "react";
import { useAppState } from "@/components/app/app-context";
import { checkRedo, checkUndo } from "@/lib/memory/app-history";

/**
 * Undo / "Bring back" for History and Today. Checks first so the user gets a
 * plain reason when a change can't be reversed, instead of a silent no-op.
 */
export function useHistoryActions() {
  const { state, dispatch, sync } = useAppState();
  const [message, setMessage] = useState("");

  const undo = useCallback(
    (changeId: string) => {
      const check = checkUndo(state, changeId);
      if (!check.ok) {
        setMessage(`Can’t undo: ${check.reason}`);
        return;
      }
      dispatch({ type: "undo-change", changeId });
      setMessage("Undone. It’s hidden, not deleted — you can bring it back.");
    },
    [dispatch, state],
  );

  const redo = useCallback(
    (changeId: string) => {
      const check = checkRedo(state, changeId);
      if (!check.ok) {
        setMessage(`Can’t bring it back: ${check.reason}`);
        return;
      }
      dispatch({ type: "redo-change", changeId });
      setMessage("Brought back.");
    },
    [dispatch, state],
  );

  return { undo, redo, message, isReadOnly: sync.isReadOnly };
}

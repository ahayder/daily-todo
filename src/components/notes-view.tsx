"use client";

import { DrawingOverlay } from "@/components/drawing-overlay";
import { MarkdownEditor } from "@/components/markdown-editor";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { AppState } from "@/lib/types";
import type { AppAction } from "@/components/app-context";
import type { Dispatch } from "react";

type Props = {
  state: AppState;
  dispatch: Dispatch<AppAction>;
};

export function NotesView({ state, dispatch }: Props) {
  const noteId = state.uiState.selectedNoteId;
  const note = noteId ? state.notesDocs[noteId] : null;

  if (!note || !noteId) {
    return <section className="empty-view">No note selected.</section>;
  }

  return (
    <section className="notes-layout">
      <div className="notes-header">
        <input
          aria-label="Note title"
          className="note-title-input"
          value={note.title}
          onChange={(event) =>
            dispatch({ type: "rename-note", noteId, title: event.target.value })
          }
        />
        <button type="button" onClick={() => dispatch({ type: "create-note" })}>
          New
        </button>
        <AlertDialog>
          <AlertDialogTrigger render={<button type="button">Delete</button>} />
          <AlertDialogContent className="note-delete-dialog">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this note?</AlertDialogTitle>
              <AlertDialogDescription>
                This action permanently removes the note and its drawing data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="note-delete-confirm"
                onClick={() => dispatch({ type: "delete-note", noteId })}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="editor-layer dotted-grid">
        <MarkdownEditor
          value={note.markdown}
          onChange={(markdown) => dispatch({ type: "update-note-markdown", noteId, markdown })}
        />
        <DrawingOverlay
          strokes={note.drawingStrokes}
          onChange={(drawingStrokes) => dispatch({ type: "set-note-drawing", noteId, drawingStrokes })}
        />
      </div>
    </section>
  );
}

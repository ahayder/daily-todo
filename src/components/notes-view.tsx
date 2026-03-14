"use client";

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
import { Trash2, FileText } from "lucide-react";
import type { Dispatch } from "react";

type Props = {
  state: AppState;
  dispatch: Dispatch<AppAction>;
};

export function NotesView({ state, dispatch }: Props) {
  const noteId = state.uiState.selectedNoteId;
  const note = noteId ? state.notesDocs[noteId] : null;

  if (!note || !noteId) {
    return (
      <section className="empty-view-container">
        <div className="empty-view">
          <FileText className="h-8 w-8 text-[var(--ink-700)] opacity-30 mb-3" />
          <p className="text-sm text-[var(--ink-700)]">
            Select a note or create a new one
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="notes-layout">
      <div className="notes-header">
        <input
          aria-label="Note title"
          className="note-title-input"
          placeholder="Untitled Note"
          value={note.title}
          onChange={(event) =>
            dispatch({
              type: "rename-note",
              noteId,
              title: event.target.value,
            })
          }
        />
        <AlertDialog>
          <AlertDialogTrigger
            aria-label="Delete note"
            className="note-delete-trigger"
          >
            <Trash2 className="h-4.5 w-4.5" />
          </AlertDialogTrigger>
          <AlertDialogContent className="alert-dialog-content">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-[var(--ink-900)] font-semibold">
                Delete this note?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-[var(--ink-700)]">
                This action permanently removes the note and its drawing data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="alert-dialog-cancel">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className="alert-dialog-destructive"
                onClick={() => dispatch({ type: "delete-note", noteId })}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="editor-layer">
        <MarkdownEditor
          value={note.markdown}
          onChange={(markdown) =>
            dispatch({ type: "update-note-markdown", noteId, markdown })
          }
        />
      </div>
    </section>
  );
}

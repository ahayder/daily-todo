"use client";

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
import { MarkdownEditor } from "@/components/markdown-editor";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { AppState } from "@/lib/types";
import type { AppAction } from "@/components/app-context";
import { DEFAULT_NOTES_FOLDER_ID } from "@/lib/store";
import { FileText, FolderOpen, Trash2 } from "lucide-react";
import type { Dispatch } from "react";

type Props = {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  notes: {
    selectedBodyStatus: "idle" | "loading" | "ready" | "error" | "stale-offline";
    selectedBodyNotice: string | null;
    selectedBodyError: string | null;
  };
};

export function NotesView({ state, dispatch, notes }: Props) {
  const noteId = state.uiState.selectedNoteId;
  const note = noteId ? state.notesDocs[noteId] : null;
  const folderId = state.uiState.selectedNoteFolderId;
  const folder = folderId ? state.noteFolders[folderId] : null;
  const isDeletableFolder = Boolean(folder && folder.id !== DEFAULT_NOTES_FOLDER_ID);

  if (!note || !noteId) {
    if (folder && folderId) {
      const noteCount = Object.values(state.notesDocs).filter(
        (candidate) => candidate.folderId === folderId,
      ).length;

      return (
        <section className="notes-layout">
          <div className="notes-header">
            <div className="note-folder-header-copy">
              <div className="note-folder-header-title-row">
                <FolderOpen className="h-4 w-4 text-[var(--ink-700)]" />
                {isDeletableFolder ? (
                  <input
                    aria-label="Folder title"
                    className="note-folder-title-input"
                    placeholder="Untitled Folder"
                    value={folder.name}
                    onChange={(event) =>
                      dispatch({
                        type: "rename-note-folder",
                        folderId,
                        name: event.target.value,
                      })
                    }
                  />
                ) : (
                  <h2 className="note-folder-heading">{folder.name}</h2>
                )}
              </div>
              <p className="note-folder-subtitle">
                {noteCount === 0 ? "No notes in this folder yet" : `${noteCount} note${noteCount === 1 ? "" : "s"}`}
              </p>
            </div>

            {isDeletableFolder && (
              <AlertDialog>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertDialogTrigger
                      aria-label={`Delete folder ${folder.name}`}
                      className="note-delete-trigger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </AlertDialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    Delete folder
                  </TooltipContent>
                </Tooltip>
                <AlertDialogContent className="alert-dialog-content">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-[var(--ink-900)] font-semibold">
                      Delete this folder?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-[var(--ink-700)]">
                      This permanently removes the folder, its subfolders, and any notes inside them.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="alert-dialog-cancel">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="alert-dialog-destructive"
                      onClick={() => dispatch({ type: "delete-note-folder", folderId })}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

          <div className="empty-view-container notes-folder-empty-state">
            <div className="empty-view">
              <FileText className="h-8 w-8 text-[var(--ink-700)] opacity-30 mb-3" />
              <p className="text-sm text-[var(--ink-700)]">Select a note or create a new one</p>
            </div>
          </div>
        </section>
      );
    }

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
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertDialogTrigger
                aria-label={`Delete ${note.title || "Untitled Note"}`}
                className="note-delete-trigger"
              >
                <Trash2 className="h-4 w-4" />
              </AlertDialogTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Delete note
            </TooltipContent>
          </Tooltip>
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
              <AlertDialogCancel className="alert-dialog-cancel">Cancel</AlertDialogCancel>
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
        {notes.selectedBodyStatus === "stale-offline" && typeof note.markdown !== "string" ? (
          <div className="empty-view-container">
            <div className="empty-view">
              <FileText className="h-8 w-8 text-[var(--ink-700)] opacity-30 mb-3" />
              <p className="text-sm text-[var(--ink-700)]">
                {notes.selectedBodyError ?? "This note is not available offline yet."}
              </p>
            </div>
          </div>
        ) : notes.selectedBodyStatus === "loading" || typeof note.markdown !== "string" ? (
          <div className="empty-view-container">
            <div className="empty-view">
              <FileText className="h-8 w-8 text-[var(--ink-700)] opacity-30 mb-3" />
              <p className="text-sm text-[var(--ink-700)]">Loading note…</p>
            </div>
          </div>
        ) : notes.selectedBodyStatus === "error" ? (
          <div className="empty-view-container">
            <div className="empty-view">
              <FileText className="h-8 w-8 text-[var(--ink-700)] opacity-30 mb-3" />
              <p className="text-sm text-[var(--ink-700)]">
                {notes.selectedBodyError ?? "This note is not available right now."}
              </p>
            </div>
          </div>
        ) : (
          <>
            {notes.selectedBodyStatus === "stale-offline" && notes.selectedBodyNotice ? (
              <div className="px-4 pb-2 text-xs text-[var(--ink-700)]">{notes.selectedBodyNotice}</div>
            ) : null}
            <MarkdownEditor
              value={note.markdown}
              onChange={(markdown) =>
                dispatch({ type: "update-note-markdown", noteId, markdown })
              }
            />
          </>
        )}
      </div>
    </section>
  );
}

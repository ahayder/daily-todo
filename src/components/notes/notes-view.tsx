"use client";

import { ConfirmDialog } from "@/components/blocks/confirm-dialog";
import { MarkdownEditor } from "@/components/editor/markdown-editor";
import { IconButton } from "@/components/ui/icon-button";
import type { AppState } from "@/lib/types";
import type { AppAction } from "@/components/app/app-context";
import { DEFAULT_NOTES_FOLDER_ID } from "@/lib/store";
import { FileText, FolderOpen, Trash2 } from "lucide-react";
import { useState, type Dispatch } from "react";

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
  const [confirmDelete, setConfirmDelete] = useState<"folder" | "note" | null>(null);

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
              <>
                <IconButton
                  label="Delete folder"
                  icon={<Trash2 />}
                  tooltipSide="bottom"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => setConfirmDelete("folder")}
                />
                <ConfirmDialog
                  open={confirmDelete === "folder"}
                  onOpenChange={(open) => setConfirmDelete(open ? "folder" : null)}
                  title={`Delete "${folder.name || "Untitled Folder"}"?`}
                  description="Its subfolders and every note inside them will be deleted too."
                  confirmLabel="Delete folder"
                  onConfirm={() => dispatch({ type: "delete-note-folder", folderId })}
                />
              </>
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

        <IconButton
          label="Delete note"
          icon={<Trash2 />}
          tooltipSide="bottom"
          className="text-muted-foreground hover:text-destructive"
          onClick={() => setConfirmDelete("note")}
        />
        <ConfirmDialog
          open={confirmDelete === "note"}
          onOpenChange={(open) => setConfirmDelete(open ? "note" : null)}
          title={`Delete "${note.title || "Untitled Note"}"?`}
          description="Its text and drawing will be deleted too."
          confirmLabel="Delete note"
          onConfirm={() => dispatch({ type: "delete-note", noteId })}
        />
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
              key={note.id}
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

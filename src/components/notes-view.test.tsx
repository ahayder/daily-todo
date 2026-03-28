import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { NotesView } from "@/components/notes-view";
import type { AppState } from "@/lib/types";
import { createInitialState } from "@/lib/store";

vi.mock("@/components/markdown-editor", () => ({
  MarkdownEditor: () => <div data-testid="markdown-editor" />,
}));

const notes = {
  selectedBodyStatus: "ready" as const,
  selectedBodyNotice: null,
  selectedBodyError: null,
};


describe("NotesView", () => {
  test("dispatches note title updates", () => {
    const dispatch = vi.fn();
    const state: AppState = createInitialState("2026-03-11");
    state.notesDocs = {
      note1: {
        id: "note1",
        title: "Quick Notes",
        folderId: null,
        markdown: "",
        updatedAt: "2026-03-11T10:00:00.000Z",
      },
    };
    state.uiState.selectedNoteId = "note1";
    state.uiState.lastView = "notes";

    render(<NotesView state={state} dispatch={dispatch} notes={notes} />);

    fireEvent.change(screen.getByLabelText("Note title"), { target: { value: "Updated title" } });

    expect(dispatch).toHaveBeenCalledWith({
      type: "rename-note",
      noteId: "note1",
      title: "Updated title",
    });
  });

  test("dispatches note deletion from the header action after confirmation", async () => {
    const dispatch = vi.fn();
    const state: AppState = createInitialState("2026-03-11");
    state.notesDocs = {
      note1: {
        id: "note1",
        title: "Quick Notes",
        folderId: null,
        markdown: "",
        updatedAt: "2026-03-11T10:00:00.000Z",
      },
    };
    state.uiState.selectedNoteId = "note1";
    state.uiState.lastView = "notes";

    render(<NotesView state={state} dispatch={dispatch} notes={notes} />);

    await userEvent.click(screen.getByRole("button", { name: "Delete Quick Notes" }));
    expect(screen.getByText("Delete this note?")).toBeInTheDocument();

    const confirmButton = document.querySelector('[data-slot="alert-dialog-action"]');
    expect(confirmButton).toBeInstanceOf(HTMLButtonElement);
    fireEvent.click(confirmButton as HTMLButtonElement);

    expect(dispatch).toHaveBeenCalledWith({
      type: "delete-note",
      noteId: "note1",
    });
  });

  test("dispatches folder deletion from the folder header after confirmation", async () => {
    const dispatch = vi.fn();
    const state: AppState = createInitialState("2026-03-11");
    state.uiState.selectedNoteId = null;
    state.uiState.selectedNoteFolderId = "folder1";
    state.uiState.lastView = "notes";
    state.noteFolders = {
      ...state.noteFolders,
      folder1: {
        id: "folder1",
        name: "Projects",
        parentId: null,
        updatedAt: "2026-03-11T10:00:00.000Z",
      },
    };
    state.notesDocs = {
      note1: {
        id: "note1",
        title: "Quick Notes",
        folderId: "folder1",
        markdown: "",
        updatedAt: "2026-03-11T10:00:00.000Z",
      },
    };

    render(<NotesView state={state} dispatch={dispatch} notes={notes} />);

    expect(screen.getByDisplayValue("Projects")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Delete folder Projects" }));
    expect(screen.getByText("Delete this folder?")).toBeInTheDocument();

    const confirmButton = document.querySelector('[data-slot="alert-dialog-action"]');
    expect(confirmButton).toBeInstanceOf(HTMLButtonElement);
    fireEvent.click(confirmButton as HTMLButtonElement);

    expect(dispatch).toHaveBeenCalledWith({
      type: "delete-note-folder",
      folderId: "folder1",
    });
  });

  test("dispatches folder title updates from the folder header", () => {
    const dispatch = vi.fn();
    const state: AppState = createInitialState("2026-03-11");
    state.uiState.selectedNoteId = null;
    state.uiState.selectedNoteFolderId = "folder1";
    state.uiState.lastView = "notes";
    state.noteFolders = {
      ...state.noteFolders,
      folder1: {
        id: "folder1",
        name: "Projects",
        parentId: null,
        updatedAt: "2026-03-11T10:00:00.000Z",
      },
    };

    render(<NotesView state={state} dispatch={dispatch} notes={notes} />);

    fireEvent.change(screen.getByLabelText("Folder title"), { target: { value: "Work" } });

    expect(dispatch).toHaveBeenCalledWith({
      type: "rename-note-folder",
      folderId: "folder1",
      name: "Work",
    });
  });
});

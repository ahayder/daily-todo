import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { NotesView } from "@/components/notes-view";
import type { AppState } from "@/lib/types";

vi.mock("@/components/markdown-editor", () => ({
  MarkdownEditor: () => <div data-testid="markdown-editor" />,
}));

vi.mock("@/components/drawing-overlay", () => ({
  DrawingOverlay: () => <div data-testid="drawing-overlay" />,
}));

describe("NotesView", () => {
  test("confirms before deleting a note", async () => {
    const dispatch = vi.fn();
    const state: AppState = {
      dailyPages: {
        "2026-03-11": {
          date: "2026-03-11",
          markdown: "",
          drawingStrokes: [],
          todos: [],
        },
      },
      notesDocs: {
        note1: {
          id: "note1",
          title: "Quick Notes",
          markdown: "",
          drawingStrokes: [],
          updatedAt: "2026-03-11T10:00:00.000Z",
        },
      },
      uiState: {
        selectedDailyDate: "2026-03-11",
        selectedNoteId: "note1",
        expandedYears: ["2026"],
        expandedMonths: ["2026-03"],
        lastView: "notes",
        themeMode: "system",
      },
    };

    render(<NotesView state={state} dispatch={dispatch} />);

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByText("Delete this note?")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Delete this note?")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    const confirmButton = document.querySelector('[data-slot="alert-dialog-action"]');
    expect(confirmButton).toBeInstanceOf(HTMLButtonElement);
    fireEvent.click(confirmButton as HTMLButtonElement);

    expect(dispatch).toHaveBeenCalledWith({ type: "delete-note", noteId: "note1" });
  });
});

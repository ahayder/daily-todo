import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { AppNotesDialog } from "@/components/app-notes/app-notes-dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { AppNote } from "@/lib/types";

const note: AppNote = {
  id: "app-note_1",
  text: "Show a weekly review",
  kind: "improvement",
  status: "open",
  screen: "todos",
  createdAt: "2026-10-01T10:00:00.000Z",
  updatedAt: "2026-10-01T10:00:00.000Z",
  deletedAt: null,
};

function renderDialog(props: Partial<Parameters<typeof AppNotesDialog>[0]> = {}) {
  const dispatch = vi.fn();
  render(
    <TooltipProvider>
      <AppNotesDialog
        open
        onOpenChange={() => {}}
        notes={{ [note.id]: note }}
        dispatch={dispatch}
        screen="planner"
        isReadOnly={false}
        {...props}
      />
    </TooltipProvider>,
  );
  return dispatch;
}

describe("AppNotesDialog", () => {
  test("saves a typed note with its type and screen, then clears the box", async () => {
    const dispatch = renderDialog();
    const box = screen.getByLabelText("Note text");
    await userEvent.type(box, "Bigger timer");
    await userEvent.click(screen.getByRole("radio", { name: "Bug" }));
    await userEvent.click(screen.getByRole("button", { name: "Save note" }));
    expect(dispatch).toHaveBeenCalledWith({ type: "create-app-note", text: "Bigger timer", kind: "bug", screen: "planner" });
    expect(box).toHaveValue("");
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
  });

  test("lists open notes, soft-deletes one and can undo it inside the dialog", async () => {
    const dispatch = renderDialog();
    expect(screen.getByText("Show a weekly review")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(dispatch).toHaveBeenCalledWith({ type: "delete-app-note", noteId: note.id });
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(dispatch).toHaveBeenCalledWith({ type: "restore-app-note", noteId: note.id });
  });

  test("can't save while the app is still connecting", () => {
    renderDialog({ isReadOnly: true });
    expect(screen.getByRole("button", { name: "Connecting…" })).toBeDisabled();
  });
});

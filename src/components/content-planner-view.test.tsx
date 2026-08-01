import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import {
  ContentPlannerView,
  resolveContentBoardDrop,
  type ContentPlannerViewProps,
} from "@/components/content-planner-view";
import { createDefaultContentBoard } from "@/lib/store";
import type { ContentCard } from "@/lib/types";

function createProps(
  overrides: Partial<ContentPlannerViewProps> = {},
): ContentPlannerViewProps {
  const board = createDefaultContentBoard(new Date("2026-07-29T00:00:00.000Z"));
  const card: ContentCard = {
    id: "card-1",
    columnId: board.columns[0].id,
    title: "Draft launch story",
    notes:
      "Explain **what changed** and why it matters.\n\n- [x] Outline the story\n- [ ] Add proof\n\n[Reference](https://example.com)\n\n<script>unsafe</script>",
    order: 0,
    updatedAt: "2026-07-29T00:00:00.000Z",
  };

  return {
    board,
    cards: { [card.id]: card },
    onAddColumn: vi.fn(),
    onRenameColumn: vi.fn(),
    onUpdateColumnSubtitle: vi.fn(),
    onReorderColumns: vi.fn(),
    onDeleteColumn: vi.fn(),
    onAddCard: vi.fn(),
    onUpdateCard: vi.fn(),
    onMoveCard: vi.fn(),
    onDeleteCard: vi.fn(),
    ...overrides,
  };
}

describe("ContentPlannerView", () => {
  test("resolves card and column drag-end destinations", () => {
    const props = createProps();
    const card = props.cards["card-1"];

    expect(
      resolveContentBoardDrop(
        { type: "column", columnId: props.board.columns[1].id },
        { type: "column", columnId: props.board.columns[0].id },
        {},
      ),
    ).toEqual({
      type: "column",
      activeColumnId: props.board.columns[1].id,
      overColumnId: props.board.columns[0].id,
    });

    expect(
      resolveContentBoardDrop(
        { type: "card", cardId: card.id, columnId: card.columnId },
        { type: "column", columnId: props.board.columns[1].id },
        { [props.board.columns[1].id]: [] },
      ),
    ).toEqual({
      type: "card",
      cardId: card.id,
      targetColumnId: props.board.columns[1].id,
      targetIndex: 0,
    });
  });

  test("renders the default workflow and persisted cards as safe Markdown", () => {
    const { container } = render(<ContentPlannerView {...createProps()} />);

    expect(screen.getByRole("heading", { name: "Content Planner" })).toBeInTheDocument();
    for (const title of ["Ideas", "Planned", "In Progress", "Ready", "Published"]) {
      expect(screen.getByRole("button", { name: `Rename column ${title}` })).toBeInTheDocument();
    }
    expect(screen.getByText("Capture raw concepts")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit card Draft launch story" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "View card Draft launch story" }),
    ).toBeInTheDocument();
    expect(screen.getByText("what changed").tagName).toBe("STRONG");
    expect(screen.getByRole("link", { name: "Reference" })).toHaveAttribute(
      "href",
      "https://example.com",
    );
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    expect(screen.getAllByRole("checkbox")[0]).toBeDisabled();
    expect(container.querySelector("script")).toBeNull();
  });

  test("opens the complete Markdown card in a read-only preview dialog", async () => {
    const user = userEvent.setup();
    render(<ContentPlannerView {...createProps()} />);

    await user.click(
      screen.getByRole("button", { name: "View card Draft launch story" }),
    );

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "Card preview" }),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("what changed").tagName).toBe("STRONG");
    expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Close dialog" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  test("collapses and expands a column without changing board data", async () => {
    const user = userEvent.setup();
    const props = createProps();
    render(<ContentPlannerView {...props} />);

    const collapseButton = screen.getByRole("button", {
      name: "Collapse column Ideas",
    });
    expect(collapseButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("content-card-card-1")).toBeInTheDocument();

    await user.click(collapseButton);
    const expandButton = screen.getByRole("button", {
      name: "Expand column Ideas",
    });
    expect(expandButton).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("content-card-card-1")).not.toBeInTheDocument();
    expect(props.onUpdateCard).not.toHaveBeenCalled();

    await user.click(expandButton);
    expect(screen.getByTestId("content-card-card-1")).toBeInTheDocument();
  });

  test("adds a multiline card from a full text box", async () => {
    const user = userEvent.setup();
    const props = createProps();
    render(<ContentPlannerView {...props} />);

    await user.click(screen.getAllByRole("button", { name: "Add card" })[0]);
    const textBox = screen.getByRole("textbox", { name: "New card in Ideas" });
    expect(textBox.tagName).toBe("TEXTAREA");
    await user.type(
      textBox,
      "Record product walkthrough{Enter}{Enter}Outline the main steps.",
    );
    await user.click(screen.getAllByRole("button", { name: "Add card" })[0]);

    expect(props.onAddCard).toHaveBeenCalledWith(
      props.board.columns[0].id,
      "Record product walkthrough",
      "Outline the main steps.",
    );
  });

  test("edits the card text directly in place", async () => {
    const user = userEvent.setup();
    const props = createProps();
    render(<ContentPlannerView {...props} />);

    await user.click(screen.getByRole("button", { name: "Edit card Draft launch story" }));
    expect(screen.queryByRole("heading", { name: "Edit card" })).not.toBeInTheDocument();

    const textBox = screen.getByRole("textbox", {
      name: "Edit card Draft launch story",
    });
    expect(textBox.tagName).toBe("TEXTAREA");
    await user.clear(textBox);
    await user.type(textBox, "Publish launch story{Enter}{Enter}Keep it concise.");
    await user.tab();

    expect(props.onUpdateCard).toHaveBeenCalledWith(
      "card-1",
      "Publish launch story",
      "Keep it concise.",
    );
  });

  test("confirms card deletion", async () => {
    const user = userEvent.setup();
    const props = createProps();
    render(<ContentPlannerView {...props} />);

    await user.click(screen.getByRole("button", { name: "Delete card Draft launch story" }));
    expect(screen.getByText("Delete this card?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(props.onDeleteCard).toHaveBeenCalledWith("card-1");
  });

  test("blocks deleting the final or non-empty column", async () => {
    const user = userEvent.setup();
    const props = createProps({
      board: {
        columns: [{ id: "only", title: "Ideas", subtitle: "" }],
        updatedAt: "2026-07-29T00:00:00.000Z",
      },
      cards: {},
    });
    render(<ContentPlannerView {...props} />);

    const deleteButton = screen.getByRole("button", { name: "Delete column Ideas" });
    expect(deleteButton).toHaveAttribute("aria-disabled", "true");
    await user.click(deleteButton);
    expect(screen.queryByText("Delete this column?")).not.toBeInTheDocument();
  });

  test("adds, renames, and confirms deletion of an empty column", async () => {
    const user = userEvent.setup();
    const props = createProps();
    render(<ContentPlannerView {...props} />);

    await user.click(screen.getByRole("button", { name: "Add column" }));
    await user.type(screen.getByRole("textbox", { name: "New column title" }), "On Hold");
    await user.type(
      screen.getByRole("textbox", { name: "New column subtitle" }),
      "Waiting for capacity{Enter}",
    );
    expect(props.onAddColumn).toHaveBeenCalledWith("On Hold", "Waiting for capacity");

    await user.click(screen.getByRole("button", { name: "Rename column Planned" }));
    const renameInput = screen.getByRole("textbox", { name: "Rename column Planned" });
    await user.clear(renameInput);
    await user.type(renameInput, "Scheduled{Enter}");
    expect(props.onRenameColumn).toHaveBeenCalledWith(
      props.board.columns[1].id,
      "Scheduled",
    );

    await user.click(screen.getByRole("button", { name: "Edit subtitle for Planned" }));
    const subtitleInput = screen.getByRole("textbox", {
      name: "Edit subtitle for Planned",
    });
    await user.clear(subtitleInput);
    await user.type(subtitleInput, "Next in the queue{Enter}");
    expect(props.onUpdateColumnSubtitle).toHaveBeenCalledWith(
      props.board.columns[1].id,
      "Next in the queue",
    );

    await user.click(screen.getByRole("button", { name: "Delete column Planned" }));
    expect(screen.getByText("Delete this column?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(props.onDeleteColumn).toHaveBeenCalledWith(props.board.columns[1].id);
  });
});

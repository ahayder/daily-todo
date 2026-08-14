import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

import {
  ContentPlannerView,
  resolveContentBoardDragHighlight,
  resolveContentBoardDrop,
  type ContentPlannerViewProps,
} from "@/components/content-planner-view";
import { createDefaultContentBoard } from "@/lib/store";
import type { ContentCard } from "@/lib/types";

const originalMatchMedia = window.matchMedia;

function setTouchFirstInput(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === "(hover: none), (pointer: coarse)" ? matches : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function setDesktopLayout() {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === "(min-width: 768px)",
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

afterEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: originalMatchMedia,
  });
});

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

    const sameColumnCards = [
      { ...card, id: "card-a", order: 0 },
      { ...card, id: "card-b", order: 1 },
      { ...card, id: "card-c", order: 2 },
    ];
    const cardsByColumn = { [card.columnId]: sameColumnCards };

    expect(
      resolveContentBoardDrop(
        { type: "card", cardId: "card-a", columnId: card.columnId },
        { type: "card", cardId: "card-c", columnId: card.columnId },
        cardsByColumn,
        "before",
      ),
    ).toMatchObject({ targetIndex: 1 });
    expect(
      resolveContentBoardDrop(
        { type: "card", cardId: "card-a", columnId: card.columnId },
        { type: "card", cardId: "card-c", columnId: card.columnId },
        cardsByColumn,
        "after",
      ),
    ).toMatchObject({ targetIndex: 2 });
  });

  test("resolves the destination column and insertion card highlight", () => {
    expect(
      resolveContentBoardDragHighlight(
        { type: "card", cardId: "card-1", columnId: "ideas" },
        { type: "card", cardId: "card-2", columnId: "planned" },
        "after",
      ),
    ).toEqual({ columnId: "planned", cardId: "card-2", edge: "after" });

    expect(
      resolveContentBoardDragHighlight(
        { type: "card", cardId: "card-1", columnId: "ideas" },
        { type: "column", columnId: "ready" },
      ),
    ).toEqual({ columnId: "ready", cardId: null, edge: null });

    expect(
      resolveContentBoardDragHighlight(
        { type: "column", columnId: "ideas" },
        { type: "card", cardId: "card-2", columnId: "planned" },
      ),
    ).toBeNull();
  });

  test("renders the default workflow and persisted cards as safe Markdown", () => {
    const props = createProps();
    const { container } = render(<ContentPlannerView {...props} />);

    expect(screen.getByRole("heading", { name: "Content Planner" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Content workflow board" })).toHaveClass(
      "snap-x",
      "snap-mandatory",
      "sm:snap-none",
      "overscroll-x-contain",
    );
    for (const title of ["Ideas", "Planned", "In Progress", "Ready", "Published"]) {
      expect(screen.getByRole("button", { name: `Rename column ${title}` })).toHaveClass(
        "cursor-grab",
        "active:cursor-grabbing",
      );
      expect(
        screen.queryByRole("button", { name: `Move column ${title}` }),
      ).not.toBeInTheDocument();
    }
    expect(screen.getByTestId(`content-column-${props.board.columns[0].id}`)).toHaveClass(
      "w-[calc(100vw-1.5rem)]",
      "snap-center",
      "sm:w-[300px]",
      "sm:snap-none",
    );
    expect(screen.getByText("Capture raw concepts")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit card Draft launch story" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "View card Draft launch story" }),
    ).toBeInTheDocument();
    const card = screen.getByTestId("content-card-card-1");
    const cardBody = screen.getByTestId("content-card-body-card-1");
    const toolbar = screen.getByTestId("content-card-toolbar-card-1");
    expect(toolbar).toHaveAttribute(
      "aria-label",
      "Card toolbar for Draft launch story",
    );
    expect(card).not.toHaveClass("max-h-[var(--content-planner-card-max-height,10.5rem)]");
    expect(cardBody).toHaveClass(
      "max-h-[var(--content-planner-card-max-height,10.5rem)]",
    );
    expect(within(toolbar).getByRole("button", {
      name: "More actions for card Draft launch story",
    })).toHaveClass("size-9", "sm:size-7");
    expect(
      within(toolbar).queryByRole("button", {
        name: "Move card Draft launch story",
      }),
    ).not.toBeInTheDocument();
    expect(within(card).getByText("Draft launch story")).toHaveClass(
      "text-[length:var(--content-planner-font-base,1rem)]",
      "font-semibold",
    );
    expect(
      within(card).getByText("Draft launch story").closest('[data-card-section="header"]'),
    ).toHaveClass(
      "border-b",
      "border-[var(--line)]",
      "bg-[color:color-mix(in_srgb,var(--brand-soft)_62%,var(--paper-strong))]",
    );
    expect(screen.getByText("what changed").tagName).toBe("STRONG");
    expect(screen.getByRole("link", { name: "Reference" })).toHaveAttribute(
      "href",
      "https://example.com",
    );
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    expect(screen.getAllByRole("checkbox")[0]).toBeDisabled();
    expect(container.querySelector("script")).toBeNull();
  });

  test("opens desktop in a wider Pinterest-like gallery", async () => {
    setDesktopLayout();
    const user = userEvent.setup();
    const props = createProps();
    const plannedColumn = props.board.columns[1];
    props.cards["card-2"] = {
      id: "card-2",
      columnId: plannedColumn.id,
      title: "Visual campaign references",
      notes: "Collect layout inspiration and supporting screenshots.",
      order: 0,
      updatedAt: "2026-07-29T01:00:00.000Z",
    };
    render(<ContentPlannerView {...props} />);

    const viewControl = screen.getByRole("group", {
      name: "Content planner view",
    });
    expect(
      within(viewControl).getByRole("button", { name: "Gallery" }),
    ).toHaveAttribute("aria-pressed", "true");

    expect(screen.getByTestId("content-planner-view")).toHaveAttribute(
      "data-layout",
      "gallery",
    );
    expect(screen.queryByRole("region", { name: "Content workflow board" })).toBeNull();
    const gallery = screen.getByRole("region", { name: "Content gallery" });
    expect(gallery.firstElementChild).toHaveClass(
      "columns-2",
      "xl:columns-3",
      "2xl:columns-4",
    );
    expect(gallery.firstElementChild).not.toHaveClass(
      "lg:columns-3",
      "xl:columns-4",
      "2xl:columns-5",
    );
    expect(
      within(screen.getByTestId("content-gallery-card-card-1")).getByText("Ideas"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("content-gallery-card-card-2")).getByText("Planned"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("content-card-body-card-1")).toHaveClass(
      "cursor-pointer",
      "overflow-visible",
    );

    await user.click(
      screen.getByRole("button", {
        name: "More actions for card Draft launch story",
      }),
    );
    const menu = await screen.findByRole("menu", {
      name: "Card actions for Draft launch story",
    });
    expect(within(menu).getByRole("menuitem", { name: "Move card…" })).toBeInTheDocument();

    await user.click(within(viewControl).getByRole("button", { name: "Board" }));
    expect(screen.getByRole("region", { name: "Content workflow board" })).toBeInTheDocument();
  });

  test("applies the shared font scale to board and Markdown typography", () => {
    const props = createProps({ fontScale: 1.25 });
    render(<ContentPlannerView {...props} />);

    const planner = screen.getByTestId("content-planner-view");
    expect(planner).toHaveStyle({ fontSize: "1.25rem" });
    expect(planner.style.getPropertyValue("--content-planner-font-sm")).toBe(
      "1.09375rem",
    );
    expect(planner.style.getPropertyValue("--content-planner-font-base")).toBe(
      "1.25rem",
    );
    expect(
      planner.style.getPropertyValue("--content-planner-card-max-height"),
    ).toBe("13.125rem");
    expect(screen.getByText("Draft launch story")).toHaveClass(
      "text-[length:var(--content-planner-font-base,1rem)]",
    );
  });

  test("uses touch-first scrolling and an explicit move action on coarse pointers", async () => {
    setTouchFirstInput(true);
    const user = userEvent.setup();
    const props = createProps();
    render(<ContentPlannerView {...props} />);

    expect(screen.getByTestId("content-planner-view")).toHaveAttribute(
      "data-touch-first-input",
      "true",
    );
    expect(screen.getByTestId("content-card-body-card-1")).toHaveClass(
      "cursor-pointer",
      "overflow-visible",
    );
    expect(screen.getByTestId("content-card-body-card-1")).not.toHaveClass(
      "cursor-grab",
      "max-h-[var(--content-planner-card-max-height,10.5rem)]",
    );
    expect(screen.getByRole("button", { name: "Rename column Ideas" })).toHaveClass(
      "cursor-pointer",
    );

    await user.click(
      screen.getByRole("button", { name: "More actions for column Ideas" }),
    );
    const columnMenu = await screen.findByRole("menu", {
      name: "Column actions for Ideas",
    });
    expect(within(columnMenu).getByRole("menuitem", { name: "Move left" })).toBeDisabled();
    await user.click(within(columnMenu).getByRole("menuitem", { name: "Move right" }));
    expect(props.onReorderColumns).toHaveBeenCalledWith(
      props.board.columns[0].id,
      props.board.columns[1].id,
    );

    await user.click(
      screen.getByRole("button", {
        name: "More actions for card Draft launch story",
      }),
    );
    const menu = await screen.findByRole("menu", {
      name: "Card actions for Draft launch story",
    });
    await user.click(within(menu).getByRole("menuitem", { name: "Move card…" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Move card" })).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: /top/i }));
    await user.click(within(dialog).getByRole("button", { name: "Move card" }));

    expect(props.onMoveCard).toHaveBeenCalledWith(
      "card-1",
      props.board.columns[0].id,
      0,
    );
  });

  test("opens the complete Markdown card and edits it from the preview dialog", async () => {
    const user = userEvent.setup();
    const props = createProps();
    render(<ContentPlannerView {...props} />);

    const cardBody = screen.getByTestId("content-card-body-card-1");
    expect(cardBody).toHaveClass("cursor-grab", "active:cursor-grabbing");
    expect(cardBody).not.toHaveClass("pr-20");
    expect(cardBody.querySelector(".pr-16")).toBeNull();
    await user.click(cardBody);

    let dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "Card preview" }),
    ).toBeInTheDocument();
    expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Close dialog" }));

    await user.click(
      screen.getByRole("button", { name: "View card Draft launch story" }),
    );

    dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "Card preview" }),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("what changed").tagName).toBe("STRONG");
    expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();

    const previewSurface = within(dialog).getByTestId("content-card-preview-surface");
    const previewEditButton = within(previewSurface).getByRole("button", {
      name: "Edit card Draft launch story from preview",
    });
    expect(previewEditButton).toHaveClass("absolute", "top-2.5", "right-2.5");
    await user.click(previewEditButton);
    expect(
      within(dialog).getByRole("heading", { name: "Card preview" }),
    ).toBeInTheDocument();
    expect(within(dialog).queryByRole("heading", { name: "Edit card" })).toBeNull();
    const previewEditor = within(previewSurface).getByRole("textbox", {
      name: "Edit card Draft launch story in preview",
    });
    await user.clear(previewEditor);
    await user.type(
      previewEditor,
      "Publish launch story{Enter}{Enter}Keep the preview edit concise.",
    );
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    expect(props.onUpdateCard).toHaveBeenCalledWith(
      "card-1",
      "Publish launch story",
      "Keep the preview edit concise.",
    );
    expect(
      within(dialog).getByRole("heading", { name: "Card preview" }),
    ).toBeInTheDocument();
    expect(
      within(previewSurface).getByRole("button", {
        name: "Edit card Draft launch story from preview",
      }),
    ).toBeInTheDocument();
  }, 10_000);

  test("collapses and expands a card without changing card data", async () => {
    const user = userEvent.setup();
    const props = createProps();
    render(<ContentPlannerView {...props} />);

    const collapseButton = screen.getByRole("button", {
      name: "Collapse card Draft launch story",
    });
    expect(collapseButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("what changed")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Collapse column Ideas" }),
    ).not.toBeInTheDocument();

    await user.click(collapseButton);
    const card = screen.getByTestId("content-card-card-1");
    const cardBody = screen.getByTestId("content-card-body-card-1");
    const expandButton = screen.getByRole("button", {
      name: "Expand card Draft launch story",
    });
    expect(expandButton).toHaveAttribute("aria-expanded", "false");
    expect(card).toHaveClass("min-h-20");
    expect(cardBody).not.toHaveClass("min-h-20");
    expect(cardBody).not.toHaveClass("min-h-24");
    expect(cardBody).not.toHaveClass("min-h-28");
    expect(cardBody).not.toHaveClass(
      "max-h-[var(--content-planner-card-max-height,10.5rem)]",
    );
    expect(screen.getByText("Draft launch story")).toBeInTheDocument();
    expect(screen.queryByText("what changed")).not.toBeInTheDocument();
    expect(props.onUpdateCard).not.toHaveBeenCalled();

    await user.click(expandButton);
    expect(card).not.toHaveClass("min-h-20");
    expect(card).not.toHaveClass(
      "max-h-[var(--content-planner-card-max-height,10.5rem)]",
    );
    expect(cardBody).toHaveClass(
      "min-h-28",
      "max-h-[var(--content-planner-card-max-height,10.5rem)]",
    );
    expect(screen.getByText("what changed")).toBeInTheDocument();
  });

  test("copies the complete Markdown source from a collapsed card", async () => {
    const user = userEvent.setup();
    render(<ContentPlannerView {...createProps()} />);
    const writeText = vi.spyOn(navigator.clipboard, "writeText");

    await user.click(
      screen.getByRole("button", { name: "Collapse card Draft launch story" }),
    );
    expect(screen.queryByText("what changed")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Copy card Draft launch story" }),
    );

    expect(writeText).toHaveBeenCalledWith(
      "Draft launch story\n\nExplain **what changed** and why it matters.\n\n- [x] Outline the story\n- [ ] Add proof\n\n[Reference](https://example.com)\n\n<script>unsafe</script>",
    );
    expect(
      screen.getByRole("button", { name: "Copied card Draft launch story" }),
    ).toHaveClass("text-[var(--brand)]");
    expect(
      within(screen.getByTestId("content-card-toolbar-card-1")).getByRole(
        "status",
      ),
    ).toHaveTextContent("Copied card Draft launch story");
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

  test("the toolbar pencil enters inline editing and expands the card", async () => {
    const user = userEvent.setup();
    render(<ContentPlannerView {...createProps()} />);

    await user.click(
      screen.getByRole("button", { name: "Collapse card Draft launch story" }),
    );
    expect(screen.queryByText("what changed")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Edit card Draft launch story" }),
    );
    expect(
      screen.getByRole("textbox", { name: "Edit card Draft launch story" }),
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.getByText("what changed")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Collapse card Draft launch story" }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  test("confirms card deletion", async () => {
    const user = userEvent.setup();
    const props = createProps();
    render(<ContentPlannerView {...props} />);

    await user.click(screen.getByRole("button", {
      name: "More actions for card Draft launch story",
    }));
    const menu = await screen.findByRole("menu", {
      name: "Card actions for Draft launch story",
    });
    await user.click(within(menu).getByRole("menuitem", { name: "Delete card" }));
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

    await user.click(
      screen.getByRole("button", { name: "More actions for column Ideas" }),
    );
    const menu = await screen.findByRole("menu", {
      name: "Column actions for Ideas",
    });
    const deleteButton = within(menu).getByRole("menuitem", {
      name: "Delete column",
    });
    expect(deleteButton).toBeDisabled();
    expect(deleteButton).toHaveAttribute("aria-disabled", "true");
    expect(
      within(menu).getByText("The board needs at least one column."),
    ).toBeInTheDocument();
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

    await user.click(
      screen.getByRole("button", { name: "More actions for column Planned" }),
    );
    const columnMenu = await screen.findByRole("menu", {
      name: "Column actions for Planned",
    });
    await user.click(
      within(columnMenu).getByRole("menuitem", { name: "Delete column" }),
    );
    expect(screen.getByText("Delete this column?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(props.onDeleteColumn).toHaveBeenCalledWith(props.board.columns[1].id);
  }, 10_000);
});

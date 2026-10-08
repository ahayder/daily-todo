import { act, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { ContentPlannerView, type ContentPlannerViewProps } from "@/components/content-planner-view";
import {
  CONTENT_COLUMN_DEVELOP_ID,
  CONTENT_COLUMN_INBOX_ID,
  CONTENT_COLUMN_EDITING_ID,
  CONTENT_COLUMN_PUBLISHED_ID,
  CONTENT_COLUMN_SHOOT_NEXT_ID,
  createDefaultContentBoard,
} from "@/lib/store";
import type { ContentCard } from "@/lib/types";

const toastMocks = vi.hoisted(() => ({
  showUndoToast: vi.fn(),
  add: vi.fn(),
}));

vi.mock("@/components/ui/toast", () => ({
  showUndoToast: toastMocks.showUndoToast,
  toast: { add: toastMocks.add, close: vi.fn() },
}));

const originalMatchMedia = window.matchMedia;

/** `split` = wide screen (list + detail side by side); otherwise phone. */
function setLayout(layout: "split" | "phone") {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches:
        layout === "split"
          ? query === "(min-width: 1024px)" || query === "(min-width: 768px)"
          : query === "(hover: none), (pointer: coarse)" || query === "(max-width: 639px)",
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

beforeEach(() => {
  setLayout("split");
  toastMocks.showUndoToast.mockReset();
  toastMocks.add.mockReset();
});

afterEach(() => {
  Object.defineProperty(window, "matchMedia", { configurable: true, value: originalMatchMedia });
});

function makeCard(id: string, columnId: string, overrides: Partial<ContentCard> = {}): ContentCard {
  return {
    id,
    columnId,
    title: id,
    notes: "",
    order: 0,
    updatedAt: "2026-07-29T00:00:00.000Z",
    ...overrides,
  };
}

function createProps(cards: ContentCard[], overrides: Partial<ContentPlannerViewProps> = {}): ContentPlannerViewProps {
  return {
    board: createDefaultContentBoard(new Date("2026-07-29T00:00:00.000Z")),
    cards: Object.fromEntries(cards.map((card) => [card.id, card])),
    fontScale: 1,
    onAddCard: vi.fn(),
    onUpdateCard: vi.fn(),
    onUpdatePublishInfo: vi.fn(),
    onMoveCard: vi.fn(),
    onDeleteCard: vi.fn(),
    onRestoreCard: vi.fn(),
    ...overrides,
  };
}

const idea = makeCard("Morning pages for coders", CONTENT_COLUMN_INBOX_ID, {
  notes: "Writing before coding clears my head.",
});
const developing = makeCard("Why I quit Notion", CONTENT_COLUMN_DEVELOP_ID, {
  notes: "## ORIGINAL THOUGHT\n\nToo much setup.\n\n## IDEA NOTE\n\nAngle: tools as procrastination",
});

describe("ContentPlannerView — Focus + Shelf", () => {
  test("lists every card as a readable row grouped by stage, with a snippet of the current work", () => {
    render(<ContentPlannerView {...createProps([idea, developing])} />);

    const shelf = screen.getByRole("navigation", { name: "Content cards" });
    expect(within(shelf).getByRole("heading", { name: "Shoot next" })).toBeInTheDocument();
    expect(within(shelf).getByRole("heading", { name: "Develop" })).toBeInTheDocument();
    expect(within(shelf).getByRole("heading", { name: "Ideas" })).toBeInTheDocument();
    expect(within(shelf).getByRole("heading", { name: "Published" })).toBeInTheDocument();

    const developRow = within(shelf).getByRole("button", { name: /^Why I quit Notion/ });
    expect(developRow).toHaveTextContent("Angle: tools as procrastination");
    expect(within(shelf).getByRole("button", { name: /^Morning pages for coders/ })).toHaveTextContent(
      "Writing before coding clears my head.",
    );
  });

  test("opens on the Next up card and shows its single next step", () => {
    render(<ContentPlannerView {...createProps([idea, developing])} />);

    const week = screen.getByRole("region", { name: "This week" });
    expect(within(week).getByText("Why I quit Notion")).toBeInTheDocument();
    expect(within(week).getByRole("button", { name: /Ready to shoot/ })).toBeInTheDocument();

    const detail = screen.getByRole("article", { name: "Why I quit Notion" });
    expect(within(detail).getByLabelText("Idea note")).toHaveValue("Angle: tools as procrastination");
    expect(within(detail).getByRole("button", { name: /Ready to shoot/ })).toBeInTheDocument();
  });

  test("captures a thought to the top of Ideas: first line = title, rest = notes", async () => {
    const user = userEvent.setup();
    const props = createProps([]);
    render(<ContentPlannerView {...props} />);

    const box = screen.getByLabelText("Capture a thought");
    await user.type(box, "Batch shoot on Saturdays{Shift>}{Enter}{/Shift}less context switching{Enter}");

    expect(props.onAddCard).toHaveBeenCalledWith(
      CONTENT_COLUMN_INBOX_ID,
      "Batch shoot on Saturdays",
      "less context switching",
      { atTop: true },
    );
    expect(box).toHaveValue("");
    expect(screen.getByText("Saved to Ideas")).toBeInTheDocument();
  });

  test("Develop this adds the Idea note section and moves the card to the top of Develop", async () => {
    const user = userEvent.setup();
    const props = createProps([idea]);
    render(<ContentPlannerView {...props} />);

    await user.click(
      within(screen.getByRole("navigation", { name: "Content cards" })).getByRole("button", {
        name: /^Morning pages for coders/,
      }),
    );
    const detail = screen.getByRole("article", { name: "Morning pages for coders" });
    await user.click(within(detail).getByRole("button", { name: /Develop this/ }));

    expect(props.onUpdateCard).toHaveBeenCalledWith(
      idea.id,
      idea.title,
      "## ORIGINAL THOUGHT\n\nWriting before coding clears my head.\n\n## IDEA NOTE",
    );
    expect(props.onMoveCard).toHaveBeenCalledWith(idea.id, CONTENT_COLUMN_DEVELOP_ID, 0);
  });

  test("auto-saves edits to one section without touching the others", async () => {
    const user = userEvent.setup();
    const props = createProps([developing]);
    render(<ContentPlannerView {...props} />);

    const ideaNote = within(screen.getByRole("article", { name: "Why I quit Notion" })).getByLabelText("Idea note");
    await user.type(ideaNote, " + hook");

    await waitFor(() =>
      expect(props.onUpdateCard).toHaveBeenLastCalledWith(
        developing.id,
        developing.title,
        "## ORIGINAL THOUGHT\n\nToo much setup.\n\n## IDEA NOTE\n\nAngle: tools as procrastination + hook",
      ),
    );
  });

  test("counts only cards published this week toward the weekly goal", () => {
    const thisWeek = makeCard("Shipped today", CONTENT_COLUMN_PUBLISHED_ID, {
      publishedAt: new Date().toISOString(),
    });
    const legacy = makeCard("Old video", CONTENT_COLUMN_PUBLISHED_ID, { order: 1, publishedAt: null });
    render(<ContentPlannerView {...createProps([thisWeek, legacy])} />);

    expect(within(screen.getByRole("region", { name: "This week" })).getByText("1 of 4 shipped")).toBeInTheDocument();
  });

  test("Start editing moves a Shoot next card to Editing", async () => {
    const user = userEvent.setup();
    const shot = makeCard("Shot one", CONTENT_COLUMN_SHOOT_NEXT_ID);
    const props = createProps([shot]);
    render(<ContentPlannerView {...props} />);

    await user.click(within(screen.getByRole("article", { name: "Shot one" })).getByRole("button", { name: /Start editing/ }));

    expect(props.onMoveCard).toHaveBeenCalledWith(shot.id, CONTENT_COLUMN_EDITING_ID, 0);
  });

  test("a Published card saves pasted links and a transcript", async () => {
    const user = userEvent.setup();
    const live = makeCard("Live one", CONTENT_COLUMN_PUBLISHED_ID);
    const onUpdatePublishInfo = vi.fn();
    // Keeps saved values like the real store does, so later saves build on them.
    function Harness() {
      const [card, setCard] = useState(live);
      return (
        <ContentPlannerView
          {...createProps([card], {
            onUpdatePublishInfo: (cardId, links, transcript) => {
              onUpdatePublishInfo(cardId, links, transcript);
              setCard((current) => ({ ...current, links, transcript }));
            },
          })}
        />
      );
    }
    render(<Harness />);
    const props = { onUpdatePublishInfo };

    await user.type(screen.getByLabelText("YouTube"), "https://youtu.be/abc");
    await user.type(screen.getByLabelText("Transcript"), "hello");
    await user.tab();

    expect(props.onUpdatePublishInfo).toHaveBeenLastCalledWith(
      live.id,
      expect.objectContaining({ youtube: "https://youtu.be/abc" }),
      "hello",
    );
    expect(screen.getByRole("link", { name: "Open on YouTube" })).toHaveAttribute("href", "https://youtu.be/abc");
  });

  test("Mark published celebrates with the weekly count", async () => {
    const user = userEvent.setup();
    const ready = makeCard("Ready one", CONTENT_COLUMN_EDITING_ID);
    const props = createProps([ready]);
    render(<ContentPlannerView {...props} />);

    await user.click(within(screen.getByRole("article", { name: "Ready one" })).getByRole("button", { name: /Mark published/ }));

    expect(props.onMoveCard).toHaveBeenCalledWith(ready.id, CONTENT_COLUMN_PUBLISHED_ID, 0);
    expect(toastMocks.add).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Shipped!", description: "1 of 4 this week." }),
    );
  });

  test("deleting a card is instant and Undo restores it at its index", async () => {
    const user = userEvent.setup();
    const props = createProps([developing]);
    render(<ContentPlannerView {...props} />);

    await user.click(screen.getByRole("button", { name: "Card actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete card" }));

    expect(props.onDeleteCard).toHaveBeenCalledWith(developing.id);
    const { onUndo } = toastMocks.showUndoToast.mock.calls[0][0] as { onUndo: () => void };
    act(() => onUndo());
    expect(props.onRestoreCard).toHaveBeenCalledWith(developing, 0);
  });

  test("Review ideas goes one card at a time and the count goes down", async () => {
    const user = userEvent.setup();
    const second = makeCard("Second idea", CONTENT_COLUMN_INBOX_ID, { order: 1 });
    render(<ContentPlannerView {...createProps([idea, second])} />);

    await user.click(screen.getByRole("button", { name: "Review" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("2 left")).toBeInTheDocument();
    expect(within(dialog).getByText("Morning pages for coders")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Keep for later" }));
    expect(within(dialog).getByText("1 left")).toBeInTheDocument();
    expect(within(dialog).getByText("Second idea")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Keep for later" }));
    expect(within(dialog).getByText(/All caught up/)).toBeInTheDocument();
  });

  test("on phones, tapping a row opens the card full screen with a Back button", async () => {
    setLayout("phone");
    const user = userEvent.setup();
    render(<ContentPlannerView {...createProps([idea])} />);

    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    await user.click(
      within(screen.getByRole("navigation", { name: "Content cards" })).getByRole("button", {
        name: /^Morning pages for coders/,
      }),
    );

    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByRole("article", { name: "Morning pages for coders" })).toBeInTheDocument();
    await user.click(within(sheet).getByRole("button", { name: "Back to list" }));
    await waitFor(() => expect(screen.queryByRole("article")).not.toBeInTheDocument());
  });

  test("shows the teach-by-doing empty state when there are no cards", () => {
    render(<ContentPlannerView {...createProps([])} />);
    expect(screen.getByText("Start with one specific thought")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Content cards" })).not.toBeInTheDocument();
  });

  test("Copy for ChatGPT copies the prompt plus labelled title and sections", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<ContentPlannerView {...createProps([developing])} />);

    await user.click(screen.getByRole("button", { name: "Copy for ChatGPT" }));

    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("Write the SHOOT CARD section"),
    );
    const payload = writeText.mock.calls[0][0];
    expect(payload).toContain("Title: Why I quit Notion");
    expect(payload).toContain("Original Thought:\nToo much setup.");
    expect(payload).toContain("Idea Note:\nAngle: tools as procrastination");
    expect(await screen.findByText(/Copied — paste in ChatGPT/)).toBeInTheDocument();
  });
});

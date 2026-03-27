import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { useEffect } from "react";
import { MarkdownEditor } from "@/components/markdown-editor";

vi.mock("@/components/editor/bubble-menu", () => ({
  EditorBubbleMenu: () => null,
}));

vi.mock("@excalidraw/excalidraw", () => {
  const mockApi = {
    setActiveTool: vi.fn(),
    updateScene: vi.fn(),
    getAppState: vi.fn(() => ({
      activeTool: { type: "freedraw" },
      currentItemStrokeColor: "#1f2430",
    })),
    onChange: vi.fn(() => () => {}),
  };

  function ExcalidrawMock(props: {
    excalidrawAPI?: (api: typeof mockApi) => void;
    onChange?: (elements: unknown[], appState: Record<string, unknown>, files: Record<string, unknown>) => void;
    theme?: string;
  }) {
    useEffect(() => {
      props.excalidrawAPI?.(mockApi);
    }, [props]);

    return (
      <div data-testid="excalidraw" data-theme={props.theme}>
        <button
          type="button"
          onClick={() =>
            props.onChange?.(
              [{ id: "shape-1", type: "rectangle" }],
              { theme: props.theme, currentItemStrokeColor: "#1f2430" },
              {},
            )
          }
        >
          mock-draw
        </button>
      </div>
    );
  }

  return {
    Excalidraw: ExcalidrawMock,
    serializeAsJSON: vi.fn((_elements: unknown, appState: Record<string, unknown>, files: Record<string, unknown>) =>
      JSON.stringify({
        type: "excalidraw",
        version: 2,
        source: "test",
        elements: [{ id: "shape-1" }],
        appState: {
          theme: appState.theme,
          currentItemStrokeColor: appState.currentItemStrokeColor,
        },
        files,
      }),
    ),
  };
});

function getEditorElement() {
  const editor = document.querySelector(".tiptap-editor.ProseMirror");
  if (!(editor instanceof HTMLElement)) {
    throw new Error("Editor element not found");
  }
  return editor;
}

if (!document.elementFromPoint) {
  document.elementFromPoint = () => document.body;
}

describe("MarkdownEditor drawing block", () => {
  test("inserts a drawing block from the toolbar", async () => {
    const onChange = vi.fn();
    render(<MarkdownEditor value="" onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Insert Drawing" }));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
      expect(onChange.mock.lastCall?.[0]).toContain('data-type="drawing"');
    });
  });

  test("inserts a drawing block from the slash command menu", async () => {
    const onChange = vi.fn();
    render(<MarkdownEditor value="" onChange={onChange} />);

    const editor = getEditorElement();
    await userEvent.click(editor);
    await userEvent.keyboard("/d");

    await userEvent.click(await screen.findByText("Drawing Board"));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
      expect(onChange.mock.lastCall?.[0]).toContain('data-type="drawing"');
    });
  });

  test("persists excalidraw state back into markdown", async () => {
    const onChange = vi.fn();
    render(<MarkdownEditor value='<div data-type="drawing"></div>' onChange={onChange} />);

    await userEvent.click(await screen.findByRole("button", { name: "mock-draw" }));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
      expect(onChange.mock.lastCall?.[0]).toContain("data-excalidraw=");
    });
  });

  test("shows a legacy placeholder for old tldraw nodes", async () => {
    render(
      <MarkdownEditor
        value={'<div data-type="drawing" data-tldraw="eyJkb2N1bWVudCI6e319"></div>'}
        onChange={vi.fn()}
      />,
    );

    expect(await screen.findByText("Legacy drawing")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create fresh drawing" }),
    ).toBeInTheDocument();
  });

  test("syncs Excalidraw theme with the app dark class", async () => {
    document.documentElement.classList.add("dark");

    render(<MarkdownEditor value='<div data-type="drawing"></div>' onChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId("excalidraw")).toHaveAttribute("data-theme", "dark");
    });

    document.documentElement.classList.remove("dark");
  });
});

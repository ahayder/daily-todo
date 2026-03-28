import { useReducer, type ComponentProps } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { AuthProvider } from "@/components/auth-context";
import { Sidebar } from "@/components/sidebar";
import { appReducer } from "@/components/app-context";
import { createInitialState } from "@/lib/store";
import { createMockAuthRepository } from "@/test/repositories";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
}));

function Harness() {
  const initial = createInitialState("2026-03-10");
  initial.dailyPages["2026-03-11"] = {
    date: "2026-03-11",
    markdown: "",
    todos: [],
  };

  const [state, dispatch] = useReducer(appReducer, initial);
  const auth = createMockAuthRepository({
    userId: "user_1",
    email: "test@example.com",
    isVerified: true,
    accessToken: "token_1",
  });

  return (
    <AuthProvider repository={auth.repository}>
      <Sidebar
        state={state}
        dispatch={dispatch}
        sync={{ hasUnsyncedChanges: false }}
        retrySync={vi.fn(async () => {})}
      />
    </AuthProvider>
  );
}

describe("Sidebar", () => {
  test("renders tree structure and today button", async () => {
    render(<Harness />);

    const todayButton = screen.getByRole("button", { name: /today/i });
    expect(todayButton).toBeInTheDocument();

    const yearButtons = screen.getAllByRole("button", { name: /2026/i });
    expect(yearButtons.length).toBeGreaterThan(0);

    const currentDayButton = screen.getByRole("button", { name: /Mar 10, 2026/i });
    expect(currentDayButton).toBeInTheDocument();
  });

  test("renders planner preset list in planner view", async () => {
    function PlannerHarness() {
      const initial = createInitialState("2026-03-10");
      initial.uiState.lastView = "planner";
      const presetId = initial.uiState.selectedPlannerPresetId!;
      initial.plannerPresets[presetId].name = "Balanced Week";

      const [state, dispatch] = useReducer(appReducer, initial);
      const auth = createMockAuthRepository({
        userId: "user_1",
        email: "test@example.com",
        isVerified: true,
        accessToken: "token_1",
      });

      return (
        <AuthProvider repository={auth.repository}>
          <Sidebar
            state={state}
            dispatch={dispatch}
            sync={{ hasUnsyncedChanges: false }}
            retrySync={vi.fn(async () => {})}
          />
        </AuthProvider>
      );
    }

    render(<PlannerHarness />);

    expect(screen.getByText("Planner Presets")).toBeInTheDocument();
    expect(screen.getByText("Balanced Week")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New preset" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete Balanced Week" })).toBeInTheDocument();
  });

  test("renders note folders without a note delete action in the sidebar", async () => {
    function NotesHarness() {
      const initial = createInitialState("2026-03-10");
      initial.uiState.lastView = "notes";
      initial.uiState.selectedNoteId = "note_1";
      initial.uiState.selectedNoteFolderId = "folder_1";
      initial.uiState.expandedNoteFolders = ["folder_1", "folder_2"];
      initial.noteFolders = {
        folder_1: {
          id: "folder_1",
          name: "Projects",
          parentId: null,
          updatedAt: "2026-03-10T08:00:00.000Z",
        },
        folder_2: {
          id: "folder_2",
          name: "Sprint",
          parentId: "folder_1",
          updatedAt: "2026-03-10T08:01:00.000Z",
        },
      };
      initial.notesDocs = {
        note_1: {
          id: "note_1",
          title: "Launch Plan",
          folderId: "folder_2",
          markdown: "",
          updatedAt: "2026-03-10T09:00:00.000Z",
        },
      };

      const [state, dispatch] = useReducer(appReducer, initial);
      const auth = createMockAuthRepository({
        userId: "user_1",
        email: "test@example.com",
        isVerified: true,
        accessToken: "token_1",
      });

      return (
        <AuthProvider repository={auth.repository}>
          <Sidebar
            state={state}
            dispatch={dispatch}
            sync={{ hasUnsyncedChanges: false }}
            retrySync={vi.fn(async () => {})}
          />
        </AuthProvider>
      );
    }

    render(<NotesHarness />);

    expect(screen.getByText("Projects")).toBeInTheDocument();
    expect(screen.getAllByText("Sprint").length).toBeGreaterThan(1);
    expect(screen.getByText("Launch Plan")).toBeInTheDocument();
    expect(screen.getByText("Tue, Mar 10")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New folder" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New note" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete Launch Plan" })).not.toBeInTheDocument();
  });

  test("does not render folder delete actions in the sidebar", async () => {
    function NotesHarness() {
      const initial = createInitialState("2026-03-10");
      initial.uiState.lastView = "notes";
      initial.uiState.selectedNoteFolderId = "folder_1";
      initial.uiState.expandedNoteFolders = ["folder_1", "folder_2"];
      initial.noteFolders = {
        folder_1: {
          id: "folder_1",
          name: "Projects",
          parentId: null,
          updatedAt: "2026-03-10T08:00:00.000Z",
        },
        folder_2: {
          id: "folder_2",
          name: "Sprint",
          parentId: "folder_1",
          updatedAt: "2026-03-10T08:01:00.000Z",
        },
      };
      initial.notesDocs = {
        note_1: {
          id: "note_1",
          title: "Launch Plan",
          folderId: "folder_2",
          markdown: "",
          updatedAt: "2026-03-10T09:00:00.000Z",
        },
      };

      const [state, dispatch] = useReducer(appReducer, initial);
      const auth = createMockAuthRepository({
        userId: "user_1",
        email: "test@example.com",
        isVerified: true,
        accessToken: "token_1",
      });

      return (
        <AuthProvider repository={auth.repository}>
          <Sidebar
            state={state}
            dispatch={dispatch}
            sync={{ hasUnsyncedChanges: false }}
            retrySync={vi.fn(async () => {})}
          />
        </AuthProvider>
      );
    }

    render(<NotesHarness />);

    expect(screen.queryByRole("button", { name: "Delete folder Projects" })).not.toBeInTheDocument();
  });

  test("edits a folder name inline when clicking the selected folder", async () => {
    function NotesHarness() {
      const initial = createInitialState("2026-03-10");
      initial.uiState.lastView = "notes";
      initial.uiState.selectedNoteFolderId = "folder_1";
      initial.uiState.selectedNoteId = null;
      initial.uiState.expandedNoteFolders = ["folder_1"];
      initial.noteFolders = {
        folder_1: {
          id: "folder_1",
          name: "Projects",
          parentId: null,
          updatedAt: "2026-03-10T08:00:00.000Z",
        },
      };

      const [state, dispatch] = useReducer(appReducer, initial);
      const auth = createMockAuthRepository({
        userId: "user_1",
        email: "test@example.com",
        isVerified: true,
        accessToken: "token_1",
      });

      return (
        <AuthProvider repository={auth.repository}>
          <Sidebar
            state={state}
            dispatch={dispatch}
            sync={{ hasUnsyncedChanges: false }}
            retrySync={vi.fn(async () => {})}
          />
        </AuthProvider>
      );
    }

    render(<NotesHarness />);

    await userEvent.click(screen.getByRole("button", { name: "Projects" }));
    const input = screen.getByLabelText("Rename folder Projects");
    expect(input).toBeInTheDocument();

    await userEvent.clear(input);
    await userEvent.type(input, "Work");
    fireEvent.blur(input);

    expect(screen.getByText("Work")).toBeInTheDocument();
  });

  test("collapses and expands note folders from the sidebar", async () => {
    function NotesHarness() {
      const initial = createInitialState("2026-03-10");
      initial.uiState.lastView = "notes";
      initial.uiState.selectedNoteFolderId = "folder_1";
      initial.uiState.expandedNoteFolders = ["folder_1"];
      initial.noteFolders = {
        folder_1: {
          id: "folder_1",
          name: "Projects",
          parentId: null,
          updatedAt: "2026-03-10T08:00:00.000Z",
        },
      };
      initial.notesDocs = {
        note_1: {
          id: "note_1",
          title: "Launch Plan",
          folderId: "folder_1",
          markdown: "",
          updatedAt: "2026-03-10T09:00:00.000Z",
        },
      };

      const [state, dispatch] = useReducer(appReducer, initial);
      const auth = createMockAuthRepository({
        userId: "user_1",
        email: "test@example.com",
        isVerified: true,
        accessToken: "token_1",
      });

      return (
        <AuthProvider repository={auth.repository}>
          <Sidebar
            state={state}
            dispatch={dispatch}
            sync={{ hasUnsyncedChanges: false }}
            retrySync={vi.fn(async () => {})}
          />
        </AuthProvider>
      );
    }

    render(<NotesHarness />);

    expect(screen.getByText("Launch Plan")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Collapse folder Projects" }));
    expect(screen.queryByText("Launch Plan")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Expand folder Projects" }));
    expect(screen.getByText("Launch Plan")).toBeInTheDocument();
  });

  test("allows the default notes folder to collapse and expand", async () => {
    function DefaultFolderHarness() {
      const initial = createInitialState("2026-03-10");
      initial.uiState.lastView = "notes";
      initial.uiState.selectedNoteId = null;
      initial.uiState.selectedNoteFolderId = "note-folder-default";
      initial.uiState.expandedNoteFolders = ["note-folder-default"];
      initial.notesDocs = {
        note_1: {
          id: "note_1",
          title: "Inbox note",
          folderId: "note-folder-default",
          markdown: "",
          updatedAt: "2026-03-10T09:00:00.000Z",
        },
      };

      const [state, dispatch] = useReducer(appReducer, initial);
      const auth = createMockAuthRepository({
        userId: "user_1",
        email: "test@example.com",
        isVerified: true,
        accessToken: "token_1",
      });

      return (
        <AuthProvider repository={auth.repository}>
          <Sidebar
            state={state}
            dispatch={dispatch}
            sync={{ hasUnsyncedChanges: false }}
            retrySync={vi.fn(async () => {})}
          />
        </AuthProvider>
      );
    }

    render(<DefaultFolderHarness />);

    expect(screen.getByText("Inbox note")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Collapse folder Notes" }));
    expect(screen.queryByText("Inbox note")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Expand folder Notes" }));
    expect(screen.getByText("Inbox note")).toBeInTheDocument();
  });

  test("does not render when sidebar is collapsed", () => {
    function CollapsedHarness() {
      const initial = createInitialState("2026-03-10");
      initial.uiState.isSidebarCollapsed = true;

      const [state, dispatch] = useReducer(appReducer, initial);
      const auth = createMockAuthRepository({
        userId: "user_1",
        email: "test@example.com",
        isVerified: true,
        accessToken: "token_1",
      });

      return (
        <AuthProvider repository={auth.repository}>
          <Sidebar
            state={state}
            dispatch={dispatch}
            sync={{ hasUnsyncedChanges: false }}
            retrySync={vi.fn(async () => {})}
          />
        </AuthProvider>
      );
    }

    const { container } = render(<CollapsedHarness />);
    expect(container).toBeEmptyDOMElement();
  });

  test("renders the profile avatar trigger and account menu", async () => {
    render(<Harness />);

    await userEvent.click(await screen.findByRole("button", { name: "Workspace account" }));

    const accountMenu = await screen.findByRole("menu", { name: "Account menu" });
    expect(accountMenu).toBeInTheDocument();
    await waitFor(() => {
      expect(within(accountMenu).getByText("test@example.com")).toBeInTheDocument();
    });
    expect(screen.getByRole("menuitem", { name: /Log out/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Switch to system theme from dark mode/i })).toBeInTheDocument();
  });

  test("cycles the theme from the sidebar footer icon", async () => {
    function ThemeHarness() {
      const initial = createInitialState("2026-03-10");
      const [state, dispatch] = useReducer(appReducer, initial);
      const auth = createMockAuthRepository({
        userId: "user_1",
        email: "test@example.com",
        isVerified: true,
        accessToken: "token_1",
      });

      return (
        <AuthProvider repository={auth.repository}>
          <div>
            <span data-testid="theme-mode">{state.uiState.themeMode}</span>
            <Sidebar
              state={state}
              dispatch={dispatch}
              sync={{ hasUnsyncedChanges: false }}
              retrySync={vi.fn(async () => {})}
            />
          </div>
        </AuthProvider>
      );
    }

    render(<ThemeHarness />);

    expect(screen.getByTestId("theme-mode")).toHaveTextContent("dark");
    await userEvent.click(screen.getByRole("button", { name: /Switch to system theme from dark mode/i }));

    expect(screen.getByTestId("theme-mode")).toHaveTextContent("system");
  });

  test("signs out from the sidebar account menu", async () => {
    function SignOutHarness() {
      const initial = createInitialState("2026-03-10");
      const [state, dispatch] = useReducer(appReducer, initial);
      const auth = createMockAuthRepository({
        userId: "user_1",
        email: "test@example.com",
        isVerified: true,
        accessToken: "token_1",
      });

      return (
        <AuthProvider repository={auth.repository}>
          <Sidebar
            state={state}
            dispatch={dispatch}
            sync={{ hasUnsyncedChanges: false }}
            retrySync={vi.fn(async () => {})}
          />
        </AuthProvider>
      );
    }

    render(<SignOutHarness />);

    await userEvent.click(await screen.findByRole("button", { name: "Workspace account" }));
    await userEvent.click(screen.getByRole("menuitem", { name: /Log out/i }));

    expect(await screen.findByRole("button", { name: "Workspace account" })).toBeInTheDocument();
  });
});

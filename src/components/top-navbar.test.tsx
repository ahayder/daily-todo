import type { ComponentProps } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { AuthProvider } from "@/components/auth/auth-context";
import { TopNavbar } from "@/components/workspace/top-navbar";
import {
  CONTENT_FONT_SCALE_MAX,
  CONTENT_FONT_SCALE_MIN,
} from "@/lib/content-font-scale";
import { createInitialState } from "@/lib/store";
import { createMockAuthRepository } from "@/test/repositories";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
}));

describe("TopNavbar", () => {
  test("shows the sidebar toggle in the journal but not on the full-width planner", async () => {
    const dispatch = vi.fn();
    const auth = createMockAuthRepository({
      userId: "user_1",
      email: "test@example.com",
      isVerified: true,
      accessToken: "token_1",
    });
    const dailyState = createInitialState("2026-03-10");
    dailyState.uiState.lastView = "todos";
    const plannerState = createInitialState("2026-03-10");
    plannerState.uiState.lastView = "planner";

    const { rerender } = render(
      <AuthProvider repository={auth.repository}>
        <TopNavbar
          state={dailyState}
          dispatch={dispatch}
          sync={{
            status: "synced",
            indicator: "saved",
            lastSavedAt: "2026-03-10T08:00:00.000Z",
            lastSyncedAt: "2026-03-10T08:00:00.000Z",
            notice: null,
            errorMessage: null,
            hasPendingChanges: false,
            hasUnsyncedChanges: false,
            isSaving: false,
            isReadOnly: false,
            pendingCount: 0,
            persistenceAvailable: true,
          }}
          retrySync={vi.fn(async () => {})}
          onOpenChangeRequests={vi.fn()}
        />
      </AuthProvider>,
    );
    expect(await screen.findByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument();
    // Todos (now Journal, a Today tab) and the Daily Planner (opens from Today) left the nav.
    const navLinks = within(screen.getByRole("navigation", { name: "Main navigation" })).getAllByRole("link");
    expect(navLinks.map((link) => link.textContent)).toEqual(["Today", "Notes", "Memory", "Content Planner"]);
    expect(screen.getByText(/Last saved/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Theme:/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Sign out/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Toggle Focus Mode")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Category labels:/)).not.toBeInTheDocument();

    rerender(
      <AuthProvider repository={auth.repository}>
        <TopNavbar
          state={plannerState}
          dispatch={dispatch}
          sync={{
            status: "synced",
            indicator: "saved",
            lastSavedAt: "2026-03-10T08:00:00.000Z",
            lastSyncedAt: "2026-03-10T08:00:00.000Z",
            notice: null,
            errorMessage: null,
            hasPendingChanges: false,
            hasUnsyncedChanges: false,
            isSaving: false,
            isReadOnly: false,
            pendingCount: 0,
            persistenceAvailable: true,
          }}
          retrySync={vi.fn(async () => {})}
          onOpenChangeRequests={vi.fn()}
        />
      </AuthProvider>,
    );
    expect(screen.queryByRole("button", { name: "Collapse sidebar" })).not.toBeInTheDocument();
  });

  test("hides the sidebar toggle in the content planner while keeping sync status", async () => {
    const dispatch = vi.fn();
    const auth = createMockAuthRepository({
      userId: "user_1",
      email: "test@example.com",
      isVerified: true,
      accessToken: "token_1",
    });
    const state = createInitialState("2026-03-10");
    state.uiState.lastView = "content-planner";

    render(
      <AuthProvider repository={auth.repository}>
        <TopNavbar
          state={state}
          dispatch={dispatch}
          sync={{
            status: "synced",
            indicator: "saved",
            lastSavedAt: "2026-03-10T08:00:00.000Z",
            lastSyncedAt: "2026-03-10T08:00:00.000Z",
            notice: null,
            errorMessage: null,
            hasPendingChanges: false,
            hasUnsyncedChanges: false,
            isSaving: false,
            isReadOnly: false,
            pendingCount: 0,
            persistenceAvailable: true,
          }}
          retrySync={vi.fn(async () => {})}
          onOpenChangeRequests={vi.fn()}
        />
      </AuthProvider>,
    );

    expect(screen.queryByRole("button", { name: "Collapse sidebar" })).not.toBeInTheDocument();
    expect(screen.getByText(/Last saved/)).toBeInTheDocument();
    expect(screen.getByRole("banner")).toHaveClass("top-navbar--content-planner");
    expect(screen.getByRole("link", { name: "Content Planner" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText(/Last saved/).closest(".top-navbar__sync")).toBeInTheDocument();
  });

  test("shows Today, Notes, Memory and Content Planner pills and keeps Today highlighted in the journal", () => {
    const auth = createMockAuthRepository({
      userId: "user_1",
      email: "test@example.com",
      isVerified: true,
      accessToken: "token_1",
    });
    const state = createInitialState("2026-03-10");
    state.uiState.lastView = "todos";

    render(
      <AuthProvider repository={auth.repository}>
        <TopNavbar
          state={state}
          dispatch={vi.fn()}
          sync={{
            status: "synced",
            indicator: "saved",
            lastSavedAt: "2026-03-10T08:00:00.000Z",
            lastSyncedAt: "2026-03-10T08:00:00.000Z",
            notice: null,
            errorMessage: null,
            hasPendingChanges: false,
            hasUnsyncedChanges: false,
            isSaving: false,
            isReadOnly: false,
            pendingCount: 0,
            persistenceAvailable: true,
          }}
          retrySync={vi.fn(async () => {})}
          onOpenChangeRequests={vi.fn()}
        />
      </AuthProvider>,
    );

    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    expect(within(nav).getByRole("link", { name: "Today" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Notes" })).not.toHaveAttribute("aria-current");
    expect(within(nav).getByRole("link", { name: "Memory" })).toHaveAttribute("href", "/memory");
    expect(within(nav).getByRole("link", { name: "Content Planner" })).not.toHaveAttribute("aria-current");
    expect(within(nav).queryByRole("link", { name: "Todos" })).not.toBeInTheDocument();
  });

  test("shows plain text saving status", () => {
    const dispatch = vi.fn();
    const auth = createMockAuthRepository({
      userId: "user_1",
      email: "test@example.com",
      isVerified: true,
      accessToken: "token_1",
    });
    const state = createInitialState("2026-03-10");

    render(
      <AuthProvider repository={auth.repository}>
        <TopNavbar
          state={state}
          dispatch={dispatch}
          sync={{
            status: "syncing",
            indicator: "saving",
            lastSavedAt: "2026-03-10T08:00:00.000Z",
            lastSyncedAt: "2026-03-10T08:00:00.000Z",
            notice: null,
            errorMessage: null,
            hasPendingChanges: true,
            hasUnsyncedChanges: true,
            isSaving: true,
            isReadOnly: false,
            pendingCount: 0,
            persistenceAvailable: true,
          }}
          retrySync={vi.fn(async () => {})}
          onOpenChangeRequests={vi.fn()}
        />
      </AuthProvider>,
    );

    expect(screen.getByText("Saving…")).toBeInTheDocument();
  });

  test("renders content font controls, dispatches clicks, and disables at bounds", async () => {
    const dispatch = vi.fn();
    const auth = createMockAuthRepository({
      userId: "user_1",
      email: "test@example.com",
      isVerified: true,
      accessToken: "token_1",
    });
    const minState = createInitialState("2026-03-10");
    minState.uiState.contentFontScale = CONTENT_FONT_SCALE_MIN;

    const { rerender } = render(
      <AuthProvider repository={auth.repository}>
        <TopNavbar
          state={minState}
          dispatch={dispatch}
          sync={{
            status: "synced",
            indicator: "saved",
            lastSavedAt: "2026-03-10T08:00:00.000Z",
            lastSyncedAt: "2026-03-10T08:00:00.000Z",
            notice: null,
            errorMessage: null,
            hasPendingChanges: false,
            hasUnsyncedChanges: false,
            isSaving: false,
            isReadOnly: false,
            pendingCount: 0,
            persistenceAvailable: true,
          }}
          retrySync={vi.fn(async () => {})}
          onOpenChangeRequests={vi.fn()}
        />
      </AuthProvider>,
    );

    expect(screen.getByRole("button", { name: "Decrease font size" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Increase font size" }));
    expect(dispatch).toHaveBeenCalledWith({ type: "increase-content-font-scale" });

    const maxState = createInitialState("2026-03-10");
    maxState.uiState.contentFontScale = CONTENT_FONT_SCALE_MAX;

    rerender(
      <AuthProvider repository={auth.repository}>
        <TopNavbar
          state={maxState}
          dispatch={dispatch}
          sync={{
            status: "synced",
            indicator: "saved",
            lastSavedAt: "2026-03-10T08:00:00.000Z",
            lastSyncedAt: "2026-03-10T08:00:00.000Z",
            notice: null,
            errorMessage: null,
            hasPendingChanges: false,
            hasUnsyncedChanges: false,
            isSaving: false,
            isReadOnly: false,
            pendingCount: 0,
            persistenceAvailable: true,
          }}
          retrySync={vi.fn(async () => {})}
          onOpenChangeRequests={vi.fn()}
        />
      </AuthProvider>,
    );

    expect(screen.getByRole("button", { name: "Increase font size" })).toBeDisabled();
  });

  test("forces sync immediately when the sync icon is clicked", async () => {
    const dispatch = vi.fn();
    const retrySync = vi.fn(async () => {});
    const auth = createMockAuthRepository({
      userId: "user_1",
      email: "test@example.com",
      isVerified: true,
      accessToken: "token_1",
    });
    const state = createInitialState("2026-03-10");

    render(
      <AuthProvider repository={auth.repository}>
        <TopNavbar
          state={state}
          dispatch={dispatch}
          sync={{
            status: "synced",
            indicator: "saved",
            lastSavedAt: "2026-03-10T08:00:00.000Z",
            lastSyncedAt: "2026-03-10T08:00:00.000Z",
            notice: null,
            errorMessage: null,
            hasPendingChanges: false,
            hasUnsyncedChanges: false,
            isSaving: false,
            isReadOnly: false,
            pendingCount: 0,
            persistenceAvailable: true,
          }}
          retrySync={retrySync}
          onOpenChangeRequests={vi.fn()}
        />
      </AuthProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Force sync now" }));
    expect(retrySync).toHaveBeenCalled();
  });

  function renderNavbarWithSync(sync: Partial<Parameters<typeof TopNavbar>[0]["sync"]>) {
    const auth = createMockAuthRepository({
      userId: "user_1",
      email: "test@example.com",
      isVerified: true,
      accessToken: "token_1",
    });

    render(
      <AuthProvider repository={auth.repository}>
        <TopNavbar
          state={createInitialState("2026-03-10")}
          dispatch={vi.fn()}
          sync={{
            status: "synced",
            indicator: "saved",
            lastSavedAt: "2026-03-10T08:12:00.000Z",
            lastSyncedAt: "2026-03-10T08:00:00.000Z",
            notice: null,
            errorMessage: null,
            hasPendingChanges: false,
            hasUnsyncedChanges: false,
            isSaving: false,
            isReadOnly: false,
            pendingCount: 0,
            persistenceAvailable: true,
            ...sync,
          }}
          retrySync={vi.fn(async () => {})}
          onOpenChangeRequests={vi.fn()}
        />
      </AuthProvider>,
    );
  }

  test("shows how many changes are waiting when edits haven't reached the server", () => {
    renderNavbarWithSync({
      status: "offline",
      indicator: "unsynced",
      errorMessage: "Sync is offline right now.",
      hasPendingChanges: true,
      hasUnsyncedChanges: true,
      pendingCount: 2,
    });

    expect(screen.getByText("2 changes waiting")).toBeInTheDocument();
  });

  test("shows a read-only loading label until the server's data arrives", () => {
    renderNavbarWithSync({ status: "loading", indicator: "loading", isReadOnly: true });

    expect(screen.getByText("Loading latest…")).toBeInTheDocument();
  });

  test("shows offline read-only when the server can't be reached on start", () => {
    renderNavbarWithSync({ status: "offline", indicator: "offline-readonly", isReadOnly: true });

    expect(screen.getByText("Offline · read-only")).toBeInTheDocument();
  });
});

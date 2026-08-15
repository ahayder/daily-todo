import type { ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
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

vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
}));

describe("TopNavbar", () => {
  test("shows sidebar toggle in todos and planner views", async () => {
    const dispatch = vi.fn();
    const auth = createMockAuthRepository({
      userId: "user_1",
      email: "test@example.com",
      isVerified: true,
      accessToken: "token_1",
    });
    const dailyState = createInitialState("2026-03-10");
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
            persistenceAvailable: true,
          }}
          retrySync={vi.fn(async () => {})}
        />
      </AuthProvider>,
    );
    expect(await screen.findByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument();
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
            persistenceAvailable: true,
          }}
          retrySync={vi.fn(async () => {})}
        />
      </AuthProvider>,
    );
    expect(await screen.findByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument();
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
            persistenceAvailable: true,
          }}
          retrySync={vi.fn(async () => {})}
        />
      </AuthProvider>,
    );

    expect(screen.queryByRole("button", { name: "Collapse sidebar" })).not.toBeInTheDocument();
    expect(screen.getByText(/Last saved/)).toBeInTheDocument();
    expect(screen.getByRole("banner")).toHaveClass("top-navbar--content-planner");
    expect(screen.getByRole("tablist", { name: "Main navigation" })).toHaveClass(
      "nav-pills",
    );
    expect(screen.getByText(/Last saved/).closest(".top-navbar__sync")).toBeInTheDocument();
  });

  test("collapses the shared header while a mobile page scrolls down and restores it on scroll up", () => {
    const dispatch = vi.fn();
    const auth = createMockAuthRepository({
      userId: "user_1",
      email: "test@example.com",
      isVerified: true,
      accessToken: "token_1",
    });
    const state = createInitialState("2026-03-10");
    const originalMatchMedia = window.matchMedia;

    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });

    const { unmount } = render(
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
            persistenceAvailable: true,
          }}
          retrySync={vi.fn(async () => {})}
        />
      </AuthProvider>,
    );
    const scroller = document.createElement("div");
    document.body.append(scroller);
    Object.defineProperties(scroller, {
      scrollHeight: { configurable: true, value: 200 },
      clientHeight: { configurable: true, value: 100 },
    });

    Object.defineProperty(scroller, "scrollTop", { configurable: true, value: 80 });
    fireEvent.scroll(scroller);
    expect(screen.getByRole("banner")).toHaveClass("top-navbar--mobile-hidden");

    const idleScroller = document.createElement("div");
    document.body.append(idleScroller);
    fireEvent.scroll(idleScroller);
    expect(screen.getByRole("banner")).toHaveClass("top-navbar--mobile-hidden");

    Object.defineProperty(scroller, "scrollTop", { configurable: true, value: 40 });
    fireEvent.scroll(scroller);
    expect(screen.getByRole("banner")).not.toHaveClass("top-navbar--mobile-hidden");

    idleScroller.remove();
    scroller.remove();
    unmount();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: originalMatchMedia,
    });
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
            persistenceAvailable: true,
          }}
          retrySync={vi.fn(async () => {})}
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
            persistenceAvailable: true,
          }}
          retrySync={vi.fn(async () => {})}
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
            persistenceAvailable: true,
          }}
          retrySync={vi.fn(async () => {})}
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
            persistenceAvailable: true,
          }}
          retrySync={retrySync}
        />
      </AuthProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Force sync now" }));
    expect(retrySync).toHaveBeenCalled();
  });

  test("shows relative saved message even when latest local changes are not yet synced", () => {
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
            status: "offline",
            indicator: "unsynced",
            lastSavedAt: "2026-03-10T08:12:00.000Z",
            lastSyncedAt: "2026-03-10T08:00:00.000Z",
            notice: "PocketBase is unavailable, so your changes are saved on this device.",
            errorMessage: "Sync is offline right now.",
            hasPendingChanges: true,
            hasUnsyncedChanges: true,
            isSaving: false,
            persistenceAvailable: true,
          }}
          retrySync={vi.fn(async () => {})}
        />
      </AuthProvider>,
    );

    expect(screen.getByText(/Last saved/)).toBeInTheDocument();
  });
});

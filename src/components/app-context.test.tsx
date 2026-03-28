import { beforeEach, describe, expect, test, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider } from "@/components/auth-context";
import { AppProvider, appReducer, useAppState } from "@/components/app-context";
import { createInitialState } from "@/lib/store";
import { createMockAuthRepository, createMockPersistenceRepository } from "@/test/repositories";

vi.mock("next/navigation", () => ({
  usePathname: () => "/daily",
}));

type MatchMediaController = {
  setMatches: (value: boolean) => void;
};

function installMatchMedia(initialMatches: boolean): MatchMediaController {
  let matches = initialMatches;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      get matches() {
        return matches;
      },
      media: "(prefers-color-scheme: dark)",
      addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.add(listener);
      },
      removeEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.delete(listener);
      },
    })),
  });

  return {
    setMatches(value: boolean) {
      matches = value;
      const event = { matches } as MediaQueryListEvent;
      listeners.forEach((listener) => listener(event));
    },
  };
}

function Harness() {
  const { state, dispatch } = useAppState();
  return (
    <div>
      <p data-testid="theme-mode">{state.uiState.themeMode}</p>
      <button type="button" onClick={() => dispatch({ type: "set-theme-mode", themeMode: "light" })}>
        light
      </button>
      <button type="button" onClick={() => dispatch({ type: "set-theme-mode", themeMode: "dark" })}>
        dark
      </button>
      <button type="button" onClick={() => dispatch({ type: "set-theme-mode", themeMode: "system" })}>
        system
      </button>
    </div>
  );
}

function renderWithProviders() {
  const auth = createMockAuthRepository({
    userId: "user_1",
    email: "test@example.com",
    isVerified: true,
    accessToken: "token_1",
  });
  const persistence = createMockPersistenceRepository(createInitialState("2026-03-11"));

  return {
    auth,
    persistence,
    ...render(
      <AuthProvider repository={auth.repository}>
        <AppProvider repository={persistence.repository}>
          <Harness />
        </AppProvider>
      </AuthProvider>,
    ),
  };
}

describe("appReducer theme mode", () => {
  test("updates themeMode with set-theme-mode action", () => {
    const initial = createInitialState("2026-03-11");
    const next = appReducer(initial, { type: "set-theme-mode", themeMode: "dark" });
    expect(next.uiState.themeMode).toBe("dark");
  });

  test("toggles shared sidebar collapsed state", () => {
    const initial = createInitialState("2026-03-11");

    const collapsed = appReducer(initial, { type: "toggle-sidebar-collapsed" });
    expect(collapsed.uiState.isSidebarCollapsed).toBe(true);

    const reopened = appReducer(collapsed, { type: "set-sidebar-collapsed", isCollapsed: false });
    expect(reopened.uiState.isSidebarCollapsed).toBe(false);
  });

  test("creates and updates planner events", () => {
    const initial = createInitialState("2026-03-11");
    const presetId = initial.uiState.selectedPlannerPresetId!;

    const created = appReducer(initial, {
      type: "create-planner-event",
      presetId,
      dayKey: "monday",
      title: "Deep Work",
      startMinutes: 480,
      endMinutes: 600,
      color: "teal",
      notes: "Phone off",
    });

    const event = created.plannerPresets[presetId].days.monday.events[0];
    expect(event.title).toBe("Deep Work");

    const updated = appReducer(created, {
      type: "update-planner-event",
      presetId,
      dayKey: "monday",
      eventId: event.id,
      updates: {
        title: "Deep Work Sprint",
        color: "gold",
      },
    });

    expect(updated.plannerPresets[presetId].days.monday.events[0].title).toBe("Deep Work Sprint");
    expect(updated.plannerPresets[presetId].days.monday.events[0].color).toBe("gold");
  });

  test("deletes planner presets and keeps planner selectable", () => {
    const initial = createInitialState("2026-03-11");
    const firstPresetId = initial.uiState.selectedPlannerPresetId!;
    const withSecondPreset = appReducer(initial, { type: "create-planner-preset", name: "Alt Week" });
    const secondPresetId = withSecondPreset.uiState.selectedPlannerPresetId!;

    const deletedSelected = appReducer(withSecondPreset, {
      type: "delete-planner-preset",
      presetId: secondPresetId,
    });

    expect(deletedSelected.plannerPresets[firstPresetId]).toBeDefined();
    expect(deletedSelected.uiState.selectedPlannerPresetId).toBe(firstPresetId);

    const recreated = appReducer(
      {
        ...initial,
        uiState: { ...initial.uiState, lastView: "planner" },
      },
      {
        type: "delete-planner-preset",
        presetId: firstPresetId,
      },
    );

    expect(Object.keys(recreated.plannerPresets)).toHaveLength(1);
    expect(recreated.uiState.selectedPlannerPresetId).toBeTruthy();
    expect(recreated.uiState.lastView).toBe("planner");
  });
});

describe("AppProvider theme class behavior", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  test("applies dark class for explicit dark and removes for light", async () => {
    installMatchMedia(false);
    renderWithProviders();
    expect(await screen.findByTestId("theme-mode")).toHaveTextContent("system");

    await userEvent.click(screen.getByRole("button", { name: "dark" }));
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: "light" }));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  test("system mode follows matchMedia and updates on preference change", async () => {
    const media = installMatchMedia(false);
    renderWithProviders();
    expect(await screen.findByTestId("theme-mode")).toHaveTextContent("system");

    await userEvent.click(screen.getByRole("button", { name: "system" }));
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    act(() => {
      media.setMatches(true);
    });

    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  test("renders auth gate until the user signs in", async () => {
    const auth = createMockAuthRepository(null);
    const persistence = createMockPersistenceRepository(createInitialState("2026-03-11"));

    render(
      <AuthProvider repository={auth.repository}>
        <AppProvider repository={persistence.repository}>
          <Harness />
        </AppProvider>
      </AuthProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "Sign in to your DailyTodo workspace" }),
    ).toBeInTheDocument();
    expect(persistence.repository.load).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText("Email"), "test@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getAllByRole("button", { name: "Sign in" })[1]);

    expect(await screen.findByTestId("theme-mode")).toHaveTextContent("system");
    expect(persistence.repository.load).toHaveBeenCalledWith({
      userId: "user_1",
      now: expect.any(Date),
    });
  });

  test("keeps editing available when persistence save fails", async () => {
    installMatchMedia(false);
    const auth = createMockAuthRepository({
      userId: "user_1",
      email: "test@example.com",
      isVerified: true,
      accessToken: "token_1",
    });
    const persistence = createMockPersistenceRepository(createInitialState("2026-03-11"));
    persistence.repository.save = vi.fn(async () => {
      throw new Error("network down");
    });

    render(
      <AuthProvider repository={auth.repository}>
        <AppProvider repository={persistence.repository}>
          <Harness />
        </AppProvider>
      </AuthProvider>,
    );

    expect(await screen.findByTestId("theme-mode")).toHaveTextContent("system");

    await userEvent.click(screen.getByRole("button", { name: "dark" }));
    expect(screen.getByTestId("theme-mode")).toHaveTextContent("dark");
  });
});

import { beforeEach, describe, expect, test, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProvider, appReducer, useAppState } from "@/components/app-context";
import { createInitialState } from "@/lib/store";

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

describe("appReducer theme mode", () => {
  test("updates themeMode with set-theme-mode action", () => {
    const initial = createInitialState("2026-03-11");
    const next = appReducer(initial, { type: "set-theme-mode", themeMode: "dark" });
    expect(next.uiState.themeMode).toBe("dark");
  });
});

describe("AppProvider theme class behavior", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  test("applies dark class for explicit dark and removes for light", async () => {
    installMatchMedia(false);
    render(
      <AppProvider>
        <Harness />
      </AppProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "dark" }));
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: "light" }));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  test("system mode follows matchMedia and updates on preference change", async () => {
    const media = installMatchMedia(false);
    render(
      <AppProvider>
        <Harness />
      </AppProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "system" }));
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    act(() => {
      media.setMatches(true);
    });

    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});

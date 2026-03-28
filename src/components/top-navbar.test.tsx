import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { AuthProvider } from "@/components/auth-context";
import { TopNavbar } from "@/components/top-navbar";
import { createInitialState } from "@/lib/store";
import { createMockAuthRepository } from "@/test/repositories";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
}));

describe("TopNavbar", () => {
  test("shows sidebar toggle in daily and planner views", async () => {
    const dispatch = vi.fn();
    const auth = createMockAuthRepository({
      userId: "user_1",
      email: "test@example.com",
      accessToken: "token_1",
    });
    const dailyState = createInitialState("2026-03-10");
    const plannerState = createInitialState("2026-03-10");
    plannerState.uiState.lastView = "planner";

    const { rerender } = render(
      <AuthProvider repository={auth.repository}>
        <TopNavbar state={dailyState} dispatch={dispatch} />
      </AuthProvider>,
    );
    expect(await screen.findByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument();

    rerender(
      <AuthProvider repository={auth.repository}>
        <TopNavbar state={plannerState} dispatch={dispatch} />
      </AuthProvider>,
    );
    expect(await screen.findByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument();
  });

  test("dispatches sidebar toggle action", async () => {
    const dispatch = vi.fn();
    const auth = createMockAuthRepository({
      userId: "user_1",
      email: "test@example.com",
      accessToken: "token_1",
    });
    const state = createInitialState("2026-03-10");

    render(
      <AuthProvider repository={auth.repository}>
        <TopNavbar state={state} dispatch={dispatch} />
      </AuthProvider>,
    );

    await userEvent.click(await screen.findByRole("button", { name: "Collapse sidebar" }));
    expect(dispatch).toHaveBeenCalledWith({ type: "toggle-sidebar-collapsed" });
  });
});

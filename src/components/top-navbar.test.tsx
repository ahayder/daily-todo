import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { TopNavbar } from "@/components/top-navbar";
import { createInitialState } from "@/lib/store";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
}));

describe("TopNavbar", () => {
  test("shows sidebar toggle in daily and planner views", () => {
    const dispatch = vi.fn();
    const dailyState = createInitialState("2026-03-10");
    const plannerState = createInitialState("2026-03-10");
    plannerState.uiState.lastView = "planner";

    const { rerender } = render(<TopNavbar state={dailyState} dispatch={dispatch} />);
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument();

    rerender(<TopNavbar state={plannerState} dispatch={dispatch} />);
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument();
  });

  test("dispatches sidebar toggle action", async () => {
    const dispatch = vi.fn();
    const state = createInitialState("2026-03-10");

    render(<TopNavbar state={state} dispatch={dispatch} />);

    await userEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(dispatch).toHaveBeenCalledWith({ type: "toggle-sidebar-collapsed" });
  });
});

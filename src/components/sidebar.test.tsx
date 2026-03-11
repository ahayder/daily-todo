import { useReducer, type ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { Sidebar } from "@/components/sidebar";
import { appReducer } from "@/components/app-context";
import { createInitialState } from "@/lib/store";
import { getDayLabel, toISODate } from "@/lib/date";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
}));

function Harness() {
  const initial = createInitialState("2026-03-10");
  initial.dailyPages["2026-03-11"] = {
    date: "2026-03-11",
    markdown: "",
    drawingStrokes: [],
    todos: [],
  };

  const [state, dispatch] = useReducer(appReducer, initial);
  return <Sidebar state={state} dispatch={dispatch} />;
}

describe("Sidebar", () => {
  test("shows active nav, supports Today quick nav, and toggles theme mode", async () => {
    render(<Harness />);

    const dailyLink = screen.getByRole("link", { name: "DailyTodo" });
    expect(dailyLink).toHaveClass("is-active");

    const todayLink = screen.getByRole("link", { name: "Today" });
    await userEvent.click(todayLink);

    const todayLabel = getDayLabel(toISODate(new Date()));
    expect(screen.getByText(todayLabel)).toBeInTheDocument();

    const darkModeButton = screen.getByRole("button", { name: "Dark" });
    await userEvent.click(darkModeButton);
    expect(darkModeButton).toHaveAttribute("aria-pressed", "true");
  });
});

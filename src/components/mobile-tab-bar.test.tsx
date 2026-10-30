import type { ComponentProps } from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { MobileTabBar } from "@/components/workspace/mobile-tab-bar";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
}));

describe("MobileTabBar", () => {
  test("shows the four main areas and highlights Today on standup", () => {
    render(<MobileTabBar view="standup" dispatch={vi.fn()} />);

    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    expect(within(nav).getByRole("link", { name: "Today" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Notes" })).toHaveAttribute("href", "/notes");
    expect(within(nav).getByRole("link", { name: "Memory" })).toHaveAttribute("href", "/memory");
    expect(within(nav).getByRole("link", { name: "Content Planner" })).not.toHaveAttribute("aria-current");
  });

  test("highlights Content Planner there, and Today on the daily planner", () => {
    const { rerender } = render(<MobileTabBar view="content-planner" dispatch={vi.fn()} />);

    expect(screen.getByRole("link", { name: "Content Planner" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Today" })).not.toHaveAttribute("aria-current");

    rerender(<MobileTabBar view="planner" dispatch={vi.fn()} />);

    expect(screen.getByRole("link", { name: "Today" })).toHaveAttribute("aria-current", "page");
  });
});

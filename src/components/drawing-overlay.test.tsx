import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { DrawingOverlay } from "@/components/drawing-overlay";

describe("DrawingOverlay", () => {
  test("renders floating controls and toggles tool buttons", async () => {
    const onChange = vi.fn();
    render(<DrawingOverlay strokes={[]} onChange={onChange} />);

    const toggleButton = screen.getByRole("button", { name: "Enable drawing" });
    expect(toggleButton).toBeInTheDocument();

    expect(screen.queryByRole("button", { name: "Pen tool" })).not.toBeInTheDocument();
    await userEvent.click(toggleButton);

    expect(screen.getByRole("button", { name: "Disable drawing" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pen tool" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Eraser tool" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear drawing" })).toBeInTheDocument();
  });
});

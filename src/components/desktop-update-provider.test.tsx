import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { DesktopUpdateProvider, useDesktopUpdate } from "@/components/desktop-update-provider";

const mockCheck = vi.fn();
const mockGetName = vi.fn();
const mockGetVersion = vi.fn();
const mockRelaunch = vi.fn();
const mockIsTauri = vi.fn();

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: () => mockCheck(),
}));

vi.mock("@tauri-apps/api/app", () => ({
  getName: () => mockGetName(),
  getVersion: () => mockGetVersion(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => mockIsTauri(),
}));

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: () => mockRelaunch(),
}));

function Harness({ children }: { children?: ReactNode }) {
  const desktopUpdate = useDesktopUpdate();

  return (
    <>
      {children}
      <button type="button" onClick={() => void desktopUpdate.checkForUpdates({ userInitiated: true })}>
        Check now
      </button>
      <button type="button" onClick={desktopUpdate.openDialog}>
        Open dialog
      </button>
    </>
  );
}

describe("DesktopUpdateProvider", () => {
  beforeEach(() => {
    mockIsTauri.mockReturnValue(true);
    mockGetName.mockResolvedValue("DailyTodoApp");
    mockGetVersion.mockResolvedValue("0.1.0");
    mockRelaunch.mockReset();
    mockCheck.mockReset();
  });

  test("shows an available update and installs it after confirmation", async () => {
    const downloadAndInstall = vi.fn(async (onEvent?: (event: { event: string; data?: { contentLength?: number; chunkLength?: number } }) => void) => {
      onEvent?.({ event: "Started", data: { contentLength: 100 } });
      onEvent?.({ event: "Progress", data: { chunkLength: 60 } });
      onEvent?.({ event: "Progress", data: { chunkLength: 40 } });
      onEvent?.({ event: "Finished" });
    });

    mockCheck.mockResolvedValue({
      body: "Bug fixes and update plumbing.",
      currentVersion: "0.1.0",
      version: "0.1.1",
      close: vi.fn(),
      downloadAndInstall,
    });

    render(
      <DesktopUpdateProvider>
        <Harness />
      </DesktopUpdateProvider>,
    );

    expect(await screen.findByText("Update ready for DailyTodoApp")).toBeInTheDocument();
    expect(screen.getByRole("alertdialog")).toHaveTextContent(/Version\s+0\.1\.1/i);

    await userEvent.click(screen.getByRole("button", { name: "Update Now" }));

    await waitFor(() => {
      expect(downloadAndInstall).toHaveBeenCalled();
      expect(mockRelaunch).toHaveBeenCalled();
    });
  });

  test("surfaces a no-update manual check without opening the dialog", async () => {
    mockCheck.mockResolvedValue(null);

    render(
      <DesktopUpdateProvider>
        <Harness />
      </DesktopUpdateProvider>,
    );

    await waitFor(() => {
      expect(mockCheck).toHaveBeenCalled();
    });
    const initialCalls = mockCheck.mock.calls.length;

    await userEvent.click(screen.getByRole("button", { name: "Check now" }));

    await waitFor(() => {
      expect(mockCheck).toHaveBeenCalledTimes(initialCalls + 1);
    });

    expect(screen.queryByText("Update ready for DailyTodoApp")).not.toBeInTheDocument();
  });

  test("shows an actionable error when the update feed is unreachable", async () => {
    mockCheck.mockRejectedValue(new Error("404 Not Found"));

    render(
      <DesktopUpdateProvider>
        <Harness />
      </DesktopUpdateProvider>,
    );

    await userEvent.click(await screen.findByRole("button", { name: "Check now" }));

    expect(await screen.findByText("Updater needs attention")).toBeInTheDocument();
    expect(
      screen.getByText(/The update feed could not be reached\./i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/private GitHub repo/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText("The app could not reach the configured update feed."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry Check" })).toBeInTheDocument();
  });
});

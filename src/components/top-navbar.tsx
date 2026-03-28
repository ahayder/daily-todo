"use client";

import Link from "next/link";
import {
  Check,
  Download,
  LoaderCircle,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
} from "lucide-react";
import { useMemo, useState, useSyncExternalStore, type Dispatch } from "react";
import type { AppAction } from "@/components/app-context";
import { useDesktopUpdate } from "@/components/desktop-update-provider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AppState } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  sync: {
    status: "idle" | "loading" | "syncing" | "synced" | "offline" | "error";
    indicator: "saved" | "saving" | "unsynced" | "issue";
    lastSavedAt: string | null;
    lastSyncedAt: string | null;
    notice: string | null;
    errorMessage: string | null;
    hasPendingChanges: boolean;
    hasUnsyncedChanges: boolean;
    isSaving: boolean;
    persistenceAvailable: boolean;
  };
  retrySync: () => Promise<void>;
};

function formatLastSynced(lastSyncedAt: string | null) {
  if (!lastSyncedAt) return "Not synced yet";

  const date = new Date(lastSyncedAt);
  if (Number.isNaN(date.getTime())) return "Not synced yet";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatRelativeLastSaved(lastSyncedAt: string | null) {
  if (!lastSyncedAt) return "Last saved never";

  const date = new Date(lastSyncedAt);
  if (Number.isNaN(date.getTime())) return "Last saved never";

  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return "Last saved just now";

  const secondMs = 1000;
  const minuteMs = 60 * secondMs;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  if (diffMs < minuteMs) {
    const seconds = Math.max(1, Math.floor(diffMs / secondMs));
    return `Last saved ${seconds}s ago`;
  }

  if (diffMs < hourMs) {
    return `Last saved ${Math.floor(diffMs / minuteMs)}m ago`;
  }

  if (diffMs < dayMs) {
    return `Last saved ${Math.floor(diffMs / hourMs)}h ago`;
  }

  return `Last saved ${formatLastSynced(lastSyncedAt)}`;
}

export function TopNavbar({ state, dispatch, sync, retrySync }: Props) {
  const desktopUpdate = useDesktopUpdate();
  const [isRetrying, setIsRetrying] = useState(false);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const lastView = state.uiState.lastView;
  const isDaily = !mounted || lastView === "daily";
  const isNotes = mounted && lastView === "notes";
  const isPlanner = mounted && lastView === "planner";
  const SidebarIcon = state.uiState.isSidebarCollapsed ? PanelLeftOpen : PanelLeftClose;
  const showDesktopUpdater = mounted && desktopUpdate.isSupported;

  const desktopUpdateLabel =
    desktopUpdate.phase === "downloading"
      ? "Downloading update"
      : desktopUpdate.phase === "installing"
        ? "Installing update"
        : desktopUpdate.phase === "relaunching"
          ? "Restarting app"
          : desktopUpdate.phase === "checking"
            ? "Checking for updates"
            : desktopUpdate.phase === "up-to-date"
              ? "DailyTodo is up to date"
              : desktopUpdate.phase === "error"
                ? "Updater needs attention"
                : desktopUpdate.isUpdateAvailable
                  ? `Install update ${desktopUpdate.latestVersion ?? ""}`.trim()
                  : `Check for updates${desktopUpdate.currentVersion ? ` (${desktopUpdate.currentVersion})` : ""}`;

  const DesktopUpdateIcon =
    desktopUpdate.phase === "checking" ||
    desktopUpdate.phase === "downloading" ||
    desktopUpdate.phase === "installing" ||
    desktopUpdate.phase === "relaunching"
      ? LoaderCircle
      : desktopUpdate.isUpdateAvailable
        ? Download
        : desktopUpdate.phase === "up-to-date"
          ? Check
          : RefreshCw;

  const syncPresentation = useMemo(() => {
    if (sync.indicator === "saving") {
      return {
        label: "Saving…",
        detail: sync.notice ?? "Your latest changes will be saved to PocketBase automatically.",
        tone: "text-[var(--brand)]",
      };
    }

    if (sync.indicator === "unsynced") {
      return {
        label: formatRelativeLastSaved(sync.lastSavedAt),
        detail:
          sync.errorMessage ??
          sync.notice ??
          "Your latest state is still on this device and not yet confirmed in PocketBase.",
        tone: "text-[color:color-mix(in_srgb,var(--brand)_70%,var(--ink-700))]",
      };
    }

    if (sync.indicator === "issue") {
      return {
        label: "Sync issue",
        detail: sync.errorMessage ?? sync.notice ?? "We couldn’t verify your sync state right now.",
        tone: "text-[color:color-mix(in_srgb,var(--brand)_58%,var(--ink-700))]",
      };
    }

    return {
      label: formatRelativeLastSaved(sync.lastSavedAt),
      detail: sync.notice ?? "Your current workspace state is saved to PocketBase.",
      tone: "text-[var(--ink-700)]",
    };
  }, [sync.errorMessage, sync.indicator, sync.lastSavedAt, sync.notice]);

  return (
    <header className="top-navbar">
      <div className="flex items-center gap-2.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => dispatch({ type: "toggle-sidebar-collapsed" })}
              aria-label={state.uiState.isSidebarCollapsed ? "Open sidebar" : "Collapse sidebar"}
              className="theme-cycle-btn"
            >
              <SidebarIcon className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {state.uiState.isSidebarCollapsed ? "Open sidebar" : "Collapse sidebar"}
          </TooltipContent>
        </Tooltip>
        <div className="app-logo" aria-hidden="true" />
        <span className="text-[15px] font-semibold tracking-wide text-[var(--ink-900)]">
          DailyTodo
        </span>
      </div>

      <nav className="nav-pills" role="tablist" aria-label="Main navigation">
        <Link
          href="/daily"
          role="tab"
          aria-selected={isDaily}
          className={cn("nav-pill", isDaily && "nav-pill--active")}
          onClick={() => dispatch({ type: "set-view", view: "daily" })}
        >
          Daily
        </Link>
        <Link
          href="/notes"
          role="tab"
          aria-selected={isNotes}
          className={cn("nav-pill", isNotes && "nav-pill--active")}
          onClick={() => dispatch({ type: "set-view", view: "notes" })}
        >
          Notes
        </Link>
        <Link
          href="/planner"
          role="tab"
          aria-selected={isPlanner}
          className={cn("nav-pill", isPlanner && "nav-pill--active")}
          onClick={() => dispatch({ type: "set-view", view: "planner" })}
        >
          Planner
        </Link>
      </nav>

      <div className="flex items-center gap-1">
        <div
          aria-live="polite"
          className={cn(
            "inline-flex min-h-8 items-center px-1 text-xs font-medium",
            syncPresentation.tone,
          )}
        >
          <span>{syncPresentation.label}</span>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Force sync now"
              className="theme-cycle-btn"
              disabled={isRetrying}
              onClick={async () => {
                try {
                  setIsRetrying(true);
                  await retrySync();
                } finally {
                  setIsRetrying(false);
                }
              }}
            >
              <RefreshCw className={cn("h-4 w-4", (isRetrying || sync.isSaving) && "animate-spin")} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Force sync now
          </TooltipContent>
        </Tooltip>

        {showDesktopUpdater ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => {
                  if (desktopUpdate.isUpdateAvailable) {
                    desktopUpdate.openDialog();
                    return;
                  }

                  void desktopUpdate.checkForUpdates({ userInitiated: true });
                }}
                aria-label={desktopUpdateLabel}
                className={cn(
                  "theme-cycle-btn relative",
                  desktopUpdate.isUpdateAvailable && "bg-[var(--brand-soft)] text-[var(--brand)]",
                  desktopUpdate.phase === "error" &&
                    "bg-[color-mix(in_srgb,var(--warn)_10%,transparent)] text-[var(--warn)]",
                )}
              >
                <DesktopUpdateIcon
                  className={cn(
                    "h-4 w-4",
                    (desktopUpdate.phase === "checking" ||
                      desktopUpdate.phase === "downloading" ||
                      desktopUpdate.phase === "installing" ||
                      desktopUpdate.phase === "relaunching") &&
                      "animate-spin",
                  )}
                />
                {desktopUpdate.isUpdateAvailable ? (
                  <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-[var(--brand)]" />
                ) : null}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {desktopUpdateLabel}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import {
  Check,
  Download,
  Lightbulb,
  LoaderCircle,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  MonitorDown,
} from "lucide-react";
import { useMemo, useState, useSyncExternalStore, type Dispatch } from "react";
import type { AppAction } from "@/components/app/app-context";
import { useDesktopUpdate } from "@/components/workspace/desktop-update-provider";
import { MAIN_NAV } from "@/components/workspace/main-nav";
import {
  CONTENT_FONT_SCALE_MAX,
  CONTENT_FONT_SCALE_MIN,
} from "@/lib/content-font-scale";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AppContextValue } from "@/components/app/app-context.types";
import type { AppState } from "@/lib/types";
import { cn } from "@/lib/utils";
import { isFullWidthView } from "@/lib/views";

type Props = {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  sync: AppContextValue["sync"];
  retrySync: () => Promise<void>;
  onOpenChangeRequests: () => void;
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

const navPillClass =
  "inline-flex h-8 items-center rounded-full px-4 text-[0.8125rem] font-semibold whitespace-nowrap transition-[color,background-color] outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring";
const navPillActiveClass = "bg-primary text-primary-foreground";
const navPillIdleClass = "text-muted-foreground hover:bg-card hover:text-foreground";

export function TopNavbar({ state, dispatch, sync, retrySync, onOpenChangeRequests }: Props) {
  const desktopUpdate = useDesktopUpdate();
  const [isRetrying, setIsRetrying] = useState(false);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const lastView = state.uiState.lastView;
  // Before mount the synced view isn't known yet, so Today (the home) is highlighted.
  const activeView = mounted ? lastView : "today";
  const hasNoSidebar = mounted && isFullWidthView(lastView);
  const isContentPlanner = mounted && lastView === "content-planner";
  const SidebarIcon = state.uiState.isSidebarCollapsed ? PanelLeftOpen : PanelLeftClose;
  const showDesktopUpdater = mounted && desktopUpdate.isSupported;
  const isDecreaseFontDisabled = state.uiState.contentFontScale <= CONTENT_FONT_SCALE_MIN;
  const isIncreaseFontDisabled = state.uiState.contentFontScale >= CONTENT_FONT_SCALE_MAX;

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
          : MonitorDown;

  const syncPresentation = useMemo(() => {
    if (sync.indicator === "loading") {
      return {
        label: "Loading latest…",
        detail: "Showing this device’s copy. Editing unlocks once the latest data arrives.",
        tone: "text-muted-foreground",
      };
    }

    if (sync.indicator === "offline-readonly") {
      return {
        label: "Offline · read-only",
        detail: sync.notice ?? "Can’t reach the server. Editing unlocks when it’s back.",
        tone: "text-foreground",
        dot: "bg-warning",
      };
    }

    if (sync.indicator === "saving") {
      return {
        label: "Saving…",
        detail: sync.notice ?? "Your latest changes are being saved to the cloud.",
        tone: "text-primary",
      };
    }

    if (sync.indicator === "unsynced") {
      return {
        label:
          sync.pendingCount === 1 ? "1 change waiting" : `${sync.pendingCount} changes waiting`,
        detail:
          sync.errorMessage ??
          sync.notice ??
          "Saved on this device. It will reach the cloud as soon as the server is reachable.",
        tone: "text-muted-foreground",
      };
    }

    if (sync.indicator === "issue") {
      return {
        label: "Sync issue",
        detail: sync.errorMessage ?? sync.notice ?? "We couldn’t verify your sync state right now.",
        tone: "text-foreground",
        dot: "bg-warning",
      };
    }

    return {
      label: formatRelativeLastSaved(sync.lastSavedAt),
      detail: sync.notice ?? "Everything is saved to the cloud.",
      tone: "text-muted-foreground",
    };
  }, [sync.errorMessage, sync.indicator, sync.lastSavedAt, sync.notice, sync.pendingCount]);

  return (
    <header
      className={cn(
        "top-navbar",
        isContentPlanner && "top-navbar--content-planner",
      )}
    >
      <div className="top-navbar__brand flex items-center gap-2.5">
        {/* Full-width pages have no sidebar, so no toggle either. */}
        {!hasNoSidebar ? (
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
            <TooltipContent side="bottom" className="text-[0.8125rem]">
              {state.uiState.isSidebarCollapsed ? "Open sidebar" : "Collapse sidebar"}
            </TooltipContent>
          </Tooltip>
        ) : null}
        <div className="app-logo" aria-hidden="true" />
        <span className="text-[15px] font-semibold tracking-wide text-foreground">
          DailyTodo
        </span>
      </div>

      <nav aria-label="Main navigation" className="max-md:hidden">
        <ul className="flex items-center gap-1 rounded-full bg-muted p-1">
          {MAIN_NAV.map((item) => {
            const isActive = item.isActive(activeView);
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(navPillClass, isActive ? navPillActiveClass : navPillIdleClass)}
                  onClick={() => dispatch({ type: "set-view", view: item.view })}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="top-navbar__actions flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Change request"
              aria-keyshortcuts="Meta+Shift+I Control+Shift+I"
              className="theme-cycle-btn"
              onClick={onOpenChangeRequests}
            >
              <Lightbulb className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-[0.8125rem]">
            Change request (⌘⇧I)
          </TooltipContent>
        </Tooltip>

        <div
          aria-live="polite"
          className={cn(
            "top-navbar__sync inline-flex min-h-8 items-center px-1 text-[0.8125rem] font-medium",
            sync.indicator !== "saved" && sync.indicator !== "saving" && "top-navbar__sync--attention",
            syncPresentation.tone,
          )}
          title={syncPresentation.detail}
        >
          {"dot" in syncPresentation ? (
            <span aria-hidden="true" className={cn("mr-1.5 size-2 rounded-full", syncPresentation.dot)} />
          ) : null}
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
          <TooltipContent side="bottom" className="text-[0.8125rem]">
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
                  desktopUpdate.isUpdateAvailable && "bg-brand-subtle text-brand-subtle-foreground",
                  desktopUpdate.phase === "error" &&
                    "bg-destructive/10 text-destructive",
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
                  <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary" />
                ) : null}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-[0.8125rem]">
              {desktopUpdateLabel}
            </TooltipContent>
          </Tooltip>
        ) : null}

        <div
          className={cn(
            "flex items-center",
            isContentPlanner && "max-sm:hidden",
          )}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Decrease font size"
                className="theme-cycle-btn"
                disabled={isDecreaseFontDisabled}
                onClick={() => dispatch({ type: "decrease-content-font-scale" })}
              >
                <span
                  aria-hidden="true"
                  className="text-[13px] font-semibold tracking-[-0.04em] text-current"
                >
                  A−
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-[0.8125rem]">
              Decrease font size
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Increase font size"
                className="theme-cycle-btn"
                disabled={isIncreaseFontDisabled}
                onClick={() => dispatch({ type: "increase-content-font-scale" })}
              >
                <span
                  aria-hidden="true"
                  className="text-[13px] font-semibold tracking-[-0.04em] text-current"
                >
                  A+
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-[0.8125rem]">
              Increase font size
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </header>
  );
}

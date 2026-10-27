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
import { useEffect, useMemo, useState, useSyncExternalStore, type Dispatch } from "react";
import type { AppAction } from "@/components/app/app-context";
import { useDesktopUpdate } from "@/components/workspace/desktop-update-provider";
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

type Props = {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  sync: AppContextValue["sync"];
  retrySync: () => Promise<void>;
  onOpenAppNotes: () => void;
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

export function TopNavbar({ state, dispatch, sync, retrySync, onOpenAppNotes }: Props) {
  const desktopUpdate = useDesktopUpdate();
  const [isRetrying, setIsRetrying] = useState(false);
  const [isMobileHeaderHidden, setIsMobileHeaderHidden] = useState(false);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const lastView = state.uiState.lastView;
  // History is opened from Today, so it keeps Today highlighted.
  const isToday = !mounted || lastView === "today" || lastView === "history" || lastView === "standup";
  const isMemory = mounted && (lastView === "memory" || lastView === "project");
  const isTodos = mounted && lastView === "todos";
  const hasNoSidebar =
    mounted && ["today", "history", "memory", "project", "standup"].includes(lastView);
  const isNotes = mounted && lastView === "notes";
  const isPlanner = mounted && lastView === "planner";
  const isContentPlanner = mounted && lastView === "content-planner";
  const SidebarIcon = state.uiState.isSidebarCollapsed ? PanelLeftOpen : PanelLeftClose;
  const showDesktopUpdater = mounted && desktopUpdate.isSupported;
  const isDecreaseFontDisabled = state.uiState.contentFontScale <= CONTENT_FONT_SCALE_MIN;
  const isIncreaseFontDisabled = state.uiState.contentFontScale >= CONTENT_FONT_SCALE_MAX;

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;

    const mobileViewport = window.matchMedia("(max-width: 639px)");
    const scrollPositions = new WeakMap<EventTarget, number>();

    const handleScroll = (event: Event) => {
      const scrollTarget = event.target;
      if (!scrollTarget) return;

      const scrollTop =
        scrollTarget === document
          ? window.scrollY
          : scrollTarget instanceof Element
            ? scrollTarget.scrollTop
            : null;

      if (scrollTop === null) return;

      const previousScrollTop = scrollPositions.get(scrollTarget) ?? 0;
      scrollPositions.set(scrollTarget, scrollTop);
      const isAtBottom =
        scrollTarget instanceof Element &&
        scrollTop >= scrollTarget.scrollHeight - scrollTarget.clientHeight - 2;

      if (!mobileViewport.matches) {
        setIsMobileHeaderHidden(false);
        return;
      }

      if (scrollTop <= 8) {
        if (previousScrollTop > 8) {
          setIsMobileHeaderHidden(false);
        }
        return;
      }

      if (scrollTop > previousScrollTop + 4) {
        setIsMobileHeaderHidden(true);
      } else if (scrollTop < previousScrollTop - 4 && !isAtBottom) {
        setIsMobileHeaderHidden(false);
      }
    };

    const handleViewportChange = () => {
      if (!mobileViewport.matches) {
        setIsMobileHeaderHidden(false);
      }
    };

    document.addEventListener("scroll", handleScroll, true);
    mobileViewport.addEventListener("change", handleViewportChange);

    return () => {
      document.removeEventListener("scroll", handleScroll, true);
      mobileViewport.removeEventListener("change", handleViewportChange);
    };
  }, []);

  useEffect(() => {
    setIsMobileHeaderHidden(false);
  }, [lastView]);

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
        isMobileHeaderHidden && "top-navbar--mobile-hidden",
      )}
    >
      <div className="top-navbar__brand flex items-center gap-2.5">
        {/* Today and History have no sidebar, so no toggle either. */}
        {!isContentPlanner && !hasNoSidebar ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => dispatch({ type: "toggle-sidebar-collapsed" })}
                aria-label={state.uiState.isSidebarCollapsed ? "Open sidebar" : "Collapse sidebar"}
                data-planner-tour={isPlanner ? "sidebar-toggle" : undefined}
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

      <nav className="nav-pills" role="tablist" aria-label="Main navigation">
        <Link
          href="/today"
          role="tab"
          aria-selected={isToday}
          className={cn("nav-pill", isToday && "nav-pill--active")}
          onClick={() => dispatch({ type: "set-view", view: "today" })}
        >
          Today
        </Link>
        <Link
          href="/memory"
          role="tab"
          aria-selected={isMemory}
          className={cn("nav-pill", isMemory && "nav-pill--active")}
          onClick={() => dispatch({ type: "set-view", view: "memory" })}
        >
          Memory
        </Link>
        <Link
          href="/todos"
          role="tab"
          aria-selected={isTodos}
          className={cn("nav-pill", isTodos && "nav-pill--active")}
          onClick={() => dispatch({ type: "set-view", view: "todos" })}
        >
          Todos
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
          Daily Planner
        </Link>
        <Link
          href="/content-planner"
          role="tab"
          aria-selected={isContentPlanner}
          className={cn("nav-pill", isContentPlanner && "nav-pill--active")}
          onClick={() => dispatch({ type: "set-view", view: "content-planner" })}
        >
          Content Planner
        </Link>
      </nav>

      <div className="top-navbar__actions flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Note for the app"
              aria-keyshortcuts="Meta+Shift+I Control+Shift+I"
              className="theme-cycle-btn"
              onClick={onOpenAppNotes}
            >
              <Lightbulb className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-[0.8125rem]">
            Note for the app (⌘⇧I)
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

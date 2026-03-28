"use client";

import Link from "next/link";
import {
  Brain,
  Check,
  CloudOff,
  Download,
  LoaderCircle,
  LogOut,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Sun,
  Target,
  TriangleAlert,
} from "lucide-react";
import { useMemo, useState, useSyncExternalStore, type Dispatch } from "react";
import type { AppAction } from "@/components/app-context";
import { useAuth } from "@/components/auth-context";
import { useDesktopUpdate } from "@/components/desktop-update-provider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AppState, CategoryTheme, ThemeMode } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  sync: {
    status: "idle" | "loading" | "syncing" | "synced" | "offline" | "error";
    lastSyncedAt: string | null;
    notice: string | null;
    errorMessage: string | null;
    hasPendingChanges: boolean;
    persistenceAvailable: boolean;
  };
  retrySync: () => Promise<void>;
};

const THEME_ICONS: Record<ThemeMode, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

const THEME_CYCLE: ThemeMode[] = ["light", "dark", "system"];
const CATEGORY_CYCLE: CategoryTheme[] = ["normal", "adhd1", "adhd2"];
const CATEGORY_TOOLTIP: Record<CategoryTheme, string> = {
  normal: "Labels: Normal",
  adhd1: "Labels: ADHD 1",
  adhd2: "Labels: ADHD 2",
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

export function TopNavbar({ state, dispatch, sync, retrySync }: Props) {
  const desktopUpdate = useDesktopUpdate();
  const { session, signOut } = useAuth();
  const [isSyncPanelOpen, setIsSyncPanelOpen] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const themeMode = mounted ? state.uiState.themeMode : "system";
  const ThemeIcon = THEME_ICONS[themeMode];
  const categoryTheme = mounted ? state.uiState.categoryTheme : "normal";

  const cycleTheme = () => {
    const currentIndex = THEME_CYCLE.indexOf(themeMode);
    const next = THEME_CYCLE[(currentIndex + 1) % THEME_CYCLE.length];
    dispatch({ type: "set-theme-mode", themeMode: next });
  };

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
    if (sync.status === "syncing" || sync.status === "loading") {
      return {
        label: "Syncing…",
        detail: sync.notice ?? "Saving your latest changes to PocketBase.",
        icon: LoaderCircle,
        tone: "text-[var(--brand)] bg-[var(--brand-soft)] border-[color:color-mix(in_srgb,var(--brand)_18%,transparent)]",
        animate: true,
      };
    }

    if (sync.status === "offline") {
      return {
        label: "Offline",
        detail: sync.notice ?? "Saved on this device until PocketBase comes back.",
        icon: CloudOff,
        tone: "text-[var(--ink-700)] bg-[color:color-mix(in_srgb,var(--ink-700)_8%,transparent)] border-[var(--line)]",
        animate: false,
      };
    }

    if (sync.status === "error") {
      return {
        label: "Sync needs attention",
        detail: sync.errorMessage ?? "Changes may not persist yet.",
        icon: TriangleAlert,
        tone: "text-[var(--warn)] bg-[color:color-mix(in_srgb,var(--warn)_10%,transparent)] border-[color:color-mix(in_srgb,var(--warn)_16%,transparent)]",
        animate: false,
      };
    }

    return {
      label: "Synced",
      detail: sync.notice ?? "Your workspace is up to date.",
      icon: Check,
      tone: "text-[var(--brand)] bg-[color:color-mix(in_srgb,var(--brand-soft)_70%,white)] border-[color:color-mix(in_srgb,var(--brand)_18%,transparent)]",
      animate: false,
    };
  }, [sync.errorMessage, sync.notice, sync.status]);

  const SyncIcon = syncPresentation.icon;

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

      <div className="relative flex items-center gap-1">
        <button
          type="button"
          aria-label="Open sync status"
          onClick={() => setIsSyncPanelOpen((current) => !current)}
          className={cn(
            "inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition",
            syncPresentation.tone,
          )}
        >
          <SyncIcon className={cn("h-3.5 w-3.5", syncPresentation.animate && "animate-spin")} />
          <span>{syncPresentation.label}</span>
        </button>

        {isSyncPanelOpen ? (
          <div className="absolute top-11 right-0 z-30 w-72 rounded-2xl border border-[var(--line)] bg-[color:color-mix(in_srgb,var(--paper-strong)_96%,white)] p-4 shadow-[0_24px_80px_rgba(31,36,48,0.12)]">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[var(--ink-900)]">{syncPresentation.label}</p>
                <p className="text-xs leading-5 text-[var(--ink-700)]">{syncPresentation.detail}</p>
              </div>
              <SyncIcon className={cn("mt-0.5 h-4 w-4 shrink-0", syncPresentation.animate && "animate-spin", sync.status === "error" ? "text-[var(--warn)]" : "text-[var(--brand)]")} />
            </div>

            <div className="mt-4 space-y-2 rounded-2xl border border-[var(--line)] bg-[color:color-mix(in_srgb,var(--paper)_65%,white)] p-3 text-xs text-[var(--ink-700)]">
              <p>Last sync: {formatLastSynced(sync.lastSyncedAt)}</p>
              <p>{sync.persistenceAvailable ? "Local cache is available on this device." : "Local cache is unavailable on this device."}</p>
              <p>{sync.hasPendingChanges ? "There are unsynced changes waiting to be retried." : "No unsynced local changes are waiting."}</p>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                type="button"
                className="rounded-full px-2 py-1 text-xs font-semibold text-[var(--ink-700)] transition hover:bg-[color:color-mix(in_srgb,var(--ink-700)_6%,transparent)] hover:text-[var(--ink-900)]"
                onClick={() => setIsSyncPanelOpen(false)}
              >
                Close
              </button>
              <button
                type="button"
                disabled={isRetrying}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--brand)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[color:color-mix(in_srgb,var(--brand)_86%,black)] disabled:opacity-60"
                onClick={async () => {
                  try {
                    setIsRetrying(true);
                    await retrySync();
                  } finally {
                    setIsRetrying(false);
                  }
                }}
              >
                {isRetrying ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Retry now
              </button>
            </div>
          </div>
        ) : null}

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

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => {
                dispatch({ type: "set-focus-mode", isFocus: !state.uiState.isFocusMode });
              }}
              aria-label="Toggle Focus Mode"
              className={cn(
                "theme-cycle-btn",
                state.uiState.isFocusMode && "bg-[var(--brand-soft)] text-[var(--brand)]",
              )}
            >
              <Target className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {state.uiState.isFocusMode ? "Exit Focus Mode" : "Enter Focus Mode"}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => {
                const currentIndex = CATEGORY_CYCLE.indexOf(categoryTheme);
                const next = CATEGORY_CYCLE[(currentIndex + 1) % CATEGORY_CYCLE.length];
                dispatch({ type: "set-category-theme", theme: next });
              }}
              aria-label={`Category labels: ${categoryTheme}`}
              className="theme-cycle-btn"
            >
              <Brain className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {CATEGORY_TOOLTIP[categoryTheme]}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={cycleTheme}
              aria-label={`Theme: ${themeMode}`}
              className="theme-cycle-btn"
            >
              <ThemeIcon className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {themeMode === "light"
              ? "Light mode"
              : themeMode === "dark"
                ? "Dark mode"
                : "System theme"}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={async () => {
                try {
                  setIsSigningOut(true);
                  if (sync.hasPendingChanges) {
                    await retrySync();
                  }
                  await signOut();
                } finally {
                  setIsSigningOut(false);
                }
              }}
              aria-label="Sign out"
              className="theme-cycle-btn"
            >
              {isSigningOut ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {session?.email ? `Sign out (${session.email})` : "Sign out"}
          </TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}

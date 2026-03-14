"use client";

import Link from "next/link";
import { Sun, Moon, Monitor, Brain } from "lucide-react";
import { useState, useEffect, type Dispatch } from "react";
import type { AppState, CategoryTheme, ThemeMode } from "@/lib/types";
import type { AppAction } from "@/components/app-context";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Props = {
  state: AppState;
  dispatch: Dispatch<AppAction>;
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

export function TopNavbar({ state, dispatch }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  return (
    <header className="top-navbar">
      {/* Left: App name */}
      <div className="flex items-center gap-2.5">
        <div className="app-logo" aria-hidden="true" />
        <span className="text-[15px] font-semibold tracking-wide text-[var(--ink-900)]">
          DailyTodo
        </span>
      </div>

      {/* Center: View tabs */}
      <nav className="nav-pills" role="tablist" aria-label="Main navigation">
        <Link
          href="/daily"
          role="tab"
          aria-selected={isDaily}
          className={cn(
            "nav-pill",
            isDaily && "nav-pill--active",
          )}
          onClick={() => dispatch({ type: "set-view", view: "daily" })}
        >
          Daily
        </Link>
        <Link
          href="/notes"
          role="tab"
          aria-selected={isNotes}
          className={cn(
            "nav-pill",
            isNotes && "nav-pill--active",
          )}
          onClick={() => dispatch({ type: "set-view", view: "notes" })}
        >
          Notes
        </Link>
      </nav>

      {/* Right: toggles */}
      <div className="flex items-center gap-1">
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
            {themeMode === "light" ? "Light mode" : themeMode === "dark" ? "Dark mode" : "System theme"}
          </TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}

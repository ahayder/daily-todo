"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Named queries shared across screens. Coarse-pointer UI must never depend on drag or hover. */
export const MEDIA_QUERIES = {
  touchFirst: "(hover: none), (pointer: coarse)",
  desktop: "(min-width: 768px)",
  /** Wide enough for a list + detail side by side (Content Planner shelf). */
  split: "(min-width: 1024px)",
  compact: "(max-width: 639px)",
  reducedMotion: "(prefers-reduced-motion: reduce)",
} as const;

function canMatchMedia() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function";
}

/** Subscribes to a CSS media query. Returns `false` during SSR / static export. */
export function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!canMatchMedia()) return () => {};
      const mediaQuery = window.matchMedia(query);
      mediaQuery.addEventListener("change", onChange);
      return () => mediaQuery.removeEventListener("change", onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => canMatchMedia() && window.matchMedia(query).matches,
    () => false,
  );
}

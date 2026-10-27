"use client";

import { useCallback, type RefObject } from "react";

/**
 * Move focus after an action removes the control that had it (Done, Do today,
 * Resolved…), so keyboard users stay where they were instead of the page top.
 */
export function useFocusSoon() {
  return useCallback((target: RefObject<HTMLElement | null>, fallback?: RefObject<HTMLElement | null>) => {
    window.requestAnimationFrame(() => (target.current ?? fallback?.current)?.focus());
  }, []);
}

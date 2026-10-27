import { useSyncExternalStore } from "react";

/**
 * The desktop pings switch. Device-local (like the theme): on by default,
 * one tap turns it off. Kept in localStorage and shared between the Today
 * bell and the ping scheduler.
 */

const KEY = "dailytodo.pings.enabled";
const EVENT = "dailytodo:pings-changed";

export function readPingsEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setPingsEnabled(enabled: boolean) {
  try {
    window.localStorage.setItem(KEY, enabled ? "on" : "off");
  } catch {
    // Storage unavailable: the switch lasts for this visit only.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function usePingsEnabled(): boolean {
  return useSyncExternalStore(subscribe, readPingsEnabled, () => true);
}

const SENT_KEY = "dailytodo.pings.sent";

/** Ping ids already shown today, so a reload never repeats one. */
export function readSentPings(date: string): Set<string> {
  try {
    const saved = JSON.parse(window.localStorage.getItem(SENT_KEY) ?? "{}") as { date?: string; ids?: string[] };
    return new Set(saved.date === date ? (saved.ids ?? []) : []);
  } catch {
    return new Set();
  }
}

export function writeSentPings(date: string, ids: Set<string>) {
  try {
    window.localStorage.setItem(SENT_KEY, JSON.stringify({ date, ids: [...ids] }));
  } catch {
    // Storage unavailable: kept in memory by the scheduler for this visit.
  }
}

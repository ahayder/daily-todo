"use client";

import { isTauri } from "@tauri-apps/api/core";
import { useEffect, useRef } from "react";
import { useAppState } from "@/components/app/app-context";
import { DEFAULT_TIME_ZONE, todayIn } from "@/lib/memory/dates";
import { duePings } from "@/lib/memory/pings";
import { getTodayView } from "@/lib/memory/tasks";
import { minutesInZone, selectedPlannerPreset } from "@/lib/memory/today-screen";
import { readSentPings, usePingsEnabled, writeSentPings } from "@/lib/ping-settings";

const CHECK_EVERY_MS = 30_000;

/**
 * Gentle desktop pings (desktop app only): a block with a task starting, and
 * standup soon. The rules live in src/lib/memory/pings.ts. Renders nothing.
 */
export function PingScheduler() {
  const { state } = useAppState();
  const enabled = usePingsEnabled();
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || !isTauri()) return;
    let cancelled = false;

    const check = async () => {
      const now = new Date();
      const date = todayIn(DEFAULT_TIME_ZONE, now);
      const current = stateRef.current;
      const view = getTodayView({
        tasks: current.memory.task,
        repeats: current.memory.repeat,
        preset: selectedPlannerPreset(current),
        date,
      });
      const sent = readSentPings(date);
      const appFocused = document.visibilityState === "visible" && document.hasFocus();
      const pings = duePings({ view, minutes: minutesInZone(now, DEFAULT_TIME_ZONE), sent, appFocused });
      if (pings.length === 0) return;

      const notification = await import("@tauri-apps/plugin-notification");
      let granted = await notification.isPermissionGranted();
      if (!granted) granted = (await notification.requestPermission()) === "granted";
      if (cancelled || !granted) return;
      for (const ping of pings) {
        notification.sendNotification({ title: ping.title, body: ping.body });
        sent.add(ping.id);
      }
      writeSentPings(date, sent);
    };

    void check();
    const timer = window.setInterval(() => void check(), CHECK_EVERY_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [enabled]);

  return null;
}

"use client";

import confetti from "canvas-confetti";

const COMPLETION_CONFETTI_COLORS = [
  "#2f6d62",
  "#c0392b",
  "#c07c30",
  "#4a7c59",
  "#d6b98b",
  "#f4e7c8",
];

export function triggerCompletionConfettiFromElement(target: HTMLElement) {
  const rect = target.getBoundingClientRect();
  const origin = {
    x: (rect.left + rect.width / 2) / window.innerWidth,
    y: (rect.top + rect.height / 2) / window.innerHeight,
  };

  const shared = {
    disableForReducedMotion: true,
    ticks: 260,
    colors: COMPLETION_CONFETTI_COLORS,
    zIndex: 1000,
  };

  void confetti({
    ...shared,
    particleCount: 110,
    spread: 92,
    startVelocity: 42,
    scalar: 1.05,
    origin,
  });

  void confetti({
    ...shared,
    particleCount: 90,
    angle: 60,
    spread: 78,
    startVelocity: 48,
    scalar: 1,
    origin: { x: 0, y: 0.72 },
  });

  void confetti({
    ...shared,
    particleCount: 90,
    angle: 120,
    spread: 78,
    startVelocity: 48,
    scalar: 1,
    origin: { x: 1, y: 0.72 },
  });

  void confetti({
    ...shared,
    particleCount: 120,
    spread: 120,
    startVelocity: 32,
    scalar: 0.95,
    origin: { x: 0.5, y: 0.15 },
  });
}

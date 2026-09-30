"use client";

import confetti from "canvas-confetti";

// Design tokens (see .design/DESIGN.md): accent + the three priority stickers.
const CONFETTI_TOKENS = ["--primary", "--p1", "--p2", "--p3", "--now-bar"];

/** canvas-confetti only understands hex, so resolve token colors (oklch) through a 1px canvas. */
function resolveTokenColors(): string[] {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const styles = getComputedStyle(document.documentElement);
  const colors: string[] = [];

  for (const token of CONFETTI_TOKENS) {
    const value = styles.getPropertyValue(token).trim();
    if (!context || !value) continue;
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = value;
    context.fillRect(0, 0, 1, 1);
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
    colors.push(`#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`);
  }

  return colors.length > 0 ? colors : ["#b9a4f0"];
}

export function triggerCompletionConfettiFromElement(target: HTMLElement) {
  const rect = target.getBoundingClientRect();
  const origin = {
    x: (rect.left + rect.width / 2) / window.innerWidth,
    y: (rect.top + rect.height / 2) / window.innerHeight,
  };

  const shared = {
    disableForReducedMotion: true,
    ticks: 260,
    colors: resolveTokenColors(),
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

// Builds per-direction tokens: accent/status/chart tokens come from palette.mjs runs,
// neutrals are re-tinted to the direction's own hue/lightness, product tokens are added,
// and every pair is contrast-checked with the same color.mjs math.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
const BD = "/Users/ahayder/.claude/skills/ui-ux-pro/skills/brand-design/scripts";
const { parseColor, toGamut, wcag, ensureContrast, format } = await import(`${BD}/color.mjs`);

const P = (s) => parseColor(s);
const fmt = (c) => format(c, "oklch");
const pal = (seed, extra = []) =>
  JSON.parse(execFileSync("node", [`${BD}/palette.mjs`, seed, "--json", ...extra], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
const pick = (tok, keys) => Object.fromEntries(keys.map((k) => [k, P(tok[k].oklch)]));
const ACCENT_KEYS = ["primary", "ring", "brand-subtle", "brand-subtle-foreground", "destructive", "destructive-foreground", "success", "success-foreground", "warning", "warning-foreground", "info", "info-foreground", "chart-1", "chart-2", "chart-3", "chart-4", "chart-5"];

const DIRS = {
  A: {
    darkSeed: "oklch(0.80 0.12 170)", darkArgs: ["--keep-seed", "--tint", "0.02"],
    lightSeed: "oklch(0.53 0.10 172)", lightArgs: ["--tint", "0.02"],
    n: { h: 222, c: 0.026, darkL: 0.185, lightBg: 0.982, lightCard: 0.997, lightC: 0.008 },
    custom: {
      dark: {
        p1: "oklch(0.74 0.13 25)", "p1-on": "oklch(0.2 0.03 25)", "p1-soft": "oklch(0.265 0.045 25)", "p1-ink": "oklch(0.87 0.07 25)",
        p2: "oklch(0.83 0.12 80)", "p2-on": "oklch(0.2 0.03 80)", "p2-soft": "oklch(0.27 0.04 80)", "p2-ink": "oklch(0.89 0.08 85)",
        p3: "oklch(0.77 0.1 235)", "p3-on": "oklch(0.2 0.03 235)", "p3-soft": "oklch(0.265 0.04 235)", "p3-ink": "oklch(0.87 0.06 235)",
        "now-bg": "oklch(0.285 0.05 195)", "now-fill": "oklch(0.345 0.065 182)", "now-fg": "oklch(0.97 0.012 180)", "now-muted": "oklch(0.86 0.04 180)", "now-bar": "oklch(0.8 0.12 170)",
        "margin-ink": "oklch(0.82 0.08 170)", rule: "oklch(0.9 0.03 222 / 0.07)",
      },
      light: {
        p1: "oklch(0.56 0.15 25)", "p1-on": "oklch(0.99 0 0)", "p1-soft": "oklch(0.955 0.025 25)", "p1-ink": "oklch(0.46 0.13 25)",
        p2: "oklch(0.62 0.13 65)", "p2-on": "oklch(0.2 0.03 65)", "p2-soft": "oklch(0.96 0.035 85)", "p2-ink": "oklch(0.45 0.09 65)",
        p3: "oklch(0.54 0.11 240)", "p3-on": "oklch(0.99 0 0)", "p3-soft": "oklch(0.955 0.022 240)", "p3-ink": "oklch(0.44 0.1 245)",
        "now-bg": "oklch(0.93 0.035 188)", "now-fill": "oklch(0.875 0.06 180)", "now-fg": "oklch(0.22 0.03 205)", "now-muted": "oklch(0.36 0.045 200)", "now-bar": "oklch(0.53 0.1 172)",
        "margin-ink": "oklch(0.46 0.085 172)", rule: "oklch(0.55 0.05 222 / 0.13)",
      },
      fillMarkers: false,
    },
  },
  B: {
    darkSeed: "oklch(0.8 0.1 295)", darkArgs: ["--keep-seed", "--tint", "0.022"],
    lightSeed: "oklch(0.52 0.15 295)", lightArgs: ["--tint", "0.022"],
    n: { h: 300, c: 0.03, darkL: 0.195, lightBg: 0.978, lightCard: 0.996, lightC: 0.012 },
    custom: {
      dark: {
        p1: "oklch(0.84 0.08 45)", "p1-on": "oklch(0.22 0.04 40)", "p1-soft": "oklch(0.328 0.038 316.8)", "p1-ink": "oklch(0.88 0.06 45)",
        p2: "oklch(0.89 0.09 95)", "p2-on": "oklch(0.24 0.04 90)", "p2-soft": "oklch(0.336 0.04 324.8)", "p2-ink": "oklch(0.9 0.07 95)",
        p3: "oklch(0.85 0.08 165)", "p3-on": "oklch(0.22 0.04 165)", "p3-soft": "oklch(0.329 0.038 278.4)", "p3-ink": "oklch(0.88 0.06 165)",
        "now-bg": "oklch(0.82 0.09 295)", "now-fill": "oklch(0.82 0.09 295)", "now-fg": "oklch(0.2 0.04 295)", "now-muted": "oklch(0.33 0.06 295)", "now-bar": "oklch(0.2 0.04 295)",
        "margin-ink": "oklch(0.9 0.07 95)", rule: "oklch(0.9 0.03 300 / 0.07)",
      },
      light: {
        p1: "oklch(0.89 0.065 45)", "p1-on": "oklch(0.3 0.06 40)", "p1-soft": "oklch(0.965 0.02 45)", "p1-ink": "oklch(0.44 0.1 40)",
        p2: "oklch(0.92 0.085 95)", "p2-on": "oklch(0.32 0.06 85)", "p2-soft": "oklch(0.97 0.03 95)", "p2-ink": "oklch(0.43 0.08 80)",
        p3: "oklch(0.9 0.065 165)", "p3-on": "oklch(0.3 0.06 165)", "p3-soft": "oklch(0.965 0.02 165)", "p3-ink": "oklch(0.41 0.08 165)",
        "now-bg": "oklch(0.895 0.06 295)", "now-fill": "oklch(0.895 0.06 295)", "now-fg": "oklch(0.22 0.05 295)", "now-muted": "oklch(0.36 0.07 295)", "now-bar": "oklch(0.3 0.08 295)",
        "margin-ink": "oklch(0.43 0.08 80)", rule: "oklch(0.55 0.05 300 / 0.12)",
      },
      fillMarkers: true,
    },
  },
  // B2 — revision of B after feedback: "B, but much darker" (depth like A). Same identity and light mode;
  // near-black plum page, subtly stepped surfaces, dimmed stickers, and a deep-lilac Now block with a lilac ring.
  B2: {
    darkSeed: "oklch(0.78 0.1 295)", darkArgs: ["--keep-seed", "--tint", "0.022"],
    lightSeed: "oklch(0.52 0.15 295)", lightArgs: ["--tint", "0.022"],
    n: { h: 300, c: 0.024, darkL: 0.145, lightBg: 0.978, lightCard: 0.996, lightC: 0.012,
      darkSteps: { card: 0.03, popover: 0.055, muted: 0.07, border: 0.095, input: 0.2 } },
    custom: {
      dark: {
        p1: "oklch(0.78 0.075 45)", "p1-on": "oklch(0.2 0.035 40)", "p1-soft": "oklch(0.215 0.03 355)", "p1-ink": "oklch(0.85 0.06 45)",
        p2: "oklch(0.84 0.085 95)", "p2-on": "oklch(0.22 0.035 90)", "p2-soft": "oklch(0.22 0.018 75)", "p2-ink": "oklch(0.87 0.07 95)",
        p3: "oklch(0.79 0.075 165)", "p3-on": "oklch(0.2 0.035 165)", "p3-soft": "oklch(0.215 0.024 205)", "p3-ink": "oklch(0.85 0.06 165)",
        "now-bg": "oklch(0.285 0.075 295)", "now-fill": "oklch(0.285 0.075 295)", "now-fg": "oklch(0.97 0.012 295)", "now-muted": "oklch(0.84 0.05 295)", "now-bar": "oklch(0.8 0.1 295)",
        "margin-ink": "oklch(0.86 0.065 95)", rule: "oklch(0.9 0.03 300 / 0.06)",
        "brand-subtle": "oklch(0.22 0.045 295)", "brand-subtle-foreground": "oklch(0.88 0.05 300)",
      },
      light: {
        p1: "oklch(0.89 0.065 45)", "p1-on": "oklch(0.3 0.06 40)", "p1-soft": "oklch(0.965 0.02 45)", "p1-ink": "oklch(0.44 0.1 40)",
        p2: "oklch(0.92 0.085 95)", "p2-on": "oklch(0.32 0.06 85)", "p2-soft": "oklch(0.97 0.03 95)", "p2-ink": "oklch(0.43 0.08 80)",
        p3: "oklch(0.9 0.065 165)", "p3-on": "oklch(0.3 0.06 165)", "p3-soft": "oklch(0.965 0.02 165)", "p3-ink": "oklch(0.41 0.08 165)",
        "now-bg": "oklch(0.895 0.06 295)", "now-fill": "oklch(0.895 0.06 295)", "now-fg": "oklch(0.22 0.05 295)", "now-muted": "oklch(0.36 0.07 295)", "now-bar": "oklch(0.3 0.08 295)",
        "margin-ink": "oklch(0.43 0.08 80)", rule: "oklch(0.55 0.05 300 / 0.12)",
      },
      fillMarkers: true,
    },
  },
  C: {
    darkSeed: "oklch(0.9 0.19 125)", darkArgs: ["--keep-seed", "--tint", "0.006"],
    lightSeed: "oklch(0.9 0.19 125)", lightArgs: ["--keep-seed", "--tint", "0.006"],
    n: { h: 105, c: 0.008, darkL: 0.18, lightBg: 0.968, lightCard: 0.992, lightC: 0.006 },
    custom: {
      dark: {
        p1: "oklch(0.8 0.13 355)", "p1-on": "oklch(0.2 0.03 355)", "p1-soft": "oklch(0.26 0.03 355)", "p1-ink": "oklch(0.86 0.08 355)",
        p2: "oklch(0.83 0.13 65)", "p2-on": "oklch(0.2 0.03 65)", "p2-soft": "oklch(0.26 0.03 65)", "p2-ink": "oklch(0.87 0.08 65)",
        p3: "oklch(0.82 0.09 225)", "p3-on": "oklch(0.2 0.03 225)", "p3-soft": "oklch(0.26 0.03 225)", "p3-ink": "oklch(0.86 0.06 225)",
        "now-bg": "oklch(0.9 0.19 125)", "now-fill": "oklch(0.9 0.19 125)", "now-fg": "oklch(0.2 0.03 125)", "now-muted": "oklch(0.34 0.06 125)", "now-bar": "oklch(0.2 0.03 125)",
        "margin-ink": "oklch(0.8 0.015 105)", rule: "oklch(0.95 0.01 105 / 0.08)",
      },
      light: {
        p1: "oklch(0.86 0.1 355)", "p1-on": "oklch(0.2 0.02 355)", "p1-soft": "oklch(0.95 0.025 355)", "p1-ink": "oklch(0.44 0.13 355)",
        p2: "oklch(0.87 0.11 70)", "p2-on": "oklch(0.2 0.02 70)", "p2-soft": "oklch(0.95 0.03 70)", "p2-ink": "oklch(0.44 0.1 60)",
        p3: "oklch(0.87 0.07 225)", "p3-on": "oklch(0.2 0.02 225)", "p3-soft": "oklch(0.95 0.02 225)", "p3-ink": "oklch(0.43 0.09 235)",
        "now-bg": "oklch(0.9 0.19 125)", "now-fill": "oklch(0.9 0.19 125)", "now-fg": "oklch(0.2 0.03 125)", "now-muted": "oklch(0.34 0.06 125)", "now-bar": "oklch(0.2 0.03 125)",
        "margin-ink": "oklch(0.44 0.015 105)", rule: "oklch(0.35 0.01 105 / 0.16)",
      },
      fillMarkers: true,
    },
  },
};

const PAIRS = [
  ["foreground", "background", 4.5], ["card-foreground", "card", 4.5], ["popover-foreground", "popover", 4.5],
  ["muted-foreground", "background", 4.5], ["muted-foreground", "card", 4.5], ["muted-foreground", "muted", 4.5],
  ["primary-foreground", "primary", 4.5], ["secondary-foreground", "secondary", 4.5], ["accent-foreground", "accent", 4.5],
  ["destructive-foreground", "destructive", 4.5], ["success-foreground", "success", 4.5], ["warning-foreground", "warning", 4.5],
  ["info-foreground", "info", 4.5], ["brand-subtle-foreground", "brand-subtle", 4.5], ["ring", "background", 3], ["input", "background", 3],
  ["p1-on", "p1", 4.5], ["p2-on", "p2", 4.5], ["p3-on", "p3", 4.5],
  ["p1-ink", "p1-soft", 4.5], ["p2-ink", "p2-soft", 4.5], ["p3-ink", "p3-soft", 4.5],
  ["p1-ink", "background", 4.5], ["p2-ink", "background", 4.5], ["p3-ink", "background", 4.5],
  ["p1-ink", "card", 4.5], ["p2-ink", "card", 4.5], ["p3-ink", "card", 4.5],
  ["now-fg", "now-bg", 4.5], ["now-muted", "now-bg", 4.5], ["now-fg", "now-fill", 4.5], ["now-muted", "now-fill", 4.5],
  ["margin-ink", "background", 4.5], ["margin-ink", "card", 4.5], ["now-bar", "now-bg", 3], ["foreground", "card", 4.5], ["foreground", "muted", 4.5],
  ["muted-foreground", "p1-soft", 4.5], ["muted-foreground", "p2-soft", 4.5], ["muted-foreground", "p3-soft", 4.5],
  ["foreground", "p1-soft", 4.5], ["foreground", "p2-soft", 4.5], ["foreground", "p3-soft", 4.5], ["p2-on", "p2", 4.5],
];

const out = {};
const report = [];
for (const [id, d] of Object.entries(DIRS)) {
  const dk = pal(d.darkSeed, d.darkArgs);
  const lt = pal(d.lightSeed, d.lightArgs);
  const N = (l, c = d.n.c) => toGamut({ l, c, h: d.n.h, alpha: 1 });
  const modes = {};
  // ---- dark ----
  {
    const b = d.n.darkL;
    const t = pick(dk.dark, ACCENT_KEYS);
    // Optional per-direction surface steps (B2 uses tighter steps on a near-black page).
    const st = { card: 0.035, popover: 0.06, muted: 0.075, border: 0.11, input: 0.2, ...(d.n.darkSteps || {}) };
    const background = N(b), card = N(b + st.card), popover = N(b + st.popover), muted = N(b + st.muted);
    const foreground = N(0.96, d.n.c * 0.4);
    const ink = N(0.19, d.n.c * 1.1);
    const mutedFg = ensureContrast(N(0.74, d.n.c * 0.9), muted, 4.6);
    const primaryFg = wcag(ink, t.primary) >= 4.5 ? ink : P("oklch(0.99 0 0)");
    modes.dark = {
      background, foreground, card, "card-foreground": foreground, popover, "popover-foreground": foreground,
      primary: t.primary, "primary-foreground": primaryFg,
      secondary: muted, "secondary-foreground": foreground, muted, "muted-foreground": mutedFg, accent: muted, "accent-foreground": foreground,
      destructive: t.destructive, "destructive-foreground": t["destructive-foreground"], success: t.success, "success-foreground": t["success-foreground"],
      warning: t.warning, "warning-foreground": t["warning-foreground"], info: t.info, "info-foreground": t["info-foreground"],
      border: N(b + st.border, d.n.c * 0.9), input: ensureContrast(N(b + st.input, d.n.c * 0.9), background, 3),
      ring: ensureContrast(t.ring, background, 3), "brand-subtle": t["brand-subtle"], "brand-subtle-foreground": t["brand-subtle-foreground"],
      "chart-1": t["chart-1"], "chart-2": t["chart-2"], "chart-3": t["chart-3"], "chart-4": t["chart-4"], "chart-5": t["chart-5"],
    };
  }
  // ---- light ----
  {
    const t = pick(lt.light, ACCENT_KEYS);
    const background = N(d.n.lightBg, d.n.lightC), card = N(d.n.lightCard, d.n.lightC * 0.5), popover = card;
    const muted = N(d.n.lightBg - 0.035, d.n.lightC * 1.4);
    const foreground = N(0.2, d.n.c * 1.2);
    const mutedFg = ensureContrast(N(0.5, d.n.c * 1.3), muted, 4.6);
    const primaryFg = P(lt.light["primary-foreground"].oklch);
    modes.light = {
      background, foreground, card, "card-foreground": foreground, popover, "popover-foreground": foreground,
      primary: t.primary, "primary-foreground": primaryFg,
      secondary: muted, "secondary-foreground": foreground, muted, "muted-foreground": mutedFg, accent: muted, "accent-foreground": foreground,
      destructive: t.destructive, "destructive-foreground": t["destructive-foreground"], success: t.success, "success-foreground": t["success-foreground"],
      warning: t.warning, "warning-foreground": t["warning-foreground"], info: t.info, "info-foreground": t["info-foreground"],
      border: N(d.n.lightBg - 0.075, d.n.lightC * 1.6), input: ensureContrast(N(d.n.lightBg - 0.2, d.n.lightC * 1.6), background, 3),
      ring: ensureContrast(t.ring, background, 3), "brand-subtle": t["brand-subtle"], "brand-subtle-foreground": ensureContrast(t["brand-subtle-foreground"], t["brand-subtle"], 4.6),
      "chart-1": t["chart-1"], "chart-2": t["chart-2"], "chart-3": t["chart-3"], "chart-4": t["chart-4"], "chart-5": t["chart-5"],
    };
  }
  for (const m of ["light", "dark"]) {
    for (const s of ["destructive", "success", "warning", "info"]) {
      const T0 = modes[m];
      if (wcag(T0[`${s}-foreground`], T0[s]) < 4.5) T0[s] = ensureContrast(T0[s], T0[`${s}-foreground`], 4.6);
    }
    for (const [k, v] of Object.entries(d.custom[m])) modes[m][k] = P(v);
    const T = modes[m];
    for (const [fg, bg, min] of PAIRS) {
      if (!T[fg] || !T[bg]) continue;
      const r = wcag(T[fg], T[bg]);
      if (r < min) report.push(`${id} ${m}: ${fg} on ${bg} = ${r.toFixed(2)} < ${min}`);
    }
    if (!d.custom.fillMarkers) for (const k of ["p1", "p2", "p3"]) {
      const r = wcag(T[k], T.background);
      if (r < 3) report.push(`${id} ${m}: ${k} marker on background = ${r.toFixed(2)} < 3`);
    }
    const pr = wcag(T.primary, T.background);
    if (pr < 3) report.push(`${id} ${m}: (advisory, needs outline) primary vs background = ${pr.toFixed(2)}`);
  }
  out[id] = {
    commands: [
      `node palette.mjs "${d.darkSeed}" ${d.darkArgs.join(" ")} --json  # dark accent/status`,
      `node palette.mjs "${d.lightSeed}" ${d.lightArgs.join(" ")} --json  # light accent/status`,
    ],
    notes: [dk.note, lt.note],
    light: Object.fromEntries(Object.entries(modes.light).map(([k, v]) => [k, typeof v === "object" && v.l !== undefined ? fmt(v) : v])),
    dark: Object.fromEntries(Object.entries(modes.dark).map(([k, v]) => [k, fmt(v)])),
    ramp: Object.fromEntries(Object.entries(dk.ramps.brand).map(([k, v]) => [k, v.oklch])),
  };
}
writeFileSync(new URL("./tokens.json", import.meta.url), JSON.stringify(out, null, 1));
console.log(report.length ? report.join("\n") : "ALL PAIRS PASS");

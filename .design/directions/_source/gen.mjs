import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { screen, BASE_CSS } from "./screen.mjs";

const TPL = "/Users/ahayder/.claude/skills/ui-ux-pro/skills/brand-design/assets/preview-template.html";
const CMP = "/Users/ahayder/.claude/skills/ui-ux-pro/skills/brand-design/assets/compare.html";
const OUT = "/Users/ahayder/Documents/Work/Projects/DailyTodoApp/.design/directions";
const tokens = JSON.parse(readFileSync(new URL("./tokens.json", import.meta.url), "utf8"));
mkdirSync(OUT, { recursive: true });

const bnImport = (fam) => `@import url('https://fonts.googleapis.com/css2?family=${fam}&display=swap');`;

const D = {
  A: {
    slug: "night-lagoon",
    name: "Night Lagoon",
    oneLiner: "Deep ink-teal water at night with one mint light: the calmest page to start from, evolved from today's teal.",
    language: "Soft modern (restrained) + a ruled notebook page and the 'tide' Now card",
    fonts: {
      heading: { family: "Figtree", weights: "500;600;700", fallback: '"Hind Siliguri", ui-sans-serif, system-ui, sans-serif' },
      body: { family: "Figtree", weights: "400;500;600", fallback: '"Hind Siliguri", ui-sans-serif, system-ui, sans-serif' },
      mono: { family: "JetBrains Mono", weights: "400;500;600", fallback: "ui-monospace, monospace" },
    },
    bengali: "Hind+Siliguri:wght@400;500;600",
    type: { base: 16, ratio: 1.25, headingWeight: 600, headingTracking: "-0.015em", headingTransform: "none", headingStyle: "normal", bodyLineHeight: 1.6 },
    shape: { radius: "0.75rem", borderWidth: "1px", cardShadow: "0 1px 2px oklch(0 0 0 / 0.12)", buttonShadow: "none", buttonShadowActive: "none", buttonTransform: "none", density: "comfortable" },
    motion: { duration: "200ms", easing: "cubic-bezier(0.22, 1, 0.36, 1)", description: "Unhurried and smooth: 200ms ease-out fades and short slides. The tide in the Now card moves continuously; a checked task settles into place. Nothing bounces." },
    hero: {
      eyebrow: "Your desk notebook for today",
      headline: "One calm page for today",
      subhead: "Yesterday's unfinished tasks and notes are already here. The Now card tells you what this minute is for.",
      primaryCta: "Open today", secondaryCta: "See the planner", proof: "", background: "plain",
    },
    wordmark: {
      variants: [
        { label: "Lowercase, soft bold", text: "dailytodo", font: "heading", weight: 700, tracking: "-0.035em", transform: "none", detail: "" },
        { label: "Title case with a mint dot", text: "DailyTodo", font: "heading", weight: 600, tracking: "-0.02em", transform: "none", detail: "dot" },
        { label: "Uppercase tracked", text: "DailyTodo", font: "heading", weight: 600, tracking: "0.14em", transform: "uppercase", detail: "" },
      ],
      markSvg: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%"><rect x="5" y="4" width="22" height="24" rx="6"/><path d="M11 14.5l3.5 3.5 6.5-7"/><path d="M10.5 22.5c1.8-1.3 3.7-1.3 5.5 0s3.7 1.3 5.5 0"/></svg>',
    },
    voice: {
      traits: ["Calm, not flat", "Clear, not bossy", "Kind, not cheerleading"],
      examples: [
        { moment: "Empty state", text: "Nothing here yet. Add one small thing to start." },
        { moment: "Task done", text: "Done. One less thing to hold in your head." },
        { moment: "Sync issue", text: "Couldn't sync just now. Your changes are safe on this device; we'll try again." },
        { moment: "Carryover", text: "From yesterday" },
        { moment: "Button", text: "Start focus" },
      ],
    },
    rationale: [
      "Dark-first without cold slate: the ink-teal night background is tinted and deep, so long evening sessions stay restful for tired ADHD eyes.",
      "One mint accent, used only for actions and the Now card, keeps the answer to 'what do I do next?' visually obvious (isolation effect) — and it grows out of the teal app icon you already have.",
      "Figtree is friendly and very readable; Hind Siliguri is the most familiar, legible Bengali sans, so mixed Bangla/English notes read as one voice.",
    ],
    risks: [
      "Closest to a 'normal' dark app, so it may feel less personal. Mitigation: the ruled page and the tide Now card carry the notebook identity.",
      "Hind Siliguri looks slightly smaller than Figtree at the same size. Mitigation: set a size-adjust on the Bengali face in next/font and give Bengali lines 1.75 line-height.",
    ],
    css: `
.dt-note { background: var(--background); }
.dt-todos { background: var(--card); }
.dt [lang="bn"], .dt-extras [lang="bn"] { font-size: 1.06em; }
.dt-date { display: flex; flex-direction: column; gap: 2px; font-size: 30px; }
.dt-date-day { font-family: var(--font-body); font-size: 14px; font-weight: 600; color: var(--margin-ink); letter-spacing: 0.01em; }
.dt-page { background-image: linear-gradient(to bottom, transparent calc(1.75em - 1px), var(--rule) calc(1.75em - 1px)); background-size: 100% 1.75em; }
.dt-now { box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--now-bar) 35%, transparent); }
.dt-now-tide { display: block; position: absolute; inset: 0 auto 0 0; width: 60%; background: var(--now-fill); border-right: 2px solid var(--now-bar); transition: width 600ms linear; }
.dt-group-h .dt-tab::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--pc); margin-right: 2px; }
.dt-task.is-now { background: color-mix(in oklch, var(--now-bg) 70%, transparent); }
.dt-nowtag { display: inline; font-size: 13px; font-weight: 600; color: var(--margin-ink); }
.dt-age[data-days="3"] { font-weight: 600; }
.dt-age[data-days="6"] { font-weight: 700; }
`,
  },
  B: {
    slug: "pocket-stickers",
    name: "Pocket Stickers",
    oneLiner: "A plum night notebook with pastel sticker tabs: Tiimo-friendly color that makes today feel light and doable.",
    language: "Soft modern / playful (toned down) + sticker tabs, washi-tape carryover and a ring-timer Now block",
    fonts: {
      heading: { family: "Baloo Da 2", weights: "500;600;700", fallback: "ui-rounded, ui-sans-serif, system-ui, sans-serif" },
      body: { family: "Nunito", weights: "400;500;600;700", fallback: '"Baloo Da 2", ui-rounded, ui-sans-serif, system-ui, sans-serif' },
      mono: { family: "DM Mono", weights: "400;500", fallback: "ui-monospace, monospace" },
    },
    bengali: null,
    type: { base: 16, ratio: 1.25, headingWeight: 600, headingTracking: "-0.005em", headingTransform: "none", headingStyle: "normal", bodyLineHeight: 1.6 },
    shape: { radius: "1rem", borderWidth: "1px", cardShadow: "0 8px 24px -12px oklch(0.25 0.08 300 / 0.35)", buttonShadow: "none", buttonShadowActive: "none", buttonTransform: "none", density: "airy" },
    motion: { duration: "200ms", easing: "cubic-bezier(0.22, 1, 0.36, 1)", description: "Gentle and friendly: 200ms ease-out, a soft 0.97 press on stickers and buttons, the Now ring drains smoothly. A finished task gets a small sticker 'stamp' fade — no springs, no bounce." },
    hero: {
      eyebrow: "A friendly notebook for busy heads",
      headline: "Today feels lighter here",
      subhead: "Must, should, could — each on its own sticker. Unfinished things ride along to tomorrow, and the Now block shows how much time is left.",
      primaryCta: "Open today", secondaryCta: "Plan my day", proof: "", background: "tint",
    },
    wordmark: {
      variants: [
        { label: "Lowercase rounded", text: "dailytodo", font: "heading", weight: 700, tracking: "-0.02em", transform: "none", detail: "" },
        { label: "Title case with a lilac dot", text: "DailyTodo", font: "heading", weight: 700, tracking: "-0.01em", transform: "none", detail: "dot" },
        { label: "Soft medium", text: "Daily Todo", font: "heading", weight: 500, tracking: "0em", transform: "none", detail: "" },
      ],
      markSvg: '<svg viewBox="0 0 32 32" width="100%" height="100%"><circle cx="17.5" cy="17.5" r="12" fill="currentColor" opacity="0.35"/><circle cx="15" cy="15" r="12" fill="currentColor"/><path d="M9.5 15.5l3.8 3.8 7.2-7.8" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="stroke: var(--primary-foreground)"/></svg>',
    },
    voice: {
      traits: ["Friendly, not childish", "Encouraging, not pushy", "Light, not silly"],
      examples: [
        { moment: "Empty state", text: "A fresh page. What's one thing for today?" },
        { moment: "Task done", text: "Nice — that's off your plate." },
        { moment: "Sync issue", text: "Sync hiccup. Everything is saved on this device and will catch up soon." },
        { moment: "Carryover", text: "From yesterday" },
        { moment: "Button", text: "Start this one" },
      ],
    },
    rationale: [
      "Closest to Tiimo: color does the sorting (peach = must, butter = should, mint = could), so the brain groups the day before reading a word — always backed by !! / ! / ~ and the label.",
      "Pastel stickers on a plum night page stay soft in the dark; nothing shouts, but the day looks friendly and finishable, which lowers the 'where do I start' barrier.",
      "Baloo Da 2 was drawn for Bengali and Latin together, so Bangla headings and English headings share one rounded voice; Nunito keeps English body text soft and readable.",
    ],
    risks: [
      "Can tip into 'childish' for serious work days. Mitigation: pastels stay on tabs, tape and the Now block only; task text stays plain ink, and body type is not the rounded display face.",
      "More color = more tokens to keep consistent. Mitigation: exactly three priority hues with fixed roles, no per-task colors.",
    ],
    css: `
.dt-top { border-bottom-color: transparent; }
.dt-pills { background: var(--card); }
.dt-pills a.on { background: var(--primary); color: var(--primary-foreground); }
.dt-side { background: var(--background); border-right: 0; }
.dt-day.on { background: var(--card); color: var(--foreground); }
.dt-day.on small { color: var(--primary); }
.dt-main { gap: 14px; padding: 2px 14px 14px 0; }
.dt-note, .dt-todos { background: var(--card); border-radius: 26px; }
.dt-note { border-right: 0; }
.dt-date { font-size: 30px; }
.dt-date-d { display: inline-block; font-size: 22px; padding: 2px 12px; margin-left: 6px; border-radius: 12px; background: var(--p2); color: var(--p2-on); transform: rotate(-2deg); vertical-align: 4px; }
.dt-wschip { border-color: transparent; background: var(--muted); }
.dt-group { background: var(--pc-soft); border-radius: 22px; padding: 10px; }
.dt-tab { background: var(--pc); color: var(--pc-on); padding: 3px 12px 2px; border-radius: 999px; }
.dt-sig { color: var(--pc-on); }
.dt-group-h h3 { font-family: var(--font-heading); font-size: 15px; font-weight: 700; }
.dt-task:hover, .dt-add:hover { background: color-mix(in oklch, var(--card) 55%, transparent); }
.dt-check { border-radius: 8px; border-width: 2px; }
.dt-task.done .dt-check { background: var(--pc); border-color: var(--pc); color: var(--pc-on); }
.dt-age { color: var(--p2-on); background: var(--p2); padding: 1px 10px; transform: rotate(2deg); clip-path: polygon(0 12%, 5% 0, 50% 8%, 95% 0, 100% 12%, 100% 88%, 95% 100%, 50% 92%, 5% 100%, 0 88%); }
.dt-age[data-days="3"], .dt-age[data-days="6"] { font-weight: 700; }
.dt-nowtag { display: inline; font-size: 13px; font-weight: 700; color: var(--now-fg); background: var(--now-bg); padding: 0 8px; border-radius: 999px; line-height: 22px; }
.dt-now { grid-template-columns: 60px minmax(0, 1fr); border-radius: 24px; padding: 16px 18px; box-shadow: var(--card-shadow); }
.dt-now-ring { display: block; width: 60px; height: 60px; grid-row: 1 / span 2; align-self: start; }
.dt-now-body { grid-column: 2; }
.dt-now-actions { grid-column: 2; }
.dt-now-btn { border-radius: 999px; }
.dt-now-btn:active, .dt-next:active, .dt-tab:active { transform: scale(0.97); }
.dt-x .dt-now { grid-template-columns: 60px minmax(0, 1fr); }
.dt-status { background: var(--muted); color: var(--foreground); }
.dt-stage .st.cur { box-shadow: 2px 2px 0 color-mix(in oklch, var(--primary) 45%, transparent); }
.dt-next { border-radius: 999px; }
@container (max-width: 900px) { .dt-main { padding: 0 12px 12px; } }
@container (max-width: 640px) { .dt-now { grid-template-columns: 60px minmax(0, 1fr); } }
`,
  },
  C: {
    slug: "highlighter",
    name: "Highlighter",
    oneLiner: "A graphite dot-grid journal and a pack of highlighters: the most notebook, the most focused — one lime stroke marks what matters now.",
    language: "Editorial-grotesque bullet journal + highlighter swipes and ink-outlined controls",
    fonts: {
      heading: { family: "Bricolage Grotesque", weights: "500;600;700", fallback: '"Anek Bangla", ui-sans-serif, system-ui, sans-serif' },
      body: { family: "Anek Latin", weights: "400;500;600", fallback: '"Anek Bangla", ui-sans-serif, system-ui, sans-serif' },
      mono: { family: "IBM Plex Mono", weights: "400;500;600", italic: true, fallback: "ui-monospace, monospace" },
    },
    bengali: "Anek+Bangla:wght@400;500;600",
    type: { base: 16, ratio: 1.333, headingWeight: 600, headingTracking: "-0.03em", headingTransform: "none", headingStyle: "normal", bodyLineHeight: 1.55 },
    shape: { radius: "0.375rem", borderWidth: "1px", cardShadow: "none", buttonShadow: "none", buttonShadowActive: "none", buttonTransform: "none", density: "compact" },
    motion: { duration: "160ms", easing: "cubic-bezier(0.22, 1, 0.36, 1)", description: "Crisp and quick: 160ms ease-out. The one expressive move is the highlighter — a 220ms left-to-right swipe when a task becomes Now or a card moves stage. Finished tasks get a pen strike." },
    hero: {
      eyebrow: "A bullet journal that remembers for you",
      headline: "Highlight what matters today",
      subhead: "Carried-over tasks come with a pencil note, the daily page sits beside your list, and one lime stroke marks what you're doing now.",
      primaryCta: "Open today", secondaryCta: "Review carried tasks", proof: "", background: "plain",
    },
    wordmark: {
      variants: [
        { label: "Lowercase grotesque", text: "dailytodo", font: "heading", weight: 700, tracking: "-0.045em", transform: "none", detail: "" },
        { label: "Title case, tight", text: "DailyTodo", font: "heading", weight: 600, tracking: "-0.03em", transform: "none", detail: "" },
        { label: "Slash, body face", text: "daily/todo", font: "body", weight: 600, tracking: "-0.01em", transform: "none", detail: "" },
      ],
      markSvg: '<svg viewBox="0 0 32 32" width="100%" height="100%"><path d="M4.5 12.5 27 9.5 27.5 20.5 5 23.5Z" fill="currentColor"/><path d="M10 16.5l3.8 3.8L22.5 11" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="stroke: var(--foreground)"/></svg>',
    },
    voice: {
      traits: ["Direct, not harsh", "Focused, not cold", "Honest, not judgy"],
      examples: [
        { moment: "Empty state", text: "Blank page. Write the one thing that matters." },
        { moment: "Task done", text: "Crossed off." },
        { moment: "Sync issue", text: "Not synced yet — saved on this device. Retrying." },
        { moment: "Carryover", text: "3 days waiting" },
        { moment: "Button", text: "Highlight next" },
      ],
    },
    rationale: [
      "A highlighter is how people with ADHD already rescue focus on paper: one bright stroke on the thing that matters. Here lime marks only 'now' and the primary action, so the eye lands there first.",
      "The graphite dot-grid page is the most literal desk-notebook feel, without cream paper or serifs; compact density fits more of the day on screen for a developer who scans fast.",
      "Anek Latin + Anek Bangla are one superfamily, so English and Bengali share width, weight and rhythm; Bricolage gives dates and titles a confident, hand-set character.",
    ],
    risks: [
      "Lime on light paper has almost no edge (1.2:1). Mitigation: every lime surface carries a 1.5px ink outline in light mode, and lime is never used for text.",
      "Most opinionated look; the grotesque + mono mix could feel 'techy'. Mitigation: mono only for times, estimates and pencil notes; soft highlighter pastels keep it friendly.",
    ],
    css: `
.btn-primary { border-color: var(--primary-foreground); }
.dt-pills { background: transparent; box-shadow: inset 0 0 0 1px var(--border); }
.dt-pills a.on { background: var(--foreground); color: var(--background); }
.dt-side { background: var(--background); }
.dt-day.on { background: transparent; color: var(--foreground); box-shadow: inset 3px 0 0 var(--primary); border-radius: 2px; }
.dt-note { background-color: var(--background); background-image: radial-gradient(circle, var(--rule) 1.3px, transparent 1.6px); background-size: 22px 22px; background-position: 11px 11px; }
.dt-todos { background: var(--card); gap: 14px; }
.dt-date { font-size: 38px; line-height: 1.05; }
.dt-date-day { color: var(--muted-foreground); font-weight: 500; }
.dt-date-d, .hl { background: var(--primary); color: var(--primary-foreground); padding: 0 0.18em; border-radius: 3px 8px 4px 9px / 9px 4px 8px 3px; box-decoration-break: clone; -webkit-box-decoration-break: clone; }
.dt-wschip { border-radius: 4px; font-family: var(--font-mono); font-weight: 500; }
.dt-page h4 { font-family: var(--font-heading); font-size: 18px; letter-spacing: -0.01em; }
.dt-now { border-radius: 6px; box-shadow: inset 0 0 0 1.5px var(--now-fg); padding: 14px 16px; }
.dt-now-title { font-size: 20px; }
.dt-now-bar { display: block; height: 4px; border-radius: 0; background: color-mix(in oklch, var(--now-fg) 18%, transparent); }
.dt-now-bar i { border-radius: 0; }
.dt-now-btn { border-radius: 4px; border-color: var(--now-fg); }
.dt-group-h { padding-bottom: 4px; border-bottom: 1px dashed var(--border); margin-bottom: 4px; }
.dt-sig { color: var(--foreground); font-size: 14px; }
.dt-group-h h3 { background: var(--pc); color: var(--pc-on); padding: 0 6px; border-radius: 2px 6px 3px 7px / 7px 3px 6px 2px; }
.dt-task { padding: 6px 6px; }
.dt-check { border-radius: 3px; border-color: var(--muted-foreground); }
.dt-task.done .dt-check { background: transparent; border-color: var(--muted-foreground); color: var(--foreground); }
.dt-task.done > .dt-task-main .dt-task-text { text-decoration-thickness: 2px; text-decoration-color: var(--foreground); }
.dt-task.is-now > .dt-task-main .dt-task-text { display: inline; background: var(--primary); color: var(--primary-foreground); padding: 0 4px; border-radius: 2px 6px 3px 7px / 7px 3px 6px 2px; box-decoration-break: clone; -webkit-box-decoration-break: clone; }
.dt-status { background: transparent; color: var(--foreground); box-shadow: inset 0 0 0 1px var(--border); border-radius: 4px; }
.dt-age { font-family: var(--font-mono); font-style: italic; font-weight: 400; }
.dt-age[data-days="3"] { font-weight: 500; }
.dt-age[data-days="6"] { font-weight: 600; }
.dt-toast { border-radius: 6px; }
.dt-toast-btn { border-radius: 4px; }
.dt-x { border-radius: 6px; }
.dt-stage .st { border-radius: 4px; }
.dt-stage .st.cur { box-shadow: inset 0 0 0 1.5px var(--primary-foreground); }
.dt-next { box-shadow: inset 0 0 0 1.5px var(--primary-foreground); border-radius: 4px; }
.dt-card-mini { border-radius: 4px; }
`,
  },
};

// B2 — revision of B ("B, but much darker"): same identity, type, shapes and copy; deeper dark tokens (see build-tokens.mjs)
// plus a few dark-only depth touches: hairline pane rims, a lilac rim on the deep Now block, soft black shadow.
const DARK = ':root[data-theme="dark"]';
D.B2 = {
  ...D.B,
  slug: "pocket-stickers-deep",
  name: "Pocket Stickers — Deep",
  oneLiner: "B after feedback: the same pastel stickers, washi tape and ring timer on a near-black plum page — A's depth, B's friendliness.",
  rationale: [
    ...D.B.rationale.slice(0, 2),
    "Revision: the dark page drops to near-black plum (L 0.145) with surfaces stepped only ~0.03 apart, so depth comes from quiet layers like A — the stickers are dimmed a notch so they read as paper, not neon.",
  ],
  risks: [
    D.B.risks[0],
    "Near-black surfaces can blur together on cheap screens. Mitigation: 1px hairline rims (foreground at ~6%) on panes and the Now block, and the three priority groups keep their own tinted wash.",
  ],
  css: D.B.css + `
.dt-now { box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--now-bar) 30%, transparent), var(--card-shadow); }
${DARK} .dt-note, ${DARK} .dt-todos { box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--foreground) 6%, transparent); }
${DARK} .dt-pills { box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--foreground) 6%, transparent); }
${DARK} .dt-now { box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--now-bar) 35%, transparent), 0 10px 28px -14px oklch(0 0 0 / 0.7); }
${DARK} .dt-group { box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--pc) 10%, transparent); }
${DARK} .dt-date-d { box-shadow: 0 4px 10px -6px oklch(0 0 0 / 0.6); }
`,
};

let tpl = readFileSync(TPL, "utf8");
// Small engine tweaks (outside the config/template): dark-first default theme, product-true nav labels.
tpl = tpl.replace(
  'setTheme(params.get("theme") === "dark" ? "dark" : "light");',
  'setTheme(params.get("theme") === "light" ? "light" : params.get("theme") === "dark" ? "dark" : (D.defaultTheme || "light"));'
);
tpl = tpl.replace("<span>Product</span><span>Pricing</span><span>Customers</span>", "<span>Todos</span><span>Notes</span><span>Planner</span>");

const PRODUCT = { name: "DailyTodo", tagline: "One calm place for today" };
for (const [id, d] of Object.entries(D)) {
  const t = tokens[id];
  const cfg = {
    id, name: d.name, oneLiner: d.oneLiner, language: d.language, product: PRODUCT, defaultTheme: "dark",
    tokens: { light: t.light, dark: t.dark, ramp: t.ramp },
    fonts: d.fonts, type: d.type, shape: d.shape, motion: d.motion, hero: d.hero, wordmark: d.wordmark,
    voice: d.voice, rationale: d.rationale, risks: d.risks,
  };
  const configJs = `window.DIRECTION = ${JSON.stringify(cfg, null, 2)};\n// Token commands: ${t.commands.join(" | ")}\n`;
  let html = tpl.replace(/window\.DIRECTION = \{[\s\S]*?\n\};\n/, configJs);
  const css = (d.bengali ? bnImport(d.bengali) + "\n" : "") + BASE_CSS + d.css;
  const a = html.lastIndexOf('<template id="app-screen">');
  const b = html.indexOf("</template>", a) + "</template>".length;
  html = html.slice(0, a) + `<template id="app-screen">${screen(css)}\n</template>` + html.slice(b);
  if (!html.includes("defaultTheme")) throw new Error("config not replaced");
  writeFileSync(`${OUT}/${id}-${d.slug}.html`, html);
  console.log("wrote", `${OUT}/${id}-${d.slug}.html`);
}

let cmp = readFileSync(CMP, "utf8");
cmp = cmp.replace(/window\.DIRECTIONS = \[[\s\S]*?\];\nwindow\.PRODUCT = "[^"]*";/, `window.DIRECTIONS = ${JSON.stringify(
  Object.entries(D).sort(([a], [b]) => a.localeCompare(b)).map(([id, d]) => ({ file: `${id}-${d.slug}.html`, id, name: d.name, oneLiner: d.oneLiner })), null, 2)};\nwindow.PRODUCT = "DailyTodo";`);
cmp = cmp.replace('<button type="button" data-theme="light" aria-pressed="true">Light</button>', '<button type="button" data-theme="light" aria-pressed="false">Light</button>');
cmp = cmp.replace('<button type="button" data-theme="dark" aria-pressed="false">Dark</button>', '<button type="button" data-theme="dark" aria-pressed="true">Dark</button>');
cmp = cmp.replace('<p>Pick one, or mix: “A\'s colors with B\'s type”.</p>', '<p>Dark-first. Pick one, or mix: “A\'s colors with C\'s type”.</p>');
writeFileSync(`${OUT}/index.html`, cmp);
console.log("wrote index");

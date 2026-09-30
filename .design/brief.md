# Product brief — DailyTodo

<!-- Written by the brand-strategist agent (discover mode, scaffold context) from the codebase on 2026-10-01.
     Tags: (confident — <where seen>) or (guess). The user confirms guesses in the taste interview.
     Note: the reverted "Ember Journal" makeover is deliberately NOT used as input. The live look is "Warm Minimalism". -->

## The product

- **What it is (in a customer's words):** "My one calm place for today: what I must do, what's on my mind, how my day is shaped, and where my content ideas are." (guess, built from confident parts — `CLAUDE.md`, `src/app/*` routes)
- **Job to be done:** When I sit down (or grab my phone) and my head is full, I want to see *only today* — the few tasks that matter, a place to dump thoughts, and what I should be doing right now — so I can start without friction and not lose anything to forgetting. (guess — shaped by ADHD-specific features below)
- **Core value moment ("aha"):** Opening the app on a new day and finding yesterday's unfinished tasks and notes already carried over, with the list grouped into "Must do / Should do / Could do". Second aha: the Planner **Now** card telling you what this block is and how many minutes are left. (confident — carryover + `ensure-daily-today` in `CLAUDE.md`; label sets in `src/components/todos/todos-view.tsx:119-135`; NOW screen in `src/components/planner/planner-view.tsx`)
- **Main flows / screens:**
  1. `/todos` — daily page: priority groups (Critical/Important/Someday, or ADHD label sets), inline add, subtasks, estimates, focus timer + Focus Mode, "Worth a look" aging filter, Daily note (Tiptap) beside it, date history + Todo workspaces in the sidebar. The heart of the app. (confident — `todos-view.tsx`, 2,047 lines)
  2. `/planner` — NOW card + day strip + optional 24h clock; rare "Set up" tab for Weekday/Saturday/Sunday templates. (confident — `planner-view.tsx`)
  3. `/content-planner` — Content Conveyor: capture box → Inbox → Develop → Shoot next (5 soft cap) → Published, "Copy for ChatGPT", Review inbox overlay. (confident — `content-planner-view-root.tsx`, 2,601 lines)
  4. `/notes` — folders + full-width Tiptap note with Excalidraw drawings. (confident — `notes-view.tsx`)
  5. Auth: sign in / register / verify / reset (`src/components/auth/*`), desktop updater dialogs.
- **Business model and price level:** None. Private, single-user personal tool; no pricing, no marketing site. (confident — `"private": true` in `package.json`, personal macOS release docs, owner-email super-admin)
- **Stage:** established personal tool (≈100 commits, daily use, synced across devices). (confident — git log)
- **Platforms:** web (Next.js 16, Tailwind v4, shadcn/ui "base-nova") + Tauri 2 macOS desktop app; used on phone via the web build (mobile-first rules exist for Todos and Content Planner). (confident — `package.json`, `CLAUDE.md`)

## The customer

- **Primary user:** The owner (Ali), the only user. A developer and content creator who plans videos/posts, works at a desk on a Mac and captures on the phone while out. Has ADHD, so friction, too many choices, and "remembering to remember" are the main enemies. (confident for sole user/ADHD/creator — scaffold goal, `todos-view.tsx` ADHD label sets, content-conveyor memory, "Shoot next"; guess for exact working context)
- **Buyer:** same person.
- **Fears / frustrations:** apps that feel like a busy dashboard; too many decisions; guilt/judgment when a plan slips (the planner is deliberately "off-plan is silent"); losing a thought before it's written down; tools that need setup before they help. (confident — "no judgment", "damn simple", capture box, `CLAUDE.md` Planner + memory)
- **Aspirations:** feel calm and in control of today; start work fast; turn raw ideas into published content; a tool that feels personal and crafted, like a good paper notebook, not a SaaS product. (guess, strongly implied by "physical desk notebook" metaphor)
- **Products they already use and like:** Bear Notes, bullet journal (named in `CLAUDE.md`); Apple Reminders (inline add pattern); Trello-style boards; ChatGPT for drafting. (confident — `CLAUDE.md`) Others likely: Things 3, Notion. (guess)
- **Languages / regions / accessibility needs:** UI is English, but the user writes in **Bengali and Banglish** — Bengali strings are already in the Content Planner hint prompts (`content-planner-view-root.tsx:374-376, 2082`). Any font must cover Bengali (Source Sans 3 is loaded with `latin` only, so Bengali falls back to a system font today). ADHD: low decision load, one clear next action, calm motion, no nagging, strong "where am I / what now" cues. Bangladesh time zone (commit dates +0600). (confident — code; guess on how much of the notes are Bengali)

## The market

Competitors from general knowledge (web lookup not run; confirm if it matters):

| Competitor / alternative | How it looks (color, type, feel) | Position |
|---|---|---|
| Things 3 | White/light gray, system sans, blue accent, very refined, airy | Premium calm todo |
| Bear Notes | Warm-ish paper themes, red accent, typographic, editor-first | Writing-first notes |
| Sunsama / Amie | Light neutrals, soft pastel accents, rounded, "mindful daily planning" | Daily planning ritual |
| Tiimo / Structured | Bright color-coded timeline blocks, rounded, playful icons | ADHD / visual day planner |
| Notion | Near-white/black, gray UI, system sans, serif optional, dense | Do-everything workspace |
| Paper bullet journal | Cream paper, ink, handwriting, dot grid | The metaphor itself |

Category look: light gray/white surfaces, one blue or purple accent, system sans, pastel color-coded blocks for planners. Opportunity: **stand out gently** — no one else owns "a warm paper desk notebook that knows what time it is". Because this is a personal tool, "standing out" really means "feels like mine, not like a SaaS template".

## Current design (audit)

- **Tokens:** `src/app/globals.css` (4,845 lines). Two token systems side by side: legacy hex (`--paper #faf8f4`, `--ink-900`, `--line`, `--brand #2f6d62` teal, `--priority-1/2/3`, `--planner-*`) and shadcn oklch (`--background`, `--primary`, …) that are **not wired to each other**. Light `--primary` is near-black `oklch(0.205 0 0)`, not the teal brand. Neutrals warm (hue 85) in light but **cool blue-gray (hue ~250) in dark**, contradicting "warm". Radius `--radius: 0.625rem`, but CSS uses 20+ ad-hoc radii (999, 10, 8, 12, 9, 14, 6, 7, 11, 18, 20px). Dark mode: yes, toggle Light → Dark → System (`sidebar.tsx`), but `layout.tsx` hard-codes `className="dark"` before hydration, so light/system users get a dark flash. (confident)
- **Fonts:** Source Sans 3 (latin subset) for everything; JetBrains Mono referenced for timers but not loaded (falls back). No serif by rule. (confident — `layout.tsx`, `globals.css:1278`)
- **Component library:** shadcn/ui (base-nova, only 10 primitives in `src/components/ui/`) + @base-ui/react; most UI is hand-written BEM-ish classes in `globals.css`. Icons: lucide-react (+ @tabler/icons-react installed but unused). (confident)
- **Existing brand assets:** app icon `src-tauri/icons/app-icon.svg` (cream notebook page, teal checkmark) + generated .icns/.png; `src/app/favicon.ico`; no wordmark or logo; `public/` holds only Next.js starter SVGs. (confident)
- **Voice today:** plain, kind, a little ADHD-coach: "All caught up for now", "Nothing else scheduled today", "Free — your call", "What's on your mind?", "Ready when you know your point + one concrete example/method." Some leftover technical copy: "Your current workspace state is saved to PocketBase.", "Retry Check", "Labels: ADHD 2". Title-case is inconsistent ("Update Now" vs "Show all tasks"). (confident — strings in `src/components/**`)
- **Contrast audit** (`contrast-audit.mjs`): 4 required pairs fail, all in **light** mode — `muted-foreground` (#737373) on background/card/muted at 3.8–4.1:1, and focus `ring` at 2.24:1. Dark mode passes everything. Input borders are faint in both modes (1.4:1 / 1.6:1). Note: the audit also scanned stale CSS in `out/` (an old build), so rebuild before re-auditing. (confident)
- **Strengths to keep:** the notebook metaphor and cream paper feel; one quiet accent; desaturated priority colors with text labels; calm, judgment-free copy; the Planner NOW card + "Free — your call"; mobile-first single-pane patterns; ADHD label sets; Styling Removal Rule; auto-save everywhere.
- **Problems:**
  1. **No single source of truth for tokens** — two unlinked systems, ~95 raw hex/rgba values in CSS plus hard-coded hex in TSX (`#1f2430`, `#2f6d62`, `#4465e9` …), 20+ radii, `--primary` ≠ brand. Every new screen drifts.
  2. **Small, inconsistent type** — dozens of ad-hoc sizes, many below the 13px floor (0.65–0.78rem, 10–12px, `text-[10px]`/`text-[11px]`); hierarchy relies on one sans at many near-identical sizes, which reads "generic app", not "notebook". No Bengali-aware font.
  3. **"Warm" breaks in dark mode and in structure** — cool slate dark theme, hard-coded dark class + flash, huge mostly unlayered `globals.css` (only 3 `@layer` blocks) that fights Tailwind v4 utilities; light-mode secondary text and focus ring fail contrast.
- **Before screenshots:** skipped (scaffold context, per instructions).

## Open questions for the user

1. **Feel in three words?** e.g. (a) calm · warm · focused (b) crafted · personal · inky (c) light · airy · gentle (d) bold · energizing · clear.
2. **How far from today's look?** (a) Refresh — keep cream + teal + sans, fix quality (b) Evolution — keep cream paper, allow a new accent and a heading font (c) Fresh identity — anything goes except the notebook idea.
3. **Default theme you actually live in?** (a) Dark most of the time (b) Light by day, dark at night — follow system (c) Light. And should dark feel like (i) warm espresso/ink or (ii) cool slate as now?
4. **Headings: keep "no serif" rule?** (a) Keep one sans everywhere (b) A soft serif only for page titles/dates, to feel like a notebook (c) A handwritten/marker accent used very sparingly.
5. **Accent color:** (a) Keep teal `#2f6d62` (b) Warmer: terracotta/amber (c) Ink blue/indigo (d) Let the directions propose. Also: should priorities stay red/amber/sage?
6. **Density & text size:** (a) Airy, larger text (16px+ body, fewer items visible) (b) Balanced as now (c) Denser, more tasks on screen. And how much Bengali do you write in notes/cards (a) rarely (b) often (c) most of it?

## Answers (from the interview)

<!-- Filled in by /ui-ux-pro:scaffold after asking (2026-10-01). -->
- **Direction:** new direction — generate 2–3 previews to pick from (the reverted Ember Journal is not a candidate to reuse as-is).
- **Reference feel:** Tiimo (soft, friendly, colorful, ADHD-focused).
- **Feelings:** calm · friendly · focused · encouraging.
- **Motion:** subtle — state changes plus gentle entrances and feedback (checking a task, adding a card).
- **Expression:** polished with 2–3 product-specific signature details.
- **Theme:** mostly dark — dark is the primary experience, light must still work (follow system allowed, but design dark first).
- **Bengali:** written often — Bengali must look first-class; font choices must pair with a good Bengali face.
- **Deletes:** low-stakes (a todo) = instant + Undo toast; big deletes (workspace, folder, column) keep a confirm dialog.
- **Not asked (directions may propose):** accent color, heading font / serif rule, density.

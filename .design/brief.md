# Product brief — DailyTodo

<!-- Written by the brand-strategist agent (discover mode) from the codebase. Tags: (confident — <source>) or (guess). The user confirms guesses. -->

**Makeover goal (user's words):** "more premium, appealing visual".

## The product

- **What it is (in a customer's words):** "My one calm place for today — my todo list, a daily note that carries over, my notes, my day plan, and my content ideas." (confident — CLAUDE.md, README "warm, notebook-inspired productivity app", layout.tsx meta "Todos, notes, and planning in one workspace")
- **Job to be done:** When I sit down to start (or restart) my day, I want to see exactly what's left, what I'm doing *now*, and dump new thoughts without friction, so I can stay focused without losing things or feeling behind. (guess — from carryover, "Worth a look", NOW screen, capture box)
- **Core value moment ("aha"):** Opening the app on a new day and finding yesterday's unfinished tasks and note already carried forward — nothing lost, no re-typing. Secondary: the Planner NOW card telling you what this block is and how long is left. (confident — CLAUDE.md "Carryover", "Day advance", planner-now.ts)
- **Main flows / screens:**
  - `/todos` — daily note (Tiptap + Excalidraw) beside priority-grouped todos (Critical / Important / Someday), date tree sidebar, workspaces, focus timer, focus mode (confident — todos-view.tsx)
  - `/notes` — folder tree + full-width note editor ("Quick Notes") (confident — screenshot)
  - `/planner` — NOW card + day strip + Set up (Weekday / Saturday / Sunday) (confident — planner-view.tsx)
  - `/content-planner` — 4-stage Content Conveyor (Inbox → Develop → Shoot next → Published), capture box, gallery/board, inbox review (confident — content-planner/)
  - Auth: sign in / create account / reset / verify (confident — src/components/auth/)
- **Business model and price level:** None — personal tool, no pricing, no marketing site. (confident — no pricing/landing routes; `private: true`; "Personal macOS release flow" in README)
- **Stage:** early (personal, daily-used by its owner) (confident — super-admin allowlist = owner, personal release docs)
- **Platforms:** web (Next.js 16 static export, Tailwind v4, shadcn/ui) + macOS desktop (Tauri 2). Mobile web is supported and actively tuned. (confident — package.json, CLAUDE.md)

## The customer

- **Primary user:** The owner himself — a developer/creator who plans content (videos about freelancing/careers), works from a Mac desk and a phone, and explicitly designs for **ADHD** (planner "ADHD-first", "Labels: ADHD 1/2", soft caps, no-judgment copy). Tech comfort: very high. Context: morning planning at the desk, quick capture on the go, glances at NOW during the day. (confident — CLAUDE.md, todos-view.tsx labels, memory notes; "creator" is a guess from content-planner copy "Ready to record")
- **Buyer (if different):** Same person. Possibly future small audience of similar ADHD creators. (guess)
- **Fears / frustrations:** Losing tasks between days; feeling judged by overdue lists; overwhelm from too many options/panels; tools that feel like work; data loss while typing. (confident — "Off-plan is silent (no judgment)", zero-data-loss autosave rules, soft caps)
- **Aspirations:** Feel calm and in control; start the day with clarity; turn scattered thoughts into shipped content; a tool that feels *crafted* and nice to open every morning (guess — implied by "premium" goal)
- **Products they already use and like:** Bear Notes, bullet journals, Notion, Apple Reminders (confident — CLAUDE.md "Bear Notes meets a bullet journal", "Apple Reminders style", "Notion-like" editor)
- **Languages / regions / accessibility needs:** UI in English; the user writes content in **Bengali** (Content Planner capture placeholder is Bengali) → fonts must cover Bengali script or fall back gracefully. A-/A+ reading-size controls, reduced-motion support, ADHD-friendly low-noise layout. (confident — content-planner capture placeholder, CLAUDE.md)

## The market

| Competitor / alternative | How it looks (color, type, feel) | Position |
|---|---|---|
| Things 3 | White/very light, blue accent, SF Pro, huge whitespace, tactile checkboxes — the benchmark for "premium todo" | Polished Apple-native task manager (general knowledge — not web-verified) |
| Bear | Warm paper or dark themes, red accent, refined serif/sans options, typographic focus | Beautiful writing app (general knowledge) |
| Sunsama / Akiflow | Light neutral, soft purple/blue, dense-but-calm daily planning, rounded cards | Paid "daily planning ritual" tools (general knowledge) |
| Notion | Black/white, near-no color, Inter-like sans, flat | Everything workspace (general knowledge) |
| Tiimo / Structured | Pastel, friendly, colorful timeline blocks, rounded | ADHD / visual day planners (general knowledge) |
| Paper notebook / bullet journal | Cream paper, ink, hand-drawn structure | The metaphor this app borrows (confident — CLAUDE.md) |

Category look: productivity is crowded with cool neutrals + blue/purple accents and Inter-style sans. ADHD planners lean pastel and playful. Opportunity: **stand out gently** — own the warm, crafted "desk notebook" feeling (Bear/Things-level polish, paper warmth, one confident accent) instead of looking like another shadcn dashboard. (guess)

## Current design (audit)

- **Tokens:** `src/app/globals.css` (4,836 lines). Two parallel token sets: custom (`--paper`, `--ink-*`, `--line`, `--brand` #2f6d62, priority + planner colors) and shadcn (`--background`, `--primary`…). In light mode shadcn `--primary` is still default near-black (#171717), not the teal brand; `--ring` is gray. Neutrals warm (hue ~85) in light, but **dark mode is cool blue-gray** (hue ~250, `--paper` #16191f) — contradicts "warm" pillar. `--radius` 0.625rem, but CSS uses **15+ different radii** (4, 6, 7, 8, 9, 10, 11, 12, 14, 18, 20, 24, 999px). ~43 distinct hardcoded hex colors in globals.css; ~20 ad-hoc font sizes (0.65–0.92rem, 10–13px). Most component CSS is **unlayered** despite the project's own Tailwind-layer rule. (confident — globals.css)
- **Dark mode:** yes, and it is the **default** (`<html className="dark">`, `themeMode: "dark"` in store.ts). Light mode exists but is secondary. CLAUDE.md token docs are out of date vs actual values (e.g. dark `--brand` #5ea89d, light `--paper-strong` #eee7dc). (confident — layout.tsx, store.ts:997)
- **Fonts:** Source Sans 3 only (next/font, latin subset only — no Bengali). No display face; hierarchy by weight/size. Monospace used for small counters ("0 cards"). (confident — layout.tsx, screenshot)
- **Component library:** shadcn/ui (10 components in `src/components/ui/`) + @base-ui; icons lucide-react (19 files) and @tabler/icons-react also installed. (confident)
- **Existing brand assets:** No real logo in-app — `.app-logo` is a plain 20px teal rounded square next to "DailyTodo" text. Desktop app icon `src-tauri/icons/app-icon.svg` = cream notebook page with pale lines and a teal checkmark (nice concept, basic execution). Favicon is the default `src/app/favicon.ico`; `public/` still holds Next.js starter SVGs. (confident)
- **Voice today:** Mixed. Warm, calm, human in newer areas: "Shape ideas into published work, one calm step at a time.", "It lands in your inbox — nothing else to fill in.", "Free — your call", "All caught up for now". Developer/placeholder copy in auth: "Reset password flow wired to PocketBase email", "Email/password sign-in with persistent sessions", "we'll ask PocketBase to send…". Inconsistent casing ("Reset Password", "Enter Focus Mode" vs sentence case). (confident — auth-gate.tsx, content-planner, todos-view.tsx)
- **Contrast audit:** 4 required pairs fail, all **light mode**: shadcn `muted-foreground` (#737373) on background/card/muted = 3.8–4.1:1 (<4.5), and focus `--ring` #a1a1a1 = 2.2:1 (<3). Input borders are faint in both modes (1.4:1 light, 1.6:1 dark — advisory). Dark mode passes everything. Light `destructive` #e40016 is 4.2:1 as text. (confident — contrast-audit.mjs)
- **Strengths to keep:** The notebook/paper concept; calm, low-noise ADHD-friendly structure; teal accent has equity (app icon, focus states); desaturated priority colors with text labels; strong behavioral copy in Content Planner and Planner; good empty states (content-planner example card); A-/A+ scaling; reduced-motion support.
- **Problems (vs "premium"):**
  1. **Reads as a generic dark shadcn dashboard, not a crafted notebook.** Default dark UI is cool slate blue-gray; the warm paper identity only shows in the (rarely seen) light mode. No typographic personality — one utility sans at small sizes.
  2. **Too many boxes and tints fighting each other.** Todos pane stacks bordered, color-washed cards (red/amber/green header bands + colored underline + teal-tinted pane + bordered workspace card), plus radial-gradient body glow. Premium tools use fewer containers, more space, and quieter color.
  3. **Weak brand presence and inconsistent details.** Placeholder logo square, default favicon, 15+ radii, 20+ tiny font sizes (many 10–12px, low legibility), two token systems (shadcn primary is black, ring gray), docs drift from code.
  4. Secondary: mobile layout at 390px showed sidebar + content overflowing horizontally in headless capture (verify on a real device) (guess); developer-facing auth copy.
- **Before screenshots:** `.design/screenshots/before/` — `todos-desktop-empty.png`, `notes-desktop.png`, `planner-desktop.png`, `content-planner-desktop.png`, `todos-mobile.png`, `content-planner-mobile.png`. Captured with headless Chrome on a fresh profile, which lands in the local **dev workspace** (empty data, not production). Populated signed-in screens were viewed read-only in the browser pane but not saved.

## Open questions for the user

1. **Who is this for going forward?** (a) Just me — polish my daily tool; (b) Me now, maybe share with a few ADHD friends/creators later; (c) Heading toward a public product (then a landing page + stronger brand matter).
2. **Dark or light as the hero?** (a) Keep dark default, make it warm and rich (espresso/ink, not slate); (b) Make warm paper light the default, dark as option; (c) Follow system setting, both equally polished.
3. **How far can we go?** (a) Refresh — same teal + sans, fix quality/consistency; (b) Evolution — keep notebook metaphor + teal family, add a display/serif face and a real logo; (c) Full rebrand — new color, type, maybe name.
4. **What does "premium" mean to you?** (a) Things 3 / Apple calm and precise; (b) Bear / editorial, bookish, paper-and-ink; (c) Linear / Raycast dark, sharp, pro-tool; (d) Tiimo-style soft and friendly.
5. **Keep list:** the name "DailyTodo", the teal accent, the "no serifs" rule, and the notebook app icon — which are sacred? (Yes/no each.)
6. **Scope:** (a) Visual language only; (b) + voice/copy pass (auth copy, casing); (c) + logo/app icon/favicon.

## Answers (from the interview)

- **Premium feel:** Tiimo — soft, friendly (rounded, gentle colors, ADHD-friendly warmth).
- **Boldness:** Evolution — keep notebook idea, add character, real logo, cleaner surfaces.
- **Default theme:** Follow system; light and dark both get the warm treatment (no cool slate dark).
- **Keep:** Nothing fixed — name, teal, no-serif rule and app icon are all open to change.
- **Scope:** Everything needed to make it appealing AND useful for ADHDers — visual language, copy/voice pass, logo + wordmark + favicon + app icon.
- **Audience:** Public product — must appeal to strangers (ADHD adults/creators), not just the owner.
- **References:** Tiimo (admired).

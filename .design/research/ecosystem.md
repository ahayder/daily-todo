# Ecosystem research — DailyTodo

Checked: 2026-10-01 (web search + fetch). Scope: this stack only — Next.js 16 App Router (`output: "export"`), Tailwind v4, shadcn/ui `base-nova` on Base UI, lucide, tw-animate-css, Tiptap 3, dnd-kit, Tauri 2.

## 0. What the project already has (baseline)

| Area | Installed | Evidence |
|---|---|---|
| shadcn CLI | `shadcn` 4.0.5, style `base-nova`, `iconLibrary: lucide`, `registries: {}` | (confident — package.json, components.json) |
| Primitives | `@base-ui/react` 1.2.0 (no direct `@radix-ui` imports in `src`) | (confident — src/components/ui/*.tsx imports) |
| `asChild` shim | `popover.tsx` / `tooltip.tsx` add an `asChild` prop on top of Base UI's `render`; 44 `asChild` uses vs 6 `render={` | (confident — src/components/ui/popover.tsx:12, tooltip.tsx:25) |
| Tailwind | 4.2.1, `@theme inline` bridge, `@custom-variant dark (&:is(.dark *))` | (confident — globals.css:5, :4793) |
| globals.css | 4,845 lines of bespoke CSS, 5 `@keyframes` | (confident — wc/grep) |
| Motion | tw-animate-css 1.4.0 + `shadcn/tailwind.css`; `duration-150` ×54, `duration-200` ×1; no JS motion lib | (confident — grep src) |
| Icons | lucide-react (19 files); `@tabler/icons-react` installed, 0 imports | (confident — grep src) |
| Editor menus | slash command still uses `tippy.js` | (confident — src/components/editor/slash-command.tsx:4) |
| Celebration | `canvas-confetti` with `disableForReducedMotion: true`, 6 hardcoded hex colors | (confident — src/lib/confetti.ts) |
| Fonts | `next/font/google` Source Sans 3 only | (confident — src/app/layout.tsx:2) |
| Agent files | `CLAUDE.md` (canonical, "Warm Minimalism"), `AGENTS.md` (29 lines, defers to CLAUDE.md), `.claude/skills/design-system` | (confident — files) |

## 1. Component source

| Candidate | What it is | Fits because | Cost / risk | Verdict |
|---|---|---|---|---|
| **shadcn/ui on Base UI (current setup)** | Base UI became shadcn's default base in Jul 2026; CLI v4 (Mar 2026) adds `--dry-run`, `--diff`, `--view` | Project is already on `base-nova` — aligned with upstream default, no migration | None | **recommend — keep** (confident — https://ui.shadcn.com/docs/changelog) |
| Base UI 1.2 → 1.8 | Minor releases through Sep 2026 | Bug fixes; same API line | Low; re-run tests | optional (confident — https://base-ui.com/react/overview/releases/v1-6-0.md; 1.8 date per search, guess) |
| `shadcn diff` before adding | CLI v4 compares local vs registry | UI files are customized (asChild shim); diff avoids overwriting | None | recommend as a workflow rule (confident — changelog) |
| `cn` package | Sep 2026: shadcn components import `cn` from package `cn`; `shadcn migrate cn` rewrites `lib/utils.ts` users | New components will install it anyway | Low; optional — "nothing breaks" | optional; decide once so new adds don't create two `cn`s (confident — https://ui.shadcn.com/docs/changelog/2026-09-cn) |
| Base UI **Toast** (Jul 2026) | Toast with actions, promises, stacking | Only if the brain adopts "undo instead of confirm" for low-stakes deletes | New component, no new dep beyond Base UI | optional — tie to patterns decision (confident — search result summarizing shadcn changelog) |
| Community registries (Registry Directory, `@tailark-oss`, 7ovr) | Installable blocks via `shadcn add @ns/item` | Mostly marketing/SaaS pages (heroes, pricing, dashboards) | Foreign visual language; would fight the notebook feel | **skip** (confident — https://ui.shadcn.com/docs/directory) |
| **Build own blocks locally** | Project blocks in `src/components/…` (task row, day header, empty state, section header, confirm-delete) | Domain-specific; nothing in registries matches a daily notebook | Time, not deps | **recommend** (guess — judgment) |
| Own private registry (GitHub, Aug 2026) | Publish blocks as a registry | Single app, single dev | Overhead with no second consumer | skip (confident — changelog "Private GitHub Registries") |
| Tiptap UI Components / `simple-editor` | MIT toolbar/menu kit via `@tiptap/cli` | Project already has its own toolbar, bubble menu, slash command | Second styling system inside the editor | skip (confident — https://tiptap.dev/docs/ui-components/templates/simple-editor.md) |
| **Replace tippy.js in slash command** | Tiptap v3 moved all menus to Floating UI; tippy no longer needed | Removes a dep and a second popover look; slash menu can reuse Base UI Popover/`@floating-ui` styling tokens | Small refactor of one file | **recommend** (confident — https://tiptap.dev/docs/guides/upgrade-tiptap-v2) |
| dnd-kit (`core` + `sortable`) | Current drag library | Already used for kanban + todos; still the community default | none | keep (confident — package.json; https://www.pkgpulse.com/guides/dnd-kit-vs-react-beautiful-dnd-vs-pragmatic-drag-drop-2026) |

## 2. Motion

| Candidate | Fits because | Cost / risk | Verdict |
|---|---|---|---|
| **CSS + tw-animate-css (current)** | Already drives dialogs/popovers (`animate-in`, `fade-in-0`, `zoom-in-95`); matches CLAUDE.md 160–220 ms, no spring | None. Note: 54× `duration-150` sits just under the documented 160–220 ms band — define one token (e.g. `--duration-ui`) and align | **recommend — primary** (confident — grep) |
| React `<ViewTransition>` (Next 16 App Router) | Works "with no configuration" in App Router (docs v16.3.8, Aug 2026). Good for: Todos ↔ Daily note switch, top-nav route changes (crossfade, anchored header), Now card updates | Needs Chromium 125+/recent Safari; Tauri macOS uses WKWebView (guess: fine on current Safari, may not animate on older macOS — degrades to instant swap). Must add reduced-motion CSS | optional — crossfades only, no directional slides (confident — https://nextjs.org/docs/app/guides/view-transitions) |
| `motion` (motion/react v12) | Layout animations (task completing/reordering, card moving columns) | ~34 KB full / ~4.6 KB with `LazyMotion`+`m`; new dep; springs are default — must configure tween to obey "no spring" | skip unless a concrete layout-animation need appears (confident — https://www.pkgpulse.com/guides/framer-motion-vs-motion-one-vs-autoanimate-2026) |
| dnd-kit built-in transitions | Sortable already animates drag reorder | none | keep; set its transition duration to the motion token (guess) |
| canvas-confetti | Existing completion reward; ADHD-friendly positive feedback | Colors are hardcoded hex — read from CSS tokens | keep, tokenize colors (confident — src/lib/confetti.ts) |

## 3. Theming / tokens

- **Best practice (Tailwind v4 + shadcn):** semantic tokens as CSS variables in `:root` / `.dark` (OKLCH), mapped to utilities via `@theme inline`; the project already follows this shape (confident — globals.css:4793; https://ui.shadcn.com/docs/skills "CSS variables, OKLCH colors, dark mode").
- **Custom product tokens** (paper, ink, line, brand…) should be added to the same `@theme inline` block so they become utilities (`bg-paper`) instead of bespoke CSS classes (guess — standard v4 pattern).
- **Main debt is not tooling but size:** 4,845-line `globals.css`. Direction: move component styling into Tailwind utilities + CVA variants in components; keep globals to tokens, base layer, editor/Excalidraw overrides (guess — judgment; ties to CLAUDE.md "@layer" rule).
- **Dark mode:** class strategy via `@custom-variant dark` + system default + pre-hydration inline script is correct for a static export in Tauri (no SSR cookie available) (confident — next.config `output: "export"`; CLAUDE.md).
- **Tailwind 4.3** (May 2026) adds `scrollbar-*`, `scrollbar-gutter-*`, `@container-size` — useful for kanban columns, sidebar, card bodies that scroll. Upgrade 4.2.1 → 4.3.x: optional, low risk (confident — https://releases.sh/tailwind-css/tailwind-css/highlights).
- **Fonts:** `next/font` self-hosts at build, works with static export and offline Tauri (guess — standard behaviour). Keep; add a display face only if the visual direction calls for one.
- **Radius/space:** radius scale already derived from `--radius` (confident — globals.css:4829-4835). Spacing uses Tailwind default scale; no change needed.

## 4. AI-agent tooling

| Candidate | What / how | Fits because | Verdict |
|---|---|---|---|
| **AGENTS.md ↔ CLAUDE.md wiring** | Claude Code reads AGENTS.md natively only when no CLAUDE.md exists; with both, it reads CLAUDE.md unless CLAUDE.md contains `@AGENTS.md` | Repo has both; AGENTS.md currently only points at CLAUDE.md, so other agents get rules second-hand | **recommend:** put the shared brain in AGENTS.md and add `@AGENTS.md` at the top of CLAUDE.md (or keep CLAUDE.md canonical — decide once) (confident — https://www.eesel.ai/blog/claude-code-agents-md) |
| **shadcn skill** | `pnpm dlx skills add shadcn/ui`; runs `shadcn info --json`, knows Radix vs Base UI, CLI flags, theming | Concrete need: this is a Base UI project with a local `asChild` shim — agents trained on Radix shadcn will write `asChild` on Dialog/AlertDialog/Select where it does not exist | **recommend** (confident — https://ui.shadcn.com/docs/skills) |
| shadcn MCP | `pnpm dlx shadcn@latest mcp init --client claude` → `.mcp.json` | Lets agents search/add official items; `registries: {}` so value is limited to the official catalog | optional (confident — https://ui.shadcn.com/docs/mcp) |
| `vercel-react-view-transitions` skill | `npx skills add vercel-labs/agent-skills --skill vercel-react-view-transitions` | Only if ViewTransition is adopted | optional (confident — nextjs.org view-transitions guide) |
| context7 MCP | Already available in this environment | Up-to-date Tiptap / Base UI / Tailwind docs for agents | keep (confident — session tools) |
| Project skill `.claude/skills/design-system` | Existing "Warm Minimalism" checklist | Should be regenerated from the new DESIGN.md, not left parallel | replace in scaffold phase (confident — file) |

## 5. Other relevant approaches (only where the repo shows a need)

| Need seen in repo | Option | Verdict |
|---|---|---|
| Two icon sets installed | Remove unused `@tabler/icons-react`; lucide only (matches `components.json`) | **recommend** (confident — 0 imports) |
| tippy.js only for slash menu | Drop after migrating to Floating UI / Base UI popover | **recommend** (see §1) |
| Forms (auth, planner setup, capture box) are small | No form library; Zod already present for schema | skip react-hook-form (guess — judgment) |
| Charts | Planner pie is custom SVG from `planner-radial-utils.ts`; no chart lib needed | skip (confident — CLAUDE.md architecture) |
| Toast / undo | None installed; Base UI Toast exists if an undo pattern is chosen | optional (see §1) |

## Open questions

1. **Brain file placement:** (a) AGENTS.md holds the brain, CLAUDE.md imports it with `@AGENTS.md`; (b) CLAUDE.md stays canonical, AGENTS.md stays a pointer; (c) both, with the design section duplicated.
2. **`asChild` shim:** (a) keep it and document "asChild only on Popover/Tooltip"; (b) migrate call sites to Base UI `render` and delete the shim; (c) extend the shim to all triggers.
3. **Route/state transitions:** (a) CSS only (tw-animate); (b) add React `<ViewTransition>` crossfades for nav + Todos/Note switch; (c) add `motion` for layout animations too.
4. **Low-stakes deletes:** (a) always AlertDialog (current rule); (b) Toast with Undo for reversible items, AlertDialog for workspaces/columns.
5. **Dependency hygiene now or later:** (a) in scaffold phase: remove tabler + tippy, `migrate cn`, bump Base UI/Tailwind; (b) only remove unused deps; (c) defer all.

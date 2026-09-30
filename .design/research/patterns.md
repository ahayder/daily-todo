# Patterns research — DailyTodo

Checked 2026-10-01 on branch `dev` (after revert aa86b68). Reference: `ui-standards/references/ux-patterns.md`.
Paths are relative to `src/components/` unless noted. Screens: `/todos` (daily note + todos + focus mode), `/notes`, `/planner` (NOW + Set up), `/content-planner`, auth screens.

## 1. UX patterns in use

| Pattern | Today (evidence) | Consistent? | Proposed standard |
|---|---|---|---|
| **Destructive actions** | AlertDialog for note, folder (notes/notes-view.tsx:75,145), planner preset (workspace/sidebar.tsx:~860), planner block (planner/planner-view.tsx:511), todo workspace (todos/todos-view.tsx:1175), content card + column (content-planner/content-planner-view-root.tsx:2522,2556). Review-inbox uses "Tap again to delete" (…-root.tsx:1446–1555). **Todo row delete is instant, no confirm, no undo** (todos-view.tsx:737). **Status change asks for confirmation** (todos-view.tsx:823). `window.confirm` for timer switch (todos-view.tsx:1473). (confident) | No — 7 hand-built dialogs; copy varies: "Delete"/"Remove", "Cancel"/"Keep", "cannot be undone" vs "permanently removed" | One `ConfirmDialog` block: title "Delete '{name}'?", consequence sentence, "Cancel" + destructive "Delete {noun}". Low-value, recoverable items (a single todo) → act + Undo toast instead. Drop the status-change confirm. Replace `window.confirm`. |
| **Inline add / capture** | Todos: `InlineTaskInput` per priority group, Enter submits (todos-view.tsx:318–360); subtask composer, Enter (todos-view.tsx:881). Content: `InlineCardComposer` closed "Add card" button → textarea, Cmd/Ctrl+Enter submits, Esc cancels, Cancel/Add buttons (…-root.tsx:884–965); capture box to Inbox. Planner: "+ Add block" appends instantly (planner-view.tsx:618). Notes: create from sidebar. (confident) | Partly — single-line vs multi-line differ correctly, but look & focus treatment are hand-styled each time | `InlineComposer` block with two variants: `line` (Enter adds, stays focused for rapid entry) and `block` (Cmd+Enter adds, Esc cancels, explicit buttons). Same `+` affordance, placeholder voice, focus ring. |
| **Empty states** | `.empty-view` icon at 30% opacity + one line, **no action**: todos-view.tsx:1498, notes-view.tsx:112,123. Todo group: `<li>No tasks yet</li>` (todos-view.tsx:2034). Focus mode empty with Exit button (todos-view.tsx:1515). Rich teaching empty state only in content planner (`ContentConveyorEmptyState`, …-root.tsx:1589). Review filter: "All caught up for now" (todos-view.tsx:1904). (confident) | No — one excellent, the rest bare | `EmptyState` block (icon, title, one-line body, optional primary action). Content Conveyor empty state is the model: teach by doing. |
| **Loading** | 3 styles: `AppLoadingScreen` card (app/app-provider.tsx:88), CSS border spinner (todos-view.tsx:~1815), `LoaderCircle animate-spin` in buttons (auth-gate.tsx:324, password-reset-screen.tsx:108); note body "Loading note…" rendered as empty-view (notes-view.tsx:198); planner text "Loading your planner…" (planner-view.tsx:651). 10 `animate-spin` uses. (confident) | No | Cache-first app → prefer no spinner on warm start; `Spinner` only inside buttons; content areas use a quiet paper skeleton (lines), never a centered spinner over a notebook page. |
| **Errors & sync status** | Sync pill in top nav: Saving…/"Last saved 3m ago"/issue + Retry, `aria-live` (workspace/top-navbar.tsx:200–330). Auth error box with hardcoded rgba (auth-gate.tsx:305). Update error box via color-mix (desktop-update-provider.tsx:512). Note body errors shown as empty-view (notes-view.tsx:189,205). (confident) | Partly — sync status is good; inline error boxes are one-offs | `InlineAlert` block (tone: warn/info) with fix-it copy + optional action; keep sync pill as the single global status surface; no toasts for autosave. |
| **Feedback** | No toast system (no sonner/toast grep hits). Copy on content cards confirms in place (…-root.tsx:870 `role=status`). Completion confetti (lib/confetti.ts, todos-view.tsx:446). (confident) | n/a | Add one toast primitive only for Undo (delete todo/card). Keep in-place confirmations. |
| **Toggles / segmented** | 5 hand-rolled: planner `Segmented` (planner-view.tsx:94), content Board/Gallery (…-root.tsx:2048), move placement (…-root.tsx:2368), todos mobile Todos/Daily note tablist (todos-view.tsx:1766), nav pills tablist (top-navbar.tsx:270). (confident) | No — 3 use `aria-pressed`, 2 use `role=tab` | `SegmentedControl` block (radio-group semantics, 2–4 options, `fill` option). Nav pills stay separate (navigation, not state). |
| **Overflow menus** | Popover + hand-built `role="menu"` for card and column actions (…-root.tsx:714–760, 1205–1275); sidebar profile menu hand-built (sidebar.tsx:173). No DropdownMenu primitive in `ui/`. (confident) | No | Add shadcn `dropdown-menu`; destructive item always last, separated, warn tone. |
| **Screen headers** | Todos note pane h2 `text-2xl` date + workspace chip (todos-view.tsx:1799); todo pane h2 `text-xl` "Todos" + subtitle (1855); planner h1 `1.5em` day name / "Your ideal days" (planner-view.tsx:296,559); content planner h1 font-lg/xl (…-root.tsx:1986); notes title is an input (notes-view.tsx:136). (confident) | No — 4 scales, 3 structures | `PageHeader` block: title (serif-ready), one-line subtitle, right-side actions slot, optional meta chip. Collapses to one row on phones (content planner already does). |
| **Surfaces & chips** | `rounded-2xl border border-[var(--line)] bg-[var(--paper-strong)] shadow…` hand-written 14× (planner, content, auth, dialog). Local `WARM_SHADOW` (planner-view.tsx:164, rgba hardcoded) and `FOCUS_RING` (planner-view.tsx:90) consts. Hand-built `rounded-full border` chips 6× (todos, content, auth). (confident) | Visually yes, structurally no | `Surface`/`Card` variant + `Chip` (Badge variant) with tokens; delete local consts. |
| **Buttons** | Raw `<button>` dominates: content 36 raw / 0 `<Button>`, sidebar 18/0, navbar 5/0, todos 20/13. Class strings of 300+ chars repeated for ghost/primary buttons (…-root.tsx:903,960). (confident) | No | `Button` + `IconButton` (built-in Tooltip + required `aria-label`, satisfies CLAUDE.md icon-button rule). |
| **Navigation** | Top nav pills + sync + theme; sidebar only on todos/notes; planner and content planner full-width (workspace/workspace.tsx). Active pill state present. (confident) | Yes | Keep. Standardise the full-width vs sidebar rule in the brain. |
| **Responsiveness** | Content planner: 3 `matchMedia` hooks (touch-first, desktop, compact mobile) (…-root.tsx:134–205); navbar own `max-width:639px` hook (top-navbar.tsx:113); todos uses CSS `data-mobile-pane` (todos-view.tsx:1760). Coarse-pointer → no drag, explicit move dialogs. (confident) | Logic good, code duplicated | Shared `useMediaQuery` + named queries (`touchFirst`, `compact`, `desktop`) in `lib/`. Rule: coarse pointer never depends on drag or hover. |
| **Keyboard** | Global font scale Cmd +/−/0 (workspace.tsx:~50–77); Enter adds todo; Cmd+Enter adds card; Esc closes composers/menus (sidebar.tsx:162, …-root.tsx:1454); dnd-kit keyboard sensors in todos/content/sidebar. No ⌘K / `/` shortcuts. (confident) | Mostly | Document the shortcut table in the brain; `Kbd` hint element in tooltips. |
| **Accessibility** | Tooltip + aria-label on most icon buttons (todos 14, content 38 labels); focus-visible classes inline in content (47) and planner (9) but 0 inline in sidebar/navbar/notes (may come from globals.css — guess). `motion-reduce` inline mostly in content (30); global reduce query at app/globals.css:4689. Priorities use symbol + label (CLAUDE.md). (confident / guess as marked) | Uneven | Focus ring + reduced motion baked into primitives, not per-call. |

Other facts: `planner/planner-tour.tsx` (252 lines) is not imported anywhere — dead code (confident — grep). Motion durations in code: 150ms/`duration-150` ×134 vs CLAUDE.md rule "160–220ms" (confident — grep counts).

## 2. Standard vs judgment

**Can be standardised now (no product call needed)**
- Confirm-dialog anatomy + copy ("Delete '{name}'?", consequence, "Cancel" / "Delete {noun}"); "Delete" everywhere (not "Remove") unless the item survives elsewhere.
- EmptyState, InlineComposer, PageHeader, SegmentedControl, IconButton, InlineAlert, Chip, Surface anatomy.
- Loading policy (no spinner over cached content), focus ring, reduced motion, 44px touch targets, shared media queries.
- Microcopy: sentence case (fix "Remaining Time", "Retry Check", "Exit Focus Mode" casing — todos-view.tsx:~1580, desktop-update-provider.tsx:445).

**Needs the user's decision**
- Todo delete: keep instant (fast, ADHD-friendly) + Undo toast, or confirm? (CLAUDE.md says "always AlertDialog"; code doesn't.)
- Status-change confirmation in todos: keep or drop?
- Review-inbox "tap again" vs dialog — allowed exception for triage speed?
- Celebration: confetti on every completion, only on priority-1, or opt-out?
- Soft caps (Shoot next N/5) — extend the idea to todos (e.g. Must-do ≤ 3) or keep content-only?

## 3. Custom design opportunities

| # | What | Where (real screens) | Why ownable | Systematic rules | Cost |
|---|---|---|---|---|---|
| 1 | **Now card** — one signature block: label "Now", current thing, time range, thin progress bar, "N min left", next-up line | Planner NOW card (planner-view.tsx:~240–290); Focus mode card + timer (todos-view.tsx:~1560–1600); optional mini "Now" chip in top nav | Both screens already answer "what am I doing right now?" with different anatomy; unifying makes it the product's face for ADHD focus | One component, variants `block` (planner) / `task` (focus timer) / `mini`; mono tabular numerals; progress uses the single accent; never red when over time (off-plan is silent) | M |
| 2 | **Carryover marginalia** — ink-style age mark ("From yesterday", "3 days waiting") in the task row margin, like a pencilled note in a notebook | Todo rows (`getTaskAgeLabel`, todos-view.tsx:469, lib/task-attention.ts:15); "Worth a look" banner (todos-view.tsx:1903); focus-mode card | Carryover is the app's core behaviour; making it look like handwriting in the margin fits the notebook metaphor and stays non-judgmental | Muted ink only, never warn color; max 1 mark per row; grows in weight (1 → 3+ days) not in color; hidden when finished | S |
| 3 | **Stage track** — compact conveyor breadcrumb `Inbox › Develop › Shoot next › Published` with current stage stamped | Content empty state breadcrumb (…-root.tsx:1589), Gallery stage labels, card next-step button, Review inbox overlay | The Content Conveyor is unique to this product; one visual for "where is this card" reduces re-learning across Board/Gallery/Review | Stage ids from `content-conveyor.ts`, never titles; current = filled stamp, past = ink, future = dimmed; next-step button label reads from the same map | S–M |
| 4 | **Gentle limit meter** — soft-cap badge that tints, never blocks | Shoot next `N/5` (…-root.tsx:1171); candidate for priority-1 todos and planner hours-planned summary (planner-view.tsx:~575) | Encodes the ADHD-first stance ("nudge, don't nag") as a reusable element | Tint at cap+1, no modal, no red; count + cap in tabular numerals; aria-label "3 of 5" | S |

## 4. Motion opportunities

**Clarifies (use 160–220ms ease-out, opacity/transform only, off under reduced motion)**
- Todo complete: check → row settles into finished (fade + slight collapse); confetti stays small and optional.
- Carryover arrival on a new day: carried tasks fade in once with the margin mark.
- Card advancing a stage (`Develop this →`): card leaves column / appears in next with a short slide in stage direction.
- Now card progress bar width (already `transition-[width] duration-200`, planner-view.tsx:~268) and block change on the 30s tick: crossfade title.
- Composer open/close, menu/popover/dialog enter (tw-animate already in ui/dialog.tsx:42).
- Sync pill state change (Saving… → Saved): crossfade, no spin.

**Distracts (avoid)**
- Animating the notebook page / editor on every day switch or keystroke.
- Looping or pulsing indicators (timer, soft-cap badge, attention banner).
- Masonry Gallery reflow animation, drag ghosts with springs/bounce.
- Anything > 300ms; Tiptap/Excalidraw internals.

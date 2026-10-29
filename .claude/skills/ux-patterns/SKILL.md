---
name: ux-patterns
description: Use when building forms, validation, loading states, errors, empty states, destructive actions (delete, remove, cancel), navigation, responsive layouts, keyboard behavior, or accessibility in DailyTodo. The project's standard UX patterns with the components that implement them, plus which decisions still need the user's approval.
---
<!-- ui-brain:skill v1 -->

# DailyTodo UX patterns

**Standard** = decided; just do it. **Ask** = needs product judgment; propose and wait. Context: a single user with ADHD — fewer decisions, one clear next step, no guilt.

## Clarity

Every screen must be obvious:
- A first-time user must instantly know, on any screen: where they are, what it's for, what to do, and what happens when they do it (the 5-second test).
- Before building a screen, decide in 3 lines: who is here and what they want · the one main action · what they see after it.
- One primary action per view, labelled verb + noun with its outcome ("Send invoice", not "Submit"). No mystery icons, dead ends, silent failures, or unexplained disabled buttons.
- When style and clarity disagree, clarity wins.

How DailyTodo does it:
- Titles name the thing (`PageHeader`; dialogs say `Delete "{name}"?`, not "Are you sure?").
- One filled lilac `Button` per view; everything else `soft` / `ghost` / `outline`. Icon-only actions use `IconButton` (its `label` is the tooltip).
- Empty states invite one small step (`ContentEmptyState` is the model); "filtered to nothing" offers to clear the filter.
- Every action gives feedback: autosave → sync pill; quick delete → Undo toast; big delete → `ConfirmDialog`.
- No backend or dev words in the UI ("PocketBase", "record", "sync outbox", error codes) — say what it means for the user ("Saved", "Can't reach the server — saved on this device").

## Forms & validation

- Standard: no form library — small controlled forms with `Input`/`Textarea`/`Select`; visible labels (or `sr-only` for inline composers); validate on blur + submit; errors under the field; submit `Button` disabled + pending while saving; never wipe input on error. Everything else auto-saves (debounced, flushed on blur/Esc/close) — no Save buttons for content.
- Ask: new required fields, new setup steps.

## Loading

- Standard: the app is cache-first — **no spinner over a page or notebook**. First load only: `Skeleton` lines that mirror the layout. Spinners (`LoaderCircle animate-spin`) only inside a pending button. Don't flash loading UI for very short waits (threshold: `.design/DESIGN.md` → Motion).

## Errors

- Standard: the top-nav sync pill (`src/components/workspace/top-navbar.tsx`) is the only global status — no toasts for autosave. In-place problems use `InlineAlert` (`tone="warn"`), safe-first copy then the fix: "Couldn't load this note. Your text is safe." + "Try again". Never raw error codes.
- Ask: copy for auth/security errors.

## Empty states

- Standard: `EmptyState` — icon, short kind title, one line, at most one action. Teach by doing (the model is `ContentEmptyState` in `src/components/content-planner/content-empty-state.tsx`). Distinguish "nothing yet" from "filtered to nothing" (offer to clear the filter).

## Destructive actions

- Standard, small & recoverable (a todo, a content card): act instantly, then offer Undo:
  ```tsx
  import { showUndoToast } from "@/components/ui/toast";
  dispatch({ type: "delete-todo", date, todoId });
  showUndoToast({ title: "Task deleted", onUndo: () => dispatch({ type: "restore-todo", workspaceId, date, todo: snapshot, index }) });
  ```
  Always use `showUndoToast` (8s timeout, closes after Undo) — don't hand-roll `toast.add` for deletes. Snapshot the item, its index and its workspace/date before deleting so Undo restores it exactly (see `deleteTodoWithUndo` in `todos-view.tsx`). Side effects the delete caused (e.g. a stopped focus timer) are not restored — mention it if relevant.
- Standard, big (workspace, folder, note, column, content series — its cards stay): `ConfirmDialog` — title `Delete "{name}"?`, one consequence sentence, `Cancel` + `Delete {noun}`. Say "Delete", not "Remove". Never `window.confirm`.
- Allowed exception: Review inbox "tap again to delete" (fast triage).
- Ask: whether the todo status-change confirmation stays; any delete that can't be undone and isn't in the list above.

## Navigation

- Standard: top nav pills (Today / Memory / Content Planner) + change-request lightbulb + sync pill + theme. Todos and Notes still open by URL (sidebar only there); the Daily Planner's editor opens from Today ("Edit day plan" dialog, `/planner` redirects there). View states inside a page use `SegmentedControl`, not nav pills.
- Ask: adding/removing/moving nav items or the sidebar (major change — see Ask before major changes below).

## Responsive

- Standard: mobile-first; check 375px and ≥1280px. Below 900px Todos becomes a `Todos` / `Daily note` switcher. Coarse pointer (`MEDIA_QUERIES.touchFirst`) never depends on drag or hover: explicit move dialogs, row actions always visible, ≥44px targets, vertical scroll wins over drag. No horizontal page scroll.

## Keyboard & accessibility

- Standard: Enter adds a todo (keeps focus); ⌘/Ctrl+Enter adds a card; Esc closes/cancels; ⌘ +/−/0 changes font scale; dnd-kit keyboard sensors stay on. Focus moves into dialogs and returns. Visible `focus-visible` ring (built into primitives). Icon buttons via `IconButton`. Priorities = sticker hue + symbol + word, never color alone. AA contrast; text ≥ 13px.

## Microcopy & voice

- Standard: friendly, encouraging, light — never childish or judgy. Sentence case. Buttons say the action ("Start this one", "Delete folder"). Carried tasks: "From yesterday" / "N days waiting" (never "overdue"). Free planner time: "Free — your call". Empty: "A fresh page. What's one thing for today?" Full voice guide: `.design/DESIGN.md` → Voice.
- Ask: confetti frequency; extending soft caps (e.g. Must do ≤ 3) beyond Shoot next.

## Legacy vs target

- `.design/DESIGN.md` is the target. Screens that don't follow it are legacy — never use them as a reference.
- New UI follows the target fully.
- When you change an existing area, bring the part you touch up to the target. Don't expand into untouched areas.
  - "The part you touch" = elements whose markup or styling you change. A behavior-only change (e.g. a new `onClick`) doesn't require restyling the element or its siblings; if you do restyle one control in a row of legacy controls, restyle the whole row so it stays consistent.
- Leave untouched legacy areas alone.
- If asked to **redesign**, apply the target fully; don't preserve the legacy look.

## Ask before major changes

Before any of these, stop and explain in 2–4 lines (current approach → proposed approach under the design system → why), then wait for approval:
layout restructure · navigation change · information-hierarchy change · workflow change · substantial visual-direction change.

Don't ask for routine compliance: correct components/tokens/spacing, accessibility, responsive fixes, missing loading/empty/error states, small consistency fixes.

## Needs product judgment (ask)

Keeping or dropping the todo status-change confirmation · extending soft caps (e.g. Must do ≤ 3) beyond Shoot next · confetti frequency · any delete that can't be undone and isn't a workspace/folder/note/column · changes to carryover or Content Conveyor behavior.

## Done means

Uses tokens and existing components · all states handled (loading, empty, error, success, disabled) · keyboard + screen-reader friendly · checked at mobile and desktop width, light and dark.
How to check: `http://localhost:5005/<route>?devWorkspace=1` (local workspace, no login; if a dev server already runs on 5005, use it — plain `pnpm dev` uses production data, so stick to `?devWorkspace=1` or `pnpm dev:test`). Test at 375px and ≥1280px; for light mode remove the `dark` class on `<html>` (or switch theme in the profile menu). Report which of these you checked. Then run the `ui-qa` sub-agent on the changed screen.

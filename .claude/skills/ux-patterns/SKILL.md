---
name: ux-patterns
description: Use when building forms, validation, loading states, errors, empty states, destructive actions (delete, remove, cancel), navigation, responsive layouts, keyboard behavior, or accessibility in DailyTodo. The project's standard UX patterns with the components that implement them, plus which decisions still need the user's approval.
---
<!-- ui-ux-pro:skill v1 -->

# DailyTodo UX patterns

**Standard** = decided; just do it. **Ask** = needs product judgment; propose and wait. Context: a single user with ADHD — fewer decisions, one clear next step, no guilt.

## Forms & validation

- Standard: no form library — small controlled forms with `Input`/`Textarea`/`Select`; visible labels (or `sr-only` for inline composers); validate on blur + submit; errors under the field; submit `Button` disabled + pending while saving; never wipe input on error. Everything else auto-saves (debounced, flushed on blur/Esc/close) — no Save buttons for content.
- Ask: new required fields, new setup steps.

## Loading

- Standard: the app is cache-first — **no spinner over a page or notebook**. First load only: `Skeleton` lines that mirror the layout. Spinners (`LoaderCircle animate-spin`) only inside a pending button. Don't show loading UI for < ~200ms.

## Errors

- Standard: the top-nav sync pill (`src/components/workspace/top-navbar.tsx`) is the only global status — no toasts for autosave. In-place problems use `InlineAlert` (`tone="warn"`), safe-first copy then the fix: "Couldn't load this note. Your text is safe." + "Try again". Never raw error codes.
- Ask: copy for auth/security errors.

## Empty states

- Standard: `EmptyState` — icon, short kind title, one line, at most one action. Teach by doing (the Content Conveyor empty state is the model). Distinguish "nothing yet" from "filtered to nothing" (offer to clear the filter).

## Destructive actions

- Standard, small & recoverable (a todo, a content card): act instantly, then offer Undo:
  ```tsx
  import { showUndoToast } from "@/components/ui/toast";
  dispatch({ type: "delete-todo", date, todoId });
  showUndoToast({ title: "Task deleted", onUndo: () => dispatch({ type: "restore-todo", workspaceId, date, todo: snapshot, index }) });
  ```
  Always use `showUndoToast` (8s timeout, closes after Undo) — don't hand-roll `toast.add` for deletes. Snapshot the item, its index and its workspace/date before deleting so Undo restores it exactly (see `deleteTodoWithUndo` in `todos-view.tsx`). Side effects the delete caused (e.g. a stopped focus timer) are not restored — mention it if relevant.
- Standard, big (workspace, folder, note, column): `ConfirmDialog` — title `Delete "{name}"?`, one consequence sentence, `Cancel` + `Delete {noun}`. Say "Delete", not "Remove". Never `window.confirm`.
- Allowed exception: Review inbox "tap again to delete" (fast triage).
- Ask: whether the todo status-change confirmation stays; any delete that can't be undone and isn't in the list above.

## Navigation

- Standard: top nav pills (Todos / Notes / Daily Planner / Content Planner) + sync pill + theme; sidebar only on Todos and Notes; Planner and Content Planner are full-width. View states inside a page use `SegmentedControl`, not nav pills.
- Ask: adding/removing/moving nav items or the sidebar (major change — see AGENTS.md).

## Responsive

- Standard: mobile-first; check 375px and ≥1280px. Below 900px Todos becomes a `Todos` / `Daily note` switcher. Coarse pointer (`MEDIA_QUERIES.touchFirst`) never depends on drag or hover: explicit move dialogs, row actions always visible, ≥44px targets, vertical scroll wins over drag. No horizontal page scroll.

## Keyboard & accessibility

- Standard: Enter adds a todo (keeps focus); ⌘/Ctrl+Enter adds a card; Esc closes/cancels; ⌘ +/−/0 changes font scale; dnd-kit keyboard sensors stay on. Focus moves into dialogs and returns. Visible `focus-visible` ring (built into primitives). Icon buttons via `IconButton`. Priorities = sticker hue + symbol + word, never color alone. AA contrast; text ≥ 13px.

## Microcopy & voice

- Standard: friendly, encouraging, light — never childish or judgy. Sentence case. Buttons say the action ("Start this one", "Delete folder"). Carried tasks: "From yesterday" / "N days waiting" (never "overdue"). Free planner time: "Free — your call". Empty: "A fresh page. What's one thing for today?" Full voice guide: `.design/DESIGN.md` → Voice.
- Ask: confetti frequency; extending soft caps (e.g. Must do ≤ 3) beyond Shoot next.

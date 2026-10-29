---
name: ui-components
description: Use before building or changing any screen, page, section, form, dialog, list, or table in DailyTodo. Inventory of the project's existing UI components and composed blocks — what exists, where it lives, how to import it, and when to use it — so proven pieces are reused before anything new is made.
---
<!-- ui-brain:skill v1 -->

# DailyTodo components and blocks

**Check here first.** Reuse before you build. Order: component → block → compose from primitives → new custom element (`ui-custom-elements` skill).

## Primitives (`src/components/ui`)

Library: shadcn/ui style `base-nova` on **Base UI** (not Radix). Add more with `npx shadcn@latest add <name>` (lands in `src/components/ui/`); run `npx shadcn@latest diff <name>` first when a file exists (several are customized). New registry files import `cn` from `"cn"` — change it to `@/lib/utils` and don't add the `cn` package.

**Base UI composition:** pass an element to `render` (`<TooltipTrigger render={<Button … />}>`). `asChild` works **only** on `PopoverTrigger` and `TooltipTrigger` (local shim) — nowhere else.

| Component | Import | Use when | Notes / variants |
|---|---|---|---|
| Button | `@/components/ui/button` | any action | pill; `default` (one per view), `soft`, `secondary`, `outline`, `ghost`, `destructive`, `link`; sizes `xs` `sm` `default` `lg` `icon-*` |
| IconButton | `@/components/ui/icon-button` | any icon-only action | required `label` = aria-label + tooltip; default `ghost` `icon-sm`. Never hand-build Tooltip + button |
| Badge | `@/components/ui/badge` | meta chips, counts, priority stickers | `chip`, `sticker-1`, `sticker-2`, `sticker-3`, `outline`, `secondary` |
| Input · Textarea | `@/components/ui/input` · `…/textarea` | text entry | always with a visible or `sr-only` label |
| Checkbox | `@/components/ui/checkbox` | boolean settings | not adopted yet; task checks are custom (legacy) — adopt when touched |
| Select | `@/components/ui/select` | choose one of many | not adopted yet |
| Dialog | `@/components/ui/dialog` | focused sub-task (move card, edit) | |
| AlertDialog | `@/components/ui/alert-dialog` | only via `ConfirmDialog` block | |
| DropdownMenu | `@/components/ui/dropdown-menu` | three-dot / overflow menus | `DropdownMenuItem variant="destructive"` last, after `DropdownMenuSeparator` |
| Popover · Tooltip | `@/components/ui/popover` · `…/tooltip` | anchored panels · hints | `TooltipProvider` is mounted in `Providers` |
| Toast | `@/components/ui/toast` → `showUndoToast({ title, onUndo })` | Undo after a quick delete (`toast.add` for other one-off notices) | `Toaster` is mounted in `Providers`; see `ux-patterns` |
| Skeleton · Separator · ScrollArea | `@/components/ui/skeleton` · `separator` · `scroll-area` | first-load placeholders · dividers · scroll regions | Skeleton not adopted yet |

## Blocks (`src/components/blocks`)

Blocks are the **target** even where legacy screens don't use them yet — adopt them when you touch that part ("not adopted yet" = no screen uses it so far).

| Block | Import | Use when | Used in |
|---|---|---|---|
| `ConfirmDialog` | `@/components/blocks/confirm-dialog` | any confirm: big deletes (`variant="destructive"`, default) or a non-delete confirm (`variant="default"`). Never raw `AlertDialog` | series detail, notes, todos, planner, sidebar, desktop update |
| `EmptyState` | `@/components/blocks/empty-state` | no items yet (`size="page"` or `"inline"`) | content planner (`ContentEmptyState`) |
| `InlineComposer` | `@/components/blocks/inline-composer` | inline add: `line` (Enter, keeps focus) · `block` (⌘/Ctrl+Enter, Esc) | series detail |
| `SegmentedControl` | `@/components/blocks/segmented-control` | 2–4 view states (Now/Set up, Todos/Daily note) | not adopted yet |
| `PageHeader` | `@/components/blocks/page-header` | title + subtitle + meta chip + actions at the top of a page/pane | content planner |
| `InlineAlert` | `@/components/blocks/inline-alert` | in-place error/notice (`tone="warn"|"info"`) | not adopted yet |
| `useMediaQuery` + `MEDIA_QUERIES` | `@/hooks/use-media-query` | JS needs a breakpoint or pointer type (`touchFirst`, `desktop`, `compact`) | content planner |

### Example (target pattern — Todos doesn't use these yet)

```tsx
<PageHeader
  title="Todos"
  subtitle="Plan the day from here."
  meta={<Badge variant="chip">{workspace.name}</Badge>}
  actions={<IconButton label="Focus mode" icon={<Target />} />}
/>
<section className={cn("flex flex-col gap-2 rounded-2xl p-3", PRIORITY_GROUP_SURFACE[1])}>
  <PriorityTab priority={1} label="Must do" count={todos.length} />
  {todos.length === 0 ? <EmptyState size="inline" title="Nothing here yet." /> : rows}
  <InlineComposer placeholder="Add a must-do…" onSubmit={addTodo} />
</section>
```

## Content Planner pieces (`src/components/content-planner`)

Feature components — reuse inside the Content Planner; copy their pattern elsewhere rather than importing them.

| Component | File | What it is |
|---|---|---|
| `ContentEmptyState` | `content-empty-state.tsx` | model empty state: teaches the flow with the stage track + one sample card |
| `CaptureBox` | `capture-box.tsx` | zero-decision capture: Enter saves to Ideas, focus stays |
| `WeekStrip` | `week-strip.tsx` | "This week": kind ship meter + the one card to work on next |
| `SeriesStrip` | `series-strip.tsx` | quiet row of series chips under "This week" |
| `ContentShelf` (+ `RowMenu`, `CardMoveItems`) | `content-shelf.tsx` | every card as a readable row grouped by stage; device-local collapse |
| `IdeasReview` | `ideas-review.tsx` | one idea at a time: Develop · Keep for later · Delete (Undo) |
| `CardSeriesPicker` | `card-series-picker.tsx` | card's series chip: pick, move or leave a series |
| `SeriesDetail` | `series-detail.tsx` | one series: about, progress, videos grouped by stage |
| `SeriesNameDialog` | `series-name-dialog.tsx` | name a new series — one field, Enter creates |
| `PublishInfo` | `publish-info.tsx` | published links per platform + transcript; auto-saves |
| `ShootCardView` | `shoot-card-view.tsx` | a script part as calm reading text |

## Today pieces (`src/components/today`)

| Component | File | What it is |
|---|---|---|
| `TaskRow` | `task-row.tsx` | external-brain task: round check (44px touch target), plain title, meta line (area chip, washi tag, "From Claude"), one right-side action |
| `LifeAreaChip` | `task-row.tsx` | life area as a neutral `chip` Badge + icon (Job/Content/Personal) — never a priority color |
| `useFocusSoon` | `use-focus-soon.ts` | after an action removes the focused control, focus a section heading (pass `headingRef` to `SectionTitle`) |
| `SectionTitle` · `DoTodayMenu` | `section-title.tsx` · `do-today-menu.tsx` | page section heading + hint (focusable with a ref, optional `action` at the row end) · "Do today" block picker |
| `PlannerSetupDialog` | `src/components/planner/planner-view.tsx` | the day-plan editor (planner Set up) in a dialog over Today |
| `DecisionCard` · `WaitingList` | `src/components/memory/memory-parts.tsx` | a decision (status chip, why, replaced strike-through, Mark agreed) · follow-ups by person with washi "N days waiting" and Mark resolved |
| `useHistoryActions` | `use-history-actions.ts` | `act(action, title)` runs an edit with an Undo toast; `undo` / `redo` show results and refusals as toasts ("Bring back") |

## Layouts

| Layout | File | Used by |
|---|---|---|
| App shell (top nav + optional sidebar + main) | `src/components/workspace/workspace.tsx` | all routes; sidebar only on Todos/Notes (Today, History, Planner, Content Planner are full-width) |
| Top nav (pills, sync pill, theme, A-/A+) | `src/components/workspace/top-navbar.tsx` | all routes (legacy styling) |
| Sidebar (dates, notes tree, profile menu) | `src/components/workspace/sidebar.tsx` | Todos, Notes (legacy styling) |

## Adding to this inventory

When you create a reusable component or block, add a row here in the same change. Keep one row per item; delete rows for removed items.

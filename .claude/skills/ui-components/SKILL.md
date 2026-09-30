---
name: ui-components
description: Use before building or changing any screen, page, section, form, dialog, list, or table in DailyTodo. Inventory of the project's existing UI components and composed blocks — what exists, where it lives, how to import it, and when to use it — so proven pieces are reused before anything new is made.
---
<!-- ui-ux-pro:skill v1 -->

# DailyTodo components and blocks

**Check here first.** Reuse before you build. Order: component → block → compose from primitives → new custom element (`ui-custom-elements` skill).

## Primitives (`src/components/ui`)

Library: shadcn/ui style `base-nova` on **Base UI** (not Radix). Add more with `pnpm exec shadcn add <name>`; run `pnpm exec shadcn diff <name>` first when a file exists (several are customized). New registry files import `cn` from `"cn"` — change it to `@/lib/utils` and don't add the `cn` package.

**Base UI composition:** pass an element to `render` (`<TooltipTrigger render={<Button … />}>`). `asChild` works **only** on `PopoverTrigger` and `TooltipTrigger` (local shim) — nowhere else.

| Component | Import | Use when | Notes / variants |
|---|---|---|---|
| Button | `@/components/ui/button` | any action | pill; `default` (one per view), `soft`, `secondary`, `outline`, `ghost`, `destructive`, `link`; sizes `xs` `sm` `default` `lg` `icon-*` |
| IconButton | `@/components/ui/icon-button` | any icon-only action | required `label` = aria-label + tooltip; default `ghost` `icon-sm`. Never hand-build Tooltip + button |
| Badge | `@/components/ui/badge` | meta chips, counts, priority stickers | `chip`, `sticker-1`, `sticker-2`, `sticker-3`, `outline`, `secondary` |
| Input · Textarea | `@/components/ui/input` · `…/textarea` | text entry | always with a visible or `sr-only` label |
| Checkbox | `@/components/ui/checkbox` | boolean settings | task checks are custom (legacy) — adopt when touched |
| Select | `@/components/ui/select` | choose one of many | |
| Dialog | `@/components/ui/dialog` | focused sub-task (move card, edit) | |
| AlertDialog | `@/components/ui/alert-dialog` | only via `ConfirmDialog` block | |
| DropdownMenu | `@/components/ui/dropdown-menu` | three-dot / overflow menus | `DropdownMenuItem variant="destructive"` last, after `DropdownMenuSeparator` |
| Popover · Tooltip | `@/components/ui/popover` · `…/tooltip` | anchored panels · hints | `TooltipProvider` is mounted in `Providers` |
| Toast | `@/components/ui/toast` → `showUndoToast({ title, onUndo })` | Undo after a quick delete (`toast.add` for other one-off notices) | `Toaster` is mounted in `Providers`; see `ux-patterns` |
| Skeleton · Separator · ScrollArea | `@/components/ui/skeleton` · `separator` · `scroll-area` | first-load placeholders · dividers · scroll regions | |

## Blocks (`src/components/blocks`)

| Block | Import | Use when | Example screen |
|---|---|---|---|
| `ConfirmDialog` | `@/components/blocks/confirm-dialog` | big deletes (workspace, folder, note, column) | todos workspace menu, notes |
| `EmptyState` | `@/components/blocks/empty-state` | no items yet (`size="page"` or `"inline"`) | notes, todo groups |
| `InlineComposer` | `@/components/blocks/inline-composer` | inline add: `line` (Enter, keeps focus) · `block` (⌘/Ctrl+Enter, Esc) | todo groups, content cards |
| `SegmentedControl` | `@/components/blocks/segmented-control` | 2–4 view states (Now/Set up, Board/Gallery, Todos/Daily note) | planner, content planner |
| `PageHeader` | `@/components/blocks/page-header` | title + subtitle + meta chip + actions at the top of a page/pane | todos pane, planner |
| `InlineAlert` | `@/components/blocks/inline-alert` | in-place error/notice (`tone="warn"|"info"`) | auth, note load errors |
| `useMediaQuery` + `MEDIA_QUERIES` | `@/hooks/use-media-query` | JS needs a breakpoint or pointer type (`touchFirst`, `desktop`, `compact`) | content planner |

### Example

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

## Layouts

| Layout | File | Used by |
|---|---|---|
| App shell (top nav + optional sidebar + main) | `src/components/workspace/workspace.tsx` | all routes; sidebar only on Todos/Notes (`isPlanner` / content planner are full-width) |
| Top nav (pills, sync pill, theme, A-/A+) | `src/components/workspace/top-navbar.tsx` | all routes (legacy styling) |
| Sidebar (dates, notes tree, profile menu) | `src/components/workspace/sidebar.tsx` | Todos, Notes (legacy styling) |

## Adding to this inventory

When you create a reusable component or block, add a row here in the same change. Keep one row per item; delete rows for removed items.

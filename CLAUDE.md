# DailyTodoApp — Claude Brain File

> This file is the single source of truth for AI-assisted development on DailyTodoApp.
> Read this before making any UI, architectural, or design decisions.

---

## Project Overview

**DailyTodoApp** is a personal productivity web app combining a daily journal (note-taking with markdown + drawing) and a structured todo list, organized by day. It lives at `localhost:5005` during development.

The core metaphor is a **physical desk notebook** — warm, calm, analog in feel, but with the efficiency of a digital tool. Think Bear Notes meets a bullet journal.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Component Lib | shadcn/ui (Radix primitives), @base-ui/react |
| Markdown Editor | @toast-ui/react-editor (WYSIWYG mode) |
| Drawing | Native Canvas API (custom DrawingOverlay component) |
| State | React useReducer + Context (AppProvider) |
| Persistence | localStorage (via `src/lib/persistence.ts`, key: `dailytodo.v1`) |
| Icons | lucide-react |
| Animation | tw-animate-css |
| Testing | Vitest + @testing-library/react |
| Package Manager | pnpm |

---

## Architecture

```
src/
├── app/
│   ├── layout.tsx          # Root layout with AppProvider + font setup
│   ├── page.tsx            # Root redirect → /daily
│   ├── daily/page.tsx      # Daily view page
│   └── notes/page.tsx      # Notes view page
├── components/
│   ├── app-context.tsx     # AppState, AppAction, appReducer, AppProvider
│   ├── sidebar.tsx         # Left sidebar: nav + date tree + notes list
│   ├── workspace.tsx       # Shell: sidebar + main panel
│   ├── daily-view.tsx      # Two-column layout: note pane + todo pane
│   ├── notes-view.tsx      # Full-width note with title + editor
│   ├── markdown-editor.tsx # Toast UI editor wrapper (WYSIWYG, no SSR)
│   └── drawing-overlay.tsx # Canvas-based drawing layer (pen/eraser)
└── lib/
    ├── types.ts            # All TypeScript types (Todo, DailyPage, NoteDoc, etc.)
    ├── store.ts            # Pure state factories + selectors (groupTodosByPriority, etc.)
    ├── persistence.ts      # localStorage load/save
    ├── date.ts             # Date formatting helpers
    └── schema.ts           # Zod validation for persisted state
```

### State Shape

```ts
AppState {
  dailyPages: Record<dateISO, DailyPage>   // e.g. "2026-03-11"
  notesDocs:  Record<id, NoteDoc>
  uiState:    UIState                       // selected items, expanded tree nodes, lastView
}

DailyPage { date, markdown, drawingStrokes[], todos[] }
NoteDoc   { id, title, markdown, drawingStrokes[], updatedAt }
Todo      { id, text, priority(1|2|3), done, createdAt }
```

### Key Behaviors

- **Carryover**: When a new day is created (`ensureDailyPageForDate`), all incomplete todos AND the markdown from the previous day are copied forward automatically.
- **Persistence**: Every state change saves to `localStorage` via a `useEffect` in `AppProvider`.
- **Drawing**: Canvas overlay sits `position: absolute; inset: 0; z-index: 4` over the editor. `pointer-events: none` when disabled, `pointer-events: auto` when enabled.
- **Markdown editor**: Loaded dynamically (no SSR) via `next/dynamic`. External value sync handled with `useEffect` + `setMarkdown`.

---

## Design System: Warm Editorial

> **Design style name: Warm Editorial**
> Component library: shadcn/ui
> See full implementation guide: `.agents/skills/warm-editorial-ui/SKILL.md`

### Core Philosophy

The five pillars of Warm Editorial:

1. **Surface Warmth** — Backgrounds use warm off-whites (`#faf8f4`), never pure white or cool gray. Cards live in the `#ffffff` range but with warm-tinted borders and shadows.
2. **Ink Typography** — Use a **clean sans-serif** system across headings, dates, and UI chrome for consistency and readability.
3. **Tonal Color** — One deep accent (`#2f6d62` teal) against a mostly neutral palette. Priority colors are desaturated — dusty red, amber, sage — not bright traffic-light primaries.
4. **Generous Breathing Room** — Whitespace is structural, not wasted. Cards and sections breathe.
5. **Soft Structure** — Warm-tinted borders, subtle warm-tinted shadows, medium rounding (12–16px cards, 8–10px inputs).

### Design Tokens

```css
/* Custom (app-specific) */
--ink-900: #1f2430;        /* primary text */
--ink-700: #40495e;        /* secondary text, muted */
--paper: #faf8f4;          /* page background */
--paper-strong: #ffffff;   /* card/pane surface */
--line: #d9d1c5;           /* borders */
--brand: #2f6d62;          /* primary accent */
--brand-soft: #d9ece8;     /* accent bg tint */
--warn: #b8422e;           /* destructive / delete */

/* Priority colors (to be implemented) */
--priority-1: #c0392b;     /* dusty red — Critical */
--priority-1-soft: #f9e8e6;
--priority-2: #c07c30;     /* amber — Important */
--priority-2-soft: #fdf3e3;
--priority-3: #4a7c59;     /* sage — Someday */
--priority-3-soft: #e8f4ec;

/* shadcn tokens (already mapped in globals.css) */
/* --background, --foreground, --primary, --border, etc. */
```

### Typography

```
Display / Dates / Headings:  font-body (sans-serif, e.g. Source Sans 3, Inter, DM Sans)
Body / UI chrome:            font-body (sans-serif, e.g. Source Sans 3, Inter, DM Sans)
Monospace:                   font-mono (for code blocks)
```

### Spacing Scale

Use Tailwind's default scale. Preferred spacings:
- Section padding: `p-4` (1rem)
- Card internal padding: `p-3` to `p-4`
- Between list items: `gap-2` (0.5rem)
- Between sections: `gap-4` (1rem)

### Border Radius

- Cards / panes: `rounded-2xl` (16px)
- Inputs / buttons: `rounded-lg` (10px)
- Badges / pills: `rounded-full`

### Shadows

Warm-tinted shadow (not the cool Tailwind default):
```css
box-shadow: 0 1px 3px rgba(31, 36, 48, 0.06), 0 1px 2px rgba(31, 36, 48, 0.04);
```

---

## UX/UI Improvement Plan

Ordered by priority. Check off as completed.

### 🔴 High Priority — Broken or Confusing

- [ ] **#1 Fix todo form overflow** — The Add button is clipped at the right edge of the todo pane. Refactor the `todo-header`: move the form below the "Todo List" title, or use a stacked layout inside the pane header.
- [ ] **#2 Empty state for priority groups** — Show a placeholder in each empty group: *"No tasks yet"* in muted ink. Currently bare labeled boxes with no guidance.
- [ ] **#3 Remove redundant Add button** — Enter-to-add already works. Replace the button with a subtle keyboard hint (`↵`) or remove it. The cramped trio of input + select + button in the header is the biggest layout source of clutter.
- [ ] **#4 Relocate Draw mode toggle** — The Draw button lives inside the markdown toolbar, making it look like a formatting option. Move it to a standalone floating icon button (pencil icon, top-right corner of the note pane), outside the toolbar DOM entirely.

### 🟡 Medium Priority — Friction Points

- [ ] **#5 "Today" quick-nav button** — Add a "Today" button in the sidebar header (below the nav tabs) to snap back to today's page from any past date.
- [ ] **#6 Meaningful priority labels** — Replace generic "Priority 1/2/3" with labeled+colored headers: e.g. a colored left-border accent (dusty red / amber / sage) and a readable label like "Critical", "Important", "Someday". Use `--priority-1`, `--priority-2`, `--priority-3` tokens.
- [ ] **#7 Task count badge on priority group headers** — Show `(n)` count pill next to each group title when tasks exist. Disappears when group is empty.
- [ ] **#8 Clearer sidebar nav active state** — Current teal tint is too subtle. Use a filled tab style for the active view (DailyTodo / Notes) with stronger contrast.
- [ ] **#9 Markdown toolbar tooltips** — Add `title` attributes (or shadcn `Tooltip`) to toolbar icon buttons. Icons like `CB`, `66`, `</>` are cryptic without labels.
- [ ] **#10 Notes view full-height stretch** — The note card should stretch to `min-h-[calc(100vh-2rem)]` so it fills the viewport. Currently it stops short with a large empty background area below.
- [ ] **#11 Note delete confirmation** — The Delete button in the Notes header destroys a note immediately. Wrap it in an `AlertDialog` (shadcn) to confirm before deleting.

### 🟢 Small Wins & Polish

- [ ] **#12 Consistent sidebar hover states** — All day/month/year buttons should have `hover:bg-brand-soft/40` background on hover. Currently no hover feedback before click.
- [ ] **#13 Sidebar orphan bullet** — The active day item renders a `·` bullet that appears as a stray dot to the left of the tree. Remove or replace with a consistent selection indicator.
- [ ] **#14 Completed todos collapse to "Done" section** — Auto-separate done todos into a collapsed sub-section at the bottom of each priority group instead of rendering inline with strikethrough.
- [ ] **#15 Drag-to-reorder within priority groups** — Add a drag handle (`⠿` or `GripVertical` from lucide) to todo items for manual reordering within a group.
- [ ] **#16 Note title as heading** — The note title `<input>` in the Notes view has no visual hierarchy. Style it as a large, sans-serif, borderless heading input (similar to Notion's page title).
- [ ] **#17 Todo inline priority change** — Allow clicking a priority badge on a todo item to cycle its priority without deleting and re-adding it.
- [ ] **#18 Keyboard shortcut hints** — Show `↵ to add` hint text inside or below the task input so users discover the keyboard workflow.

---

## Known Technical Notes

- **Toast UI editor** is loaded with `dynamic(..., { ssr: false })` — any component wrapping it also needs to be aware of client-only rendering.
- **Drawing canvas** does not resize on window resize — the canvas dimensions are set once on mount from `parentElement.clientWidth/Height`. A `ResizeObserver` would fix this.
- **State is localStorage-only** — no backend, no sync. All data lives in `dailytodo.v1` key.
- **shadcn/ui** is installed but components haven't been generated yet. Run `npx shadcn@latest add <component>` to scaffold individual components into `src/components/ui/`.
- **globals.css** now imports `tailwindcss`, `tw-animate-css`, and `shadcn/tailwind.css`. The shadcn CSS variable tokens are present and ready to be overridden with Warm Editorial values.

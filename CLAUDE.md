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
| Markdown Editor | Tiptap (ProseMirror-based, Notion-like) |
| Drawing | Native Canvas API (custom DrawingOverlay component) |
| State | React useReducer + Context (AppProvider) |
| Persistence | PocketBase sync + local cache (`src/lib/persistence.ts`, PocketBase collections + browser cache) |
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
│   ├── top-navbar.tsx      # Top bar: app name + nav pills + theme toggle
│   ├── sidebar.tsx         # Left sidebar: date tree (daily) / notes list (notes)
│   ├── workspace.tsx       # Shell: top-nav + sidebar + main panel
│   ├── daily-view.tsx      # Two-column: note pane + todo pane (inline task inputs)
│   ├── notes-view.tsx      # Full-width note with title + editor
│   ├── markdown-editor.tsx # Tiptap editor wrapper (no toolbar, content-first)
│   └── drawing-overlay.tsx # Canvas-based drawing layer (pen/eraser)
└── lib/
    ├── types.ts            # All TypeScript types (Todo, DailyPage, NoteDoc, etc.)
    ├── store.ts            # Pure state factories + selectors (groupTodosByPriority, etc.)
    ├── persistence.ts      # persistence types, normalization, metadata helpers
    ├── local-cache-storage.ts # browser cache envelope for assembled AppState
    ├── pocketbase/        # PocketBase auth + persistence repositories
    ├── date.ts             # Date formatting helpers
    └── schema.ts           # Zod validation for persisted state
```

### State Shape

```ts
AppState {
  dailyPages: Record<dateISO, DailyPage>   // e.g. "2026-03-11"
  notesDocs:  Record<id, NoteDoc>
  plannerPresets: Record<id, PlannerPreset>
  uiState:    UIState                       // synced selection state + device-local preferences
}

DailyPage { date, markdown, todos[] }
NoteDoc   { id, title, markdown, updatedAt }
PlannerPreset { id, name, dayOrder[], days, updatedAt }
Todo      { id, text, priority(1|2|3), done, createdAt }
```

### Key Behaviors

- **Carryover**: When a new day is created (`ensureDailyPageForDate`), all incomplete todos AND the markdown from the previous day are copied forward automatically.
- **Persistence**: `AppProvider` hydrates an assembled `AppState`, keeps a browser cache for fast startup/offline support, and syncs through PocketBase when authenticated.
- **Drawing**: Canvas overlay sits `position: absolute; inset: 0; z-index: 4` over the editor. `pointer-events: none` when disabled, `pointer-events: auto` when enabled.
- **Markdown editor**: Tiptap (ProseMirror-based). Uses `tiptap-markdown` extension for markdown serialization. No toolbar — content-first like Notion.
- **Add task**: Inline inputs at the bottom of each priority group (Apple Reminders style). No separate form.
- **Navigation**: Top navbar with Daily/Notes pills. Theme toggle (Sun/Moon/Monitor cycle) in top-right.
- **Sync model**: PocketBase stores top-level entities in separate collections (`daily_pages`, `notes`, `planner_presets`, `workspace_state`) while nested child structures remain embedded JSON inside those parent records. Legacy `app_state_snapshots` is retained temporarily for migration/rollback safety.

---

## Design System: Warm Minimalism

> **Design style name: Warm Minimalism**
> **Component library:** shadcn/ui

### Why Warm Minimalism

The app was visually analyzed against 20 common UI design styles. The running app demonstrates clear Minimalist UI principles (purposeful whitespace, nothing decorative, clean surfaces), Flat Design component treatment (no heavy shadows, no gradient fills on components), and Swiss/Grid structural discipline (two-column grid, consistent spacing rhythm). What makes it distinctly "warm" is the cream palette instead of cold grays, the earthy teal accent instead of electric blue, and the desaturated priority colors instead of bright primaries. **No serifs** — the typography is a single clean sans-serif stack throughout, with hierarchy built through weight and size alone.

### Core Philosophy: The Five Pillars

1. **Surface Warmth** — Backgrounds use warm off-whites (`#faf8f4`), never pure white or cool gray. Dark mode uses deep blue-gray warm (`#16191f`), never true black.
2. **Sans-serif System** — One font family (`font-body`, sans-serif: Source Sans 3 / Inter / DM Sans) used across ALL roles. Hierarchy via weight and size only.
3. **Tonal Color** — One deep accent (`#2f6d62` teal) against a mostly neutral palette. Priority colors are desaturated — dusty red, amber, sage — not bright traffic-light primaries.
4. **Generous Breathing Room** — Whitespace is structural, not wasted. Cards and sections breathe. When in doubt, add space.
5. **Soft Structure** — Warm-tinted borders (`--line`), warm-tinted shadows (rgba amber-tinted, never cool gray), `rounded-2xl` cards, `rounded-[10px]` inputs/buttons.

### Styling Removal Rule

When asked to remove a visual treatment (border, shadow, radius, background, divider, spacing, chrome, etc.), prefer deleting or simplifying the original styling rule instead of adding a new override that turns it off. Only add an override when the original rule must stay because it is still required by another component/state and cannot be cleanly split yet. Default approach: reduce CSS, do not layer more CSS to negate old CSS.

### Design Tokens

```css
/* Light mode */
--paper:         #faf8f4   /* page background */
--paper-strong:  #ffffff   /* card/pane surface */
--line:          #d9d1c5   /* all borders */
--ink-900:       #1f2430   /* primary text */
--ink-700:       #40495e   /* secondary/muted text */
--brand:         #2f6d62   /* accent */
--brand-soft:    #d9ece8   /* accent bg tint */
--warn:          #b8422e   /* destructive */

/* Dark mode overrides */
--paper:         #16191f
--paper-strong:  #1e2228
--line:          #2d3340
--ink-900:       #e8e2d9
--ink-700:       #8c95a6
--brand:         #3d8c7f
--brand-soft:    #1e3533
--warn:          #d45a44

/* Priority system */
--priority-1:       #c0392b   /* Critical — dusty red */
--priority-1-soft:  #f9e8e6   /* (dark: #2a1715) */
--priority-2:       #c07c30   /* Important — amber */
--priority-2-soft:  #fdf3e3   /* (dark: #271f0d) */
--priority-3:       #4a7c59   /* Someday — sage */
--priority-3-soft:  #e8f4ec   /* (dark: #101f15) */
```

### Typography

```
All roles:   font-body — "Source Sans 3", Inter, DM Sans, system-ui, sans-serif
Monospace:   font-mono — JetBrains Mono, Fira Code, ui-monospace
```

No serifs anywhere. Hierarchy: `text-2xl font-semibold` (note title) → `text-lg font-semibold` (date header) → `text-sm font-semibold` (section label) → `text-sm font-normal` (body/todos).

### Spacing Scale

Use Tailwind's default scale. Preferred spacings:
- Section padding: `p-4` (16px)
- Card internal padding: `p-3` to `p-4`
- Between list items: `gap-2` (8px)
- Between sections: `gap-4` (16px)
- Between priority group cards: `gap-3` (12px)

### Border Radius
- Cards / panes: `rounded-2xl` (16px)
- Inputs / buttons: `rounded-lg` (10px)
- Badges / pills: `rounded-full`

### UX & Component Rules
- **Hover states**: Every interactive element must have a clear hover state.
- **Destructive actions**: Always require an `AlertDialog` confirmation.
- **Icon buttons**: Must have both an `aria-label` and a `Tooltip` wrapper.
- **Motion**: Duration 150ms-200ms. Never exceed 300ms. Never use bounce or spring animations.

### Accessibility
- Maintain WCAG AA contrast (4.5:1 normal, 3:1 large).
- Focus indicator: `outline: 2px solid var(--brand); outline-offset: 2px`.
- Never rely on color alone to convey meaning (e.g. priority colors must have a text label).
- Respect `prefers-reduced-motion`.

### Shadows

Warm-tinted shadow (not the cool Tailwind default):
```css
box-shadow: 0 1px 3px rgba(31, 36, 48, 0.06), 0 1px 2px rgba(31, 36, 48, 0.04);
```

---

## UX/UI Improvement Plan

Ordered by priority. Check off as completed.

### 🔴 High Priority — Broken or Confusing

- [x] **#1 Fix todo form overflow** — Replaced with inline task inputs per priority group
- [x] **#2 Empty state for priority groups** — Shows "No tasks yet" in muted italic
- [x] **#3 Remove redundant Add button** — Completely removed; inline inputs handle everything
- [x] **#4 Relocate Draw mode toggle** — Already outside the editor DOM (Tiptap has no toolbar)

### 🟡 Medium Priority — Friction Points

- [x] **#5 "Today" quick-nav button** — Added in sidebar header with calendar icon
- [x] **#6 Meaningful priority labels** — Using colored left-border accent + "Critical" / "Important" / "Someday" labels
- [x] **#7 Task count badge** — Shows count pill next to group title when tasks exist
- [x] **#8 Clearer nav active state** — Top navbar uses filled pill style with shadow
- [ ] **#9 Markdown toolbar tooltips** — N/A: Tiptap has no toolbar
- [x] **#10 Notes view full-height stretch** — Uses `min-height: calc(100vh - 52px - 3rem)`
- [x] **#11 Note delete confirmation** — AlertDialog wraps delete button

### 🟢 Small Wins & Polish

- [x] **#12 Consistent sidebar hover states** — All tree items have hover feedback
- [ ] **#13 Sidebar orphan bullet** — Removed (using chevron icons now)
- [ ] **#14 Completed todos collapse** — Future enhancement
- [ ] **#15 Drag-to-reorder** — Future enhancement (grip handle icon is present)
- [x] **#16 Note title as heading** — Large, 28px bold borderless heading
- [ ] **#17 Todo inline priority change** — Future enhancement
- [x] **#18 Keyboard shortcut hints** — Inline inputs replace explicit hints

---

## Known Technical Notes

- **Tiptap editor** uses `@tiptap/react` with `immediatelyRender: false` for Next.js SSR compatibility. Uses `tiptap-markdown` for markdown round-trip.
- **Drawing canvas** does not resize on window resize — the canvas dimensions are set once on mount from `parentElement.clientWidth/Height`. A `ResizeObserver` would fix this.
- **Persistence is hybrid** — PocketBase is the source of truth for synced content, while the browser keeps a per-user assembled cache for fast warm startup, offline fallback, and device-local UI preferences.
- **Device-local UI state** — values like theme mode, sidebar collapsed state, and focus mode remain local-only and should not be moved into synced PocketBase records unless there is a strong cross-device reason.
- **Hybrid storage strategy** — use scalar/relation fields for ownership, ids, titles, timestamps, and other queryable atoms; use JSON fields for nested parent-owned structures such as daily todos, planner day order, planner days/events, and small UI arrays.
- **shadcn/ui** components live in `src/components/ui/`. Generate new ones with `npx shadcn@latest add <component>`.
- **Tailwind v4 & CSS Cascade Layers (CRITICAL)**: Because Tailwind v4 relies entirely on native `@layer` (theme, base, components, utilities), **NEVER write unlayered CSS resets or component styles in globals.css**. Unlayered CSS rules (like `* { padding:0; }`) automatically overpower all layered utilities across the entire app, destroying component padding and spacing system.
  - **Do**: Always wrap custom global resets in `@layer base { ... }`.
  - **Do**: Put custom component CSS in `@layer components { ... }` or use exact Tailwind utilities.
  - **Don't**: Write naked CSS selectors outside of Tailwind layers in `globals.css` unless deliberately intending to override the entire Tailwind layer system.

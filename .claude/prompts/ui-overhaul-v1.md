# UI Overhaul Prompt — DailyTodoApp
> Give this entire file to your coding agent as a prompt.
> Last updated: 2026-03-11

---

## Your Role

You are a senior frontend engineer implementing a visual overhaul of DailyTodoApp — a Next.js 16 + shadcn/ui + Tailwind CSS v4 productivity app. The design system is called **Warm Minimalism**. Before writing any code, read these two files in full:

- `CLAUDE.md` — project architecture, state shape, token definitions, and the UX improvement backlog
- `.claude/skills/brand-guideline/SKILL.md` — the complete design language: colors, typography, spacing, shadows, motion
- `.claude/skills/warm-minimalism-ui/SKILL.md` — code-level patterns for every component (copy-paste ready)

Do not deviate from the design system defined in those files. Every color must use a CSS variable. Every shadow must be warm-tinted. No serif fonts. No Tailwind `shadow-*` defaults.

---

## Why This Overhaul Is Needed

The app currently looks like a functional prototype. Here is the visual diagnosis from a live screenshot review:

1. **The markdown toolbar is a wall** — it's the first thing visible inside the note pane, 15+ icons stacked before a single word can be written. It creates friction instead of invitation.
2. **Native `<select>` for priority** — a raw browser dropdown sitting next to a styled input destroys the visual coherence of the todo pane completely.
3. **Theme toggle is in prime sidebar real estate** — the Light/Dark/System toggle is the second item in the sidebar (right below the app name), making the sidebar look like a settings panel rather than a navigator.
4. **App name has zero personality** — "DailyTodoApp" is rendered in plain unstyled text.
5. **Sidebar items have no hover feedback** and no visual weight — year/month toggles, day items, and Today button all feel flat and uncommunicative.
6. **Empty priority groups look clinical** — three identically-styled boxes with "No tasks yet" in light gray feels like an error state, not an invitation.
7. **The note pane doesn't call you in** — massive empty white space, "Write / Preview" tabs in the wrong place, and the dotted grid reads as "empty form" rather than "blank page."
8. **The todo pane header layout is broken** — "Todo List" h2 + input + native select are horizontally crammed together and overflow on smaller widths.

---

## Changes to Make

Work through these in order. Each section specifies the file(s) to change and the exact outcome required.

---

### 1. Sidebar — Full Restructure

**File:** `src/components/sidebar.tsx` + `src/app/globals.css`

**Problems to fix:**
- Theme toggle is at the top — move it to the very bottom of the sidebar
- App name is plain text — give it visual weight
- Today button is an unstyled outline button — it needs a clear warm accent style
- Tree items (year, month, day) have no hover state
- The sidebar has dead empty space below the tree

**Required outcome:**

The sidebar must have this structure (top to bottom):
```
[App name — styled]
[DailyTodo | Notes tabs]
[Today button]
[Tree / Notes list — fills remaining space with ScrollArea]
[─────────────────────────]  ← spacer pushing below
[Theme toggle — bottom]
```

Specific styling rules:
- **App name**: `text-lg font-semibold tracking-tight text-[var(--ink-900)]`. Add a small square dot or calendar emoji prefix, OR just increase to `text-xl font-bold`. Make it feel like a product, not a label.
- **DailyTodo/Notes tabs**: Use the filled active tab pattern from the warm-minimalism-ui skill. Active = `bg-[var(--brand)] text-white`. Inactive = bordered with hover tint.
- **Today button**: `bg-[var(--brand-soft)] text-[var(--brand)] border border-[var(--brand)]/30 hover:bg-[var(--brand)] hover:text-white` — it should feel like a shortcut, not just another button.
- **Tree toggle buttons** (year, month): add `hover:bg-[var(--brand-soft)]/50 rounded-lg transition-colors duration-150`
- **Day items**: add `hover:bg-[var(--brand-soft)] transition-colors duration-150`. Active day: `bg-[var(--brand-soft)] text-[var(--brand)] font-medium`.
- **Theme toggle**: move to the bottom of the sidebar. Style as three small pill buttons: `text-xs px-2 py-1 rounded-md`. Active pill: `bg-[var(--brand-soft)] text-[var(--brand)]`. Inactive: plain text, no border. Label the section with a tiny `text-[10px] uppercase tracking-widest text-[var(--ink-700)] mb-1` label: "Appearance".
- Wrap the scrollable tree area in shadcn `<ScrollArea>` (`npx shadcn@latest add scroll-area`).

---

### 2. Note Pane Header — Date as Hero

**File:** `src/components/daily-view.tsx` + `src/app/globals.css`

**Problems to fix:**
- The date "Wed, 11 Mar 2026" is just `text-[1.15rem]` — it should be the dominant typographic element in the pane
- The header row has too little padding and visual weight

**Required outcome:**
- Date text: `text-xl font-semibold text-[var(--ink-900)] tracking-tight`
- Header padding: `px-5 py-4` (was `0.85rem 1rem`)
- Add a subtle left accent: a thin `3px` left border in `var(--brand)` on the header div, OR a small calendar icon (`CalendarDays` from lucide, `h-4 w-4 text-[var(--brand)]`) to the left of the date text.
- The header border-bottom should remain `border-b border-[var(--line)]`

---

### 3. Markdown Toolbar — Tuck It Away

**File:** `src/components/markdown-editor.tsx` + `src/app/globals.css`

This is the most impactful single change. The toolbar must stop being the first thing visible.

**Required outcome:**

The toolbar should be **hidden by default** and only appear when the editor is focused or when the user hovers over the note pane. Implement this with CSS only using the `:focus-within` pseudo-class on `.editor-layer`:

```css
/* In globals.css */

/* Hide the Toast UI toolbar by default */
.toastui-editor-toolbar {
  opacity: 0;
  pointer-events: none;
  transition: opacity 150ms ease-in-out;
}

/* Show when the editor or its container is focused/hovered */
.editor-layer:hover .toastui-editor-toolbar,
.editor-layer:focus-within .toastui-editor-toolbar {
  opacity: 1;
  pointer-events: auto;
}

/* Restyle the toolbar to match Warm Minimalism */
.toastui-editor-toolbar {
  background: rgba(255, 255, 255, 0.95) !important;
  border-bottom: 1px solid var(--line) !important;
  backdrop-filter: blur(4px);
  padding: 4px 8px !important;
}

/* Tighten toolbar button sizing */
.toastui-editor-toolbar-icons {
  width: 26px !important;
  height: 26px !important;
  background-size: 260px !important;
  border-radius: 6px !important;
}

.toastui-editor-toolbar-icons:hover,
.toastui-editor-toolbar-icons.active {
  background-color: var(--brand-soft) !important;
  border-color: var(--brand) !important;
}

/* Dark mode toolbar */
.dark .toastui-editor-toolbar {
  background: rgba(30, 34, 40, 0.95) !important;
  border-bottom-color: var(--line) !important;
}

/* Also hide the Write/Preview mode tabs — we're always in WYSIWYG */
.toastui-editor-mode-switch {
  display: none !important;
}
```

Additionally: add a subtle placeholder paragraph inside the note pane that shows only when the editor content is empty. The Toast UI editor has a `.toastui-editor-contents p:first-child:empty::before` pseudo-element you can target:

```css
.toastui-editor-contents p:first-child:empty::before {
  content: "Start writing…";
  color: var(--ink-700);
  opacity: 0.4;
  pointer-events: none;
}
```

---

### 4. Todo Pane — Full Header Redesign

**File:** `src/components/daily-view.tsx` + `src/app/globals.css`

**Problems to fix:**
- "Todo List" h2 + input + native select are on one crammed row
- Native `<select>` for priority is visually broken
- The "Press ↵ to add" hint is decent but poorly positioned

**Required outcome:**

Restructure the todo pane header into two rows:

**Row 1 (title bar):** Just `<h2>Tasks</h2>` on the left, nothing else. Styled: `text-sm font-semibold uppercase tracking-widest text-[var(--ink-700)]` — small label, not a dominant heading.

**Row 2 (input row):** The task input takes full width. The priority selector and keyboard hint sit below it.

```tsx
// New todo header structure
<div className="todo-header flex flex-col gap-2 px-4 py-3 border-b border-[var(--line)]">
  <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--ink-700)]">
    Tasks
  </h2>
  <div className="flex items-center gap-2">
    <Input
      className="flex-1 h-9 text-sm border-[var(--line)] bg-[var(--paper)]
                 rounded-[10px] placeholder:text-[var(--ink-700)]/50
                 focus-visible:ring-1 focus-visible:ring-[var(--brand)]"
      placeholder="Add a task…"
      value={todoText}
      onChange={...}
      onKeyDown={...}
    />
    {/* Replace native <select> with shadcn Select */}
    <Select value={String(priority)} onValueChange={(v) => setPriority(Number(v) as Priority)}>
      <SelectTrigger className="w-[115px] h-9 text-xs border-[var(--line)]
                                bg-[var(--paper)] rounded-[10px]
                                focus:ring-1 focus:ring-[var(--brand)]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="border-[var(--line)] bg-[var(--paper-strong)] rounded-xl text-xs">
        <SelectItem value="1" className="text-[var(--priority-1)] focus:bg-[var(--priority-1-soft)]">
          🔴 Critical
        </SelectItem>
        <SelectItem value="2" className="text-[var(--priority-2)] focus:bg-[var(--priority-2-soft)]">
          🟡 Important
        </SelectItem>
        <SelectItem value="3" className="text-[var(--priority-3)] focus:bg-[var(--priority-3-soft)]">
          🟢 Someday
        </SelectItem>
      </SelectContent>
    </Select>
  </div>
  <p className="text-[11px] text-[var(--ink-700)]/50 leading-none">
    Press ↵ to add
  </p>
</div>
```

Generate the required shadcn components first:
```bash
npx shadcn@latest add select
npx shadcn@latest add input
```

---

### 5. Priority Groups — More Warmth & Breathing Room

**File:** `src/components/daily-view.tsx` + `src/app/globals.css`

**Problems to fix:**
- The three group cards look identical and clinical
- "No tasks yet" placeholder is unstyled and cold
- The gap between cards is too tight

**Required outcome:**
- Increase gap between cards to `gap-3` (12px)
- Each group card: `rounded-xl border border-[var(--line)] overflow-hidden shadow-[0_1px_3px_rgba(31,36,48,0.06)]`
- Group header: left border accent `3px solid var(--priority-N)`, soft bg tint `var(--priority-N-soft)`, padding `px-4 py-3`
- Group label: `text-sm font-semibold text-[var(--ink-900)]` — not uppercase, sentence case
- "No tasks yet" empty state: center it, add more padding `py-6`, use `text-xs text-[var(--ink-700)]/60 italic`
- The priority group header should show a count badge when tasks exist (use shadcn `Badge` — `npx shadcn@latest add badge`)

---

### 6. Notes View — Title as Heading

**File:** `src/components/notes-view.tsx` + `src/app/globals.css`

**Problems to fix:**
- Note title is a plain styled `<input>` — looks like a form field
- New/Delete buttons in the header look like developer controls
- Note card doesn't fill the full viewport height

**Required outcome:**
- Title input: `text-2xl font-semibold text-[var(--ink-900)] bg-transparent border-none outline-none w-full placeholder:text-[var(--ink-700)]/30 caret-[var(--brand)]`
- Move **New** button to the sidebar (it's a navigation action, not an editing action — it already exists there as "+ New Note")
- **Delete** button: replace with a small icon button `<Trash2 className="h-4 w-4" />` at the far right of the header, styled `text-[var(--ink-700)] hover:text-[var(--warn)] transition-colors`. Wrap in an `AlertDialog` for confirmation.
- Note card: add `min-h-[calc(100vh-2rem)]` so it fills the page

Generate: `npx shadcn@latest add alert-dialog`

---

### 7. Dark Mode — Fix the Note Editor Background

**File:** `src/app/globals.css`

In dark mode, the Toast UI editor renders a bright white background, which clashes completely with the dark surface. Fix it:

```css
.dark .toastui-editor-defaultUI,
.dark .toastui-editor-ww-container,
.dark .ProseMirror,
.dark .toastui-editor-contents {
  background-color: var(--paper-strong) !important;
  color: var(--ink-900) !important;
}

.dark .toastui-editor-main {
  background-color: var(--paper-strong) !important;
}
```

---

### 8. Global Polish — globals.css Cleanup

**File:** `src/app/globals.css`

Add these utility classes and micro-improvements:

```css
/* Warm shadow utilities */
.shadow-warm {
  box-shadow: 0 1px 3px rgba(31,36,48,0.06), 0 1px 2px rgba(31,36,48,0.04);
}
.shadow-warm-md {
  box-shadow: 0 4px 12px rgba(31,36,48,0.08), 0 1px 3px rgba(31,36,48,0.06);
}
.dark .shadow-warm {
  box-shadow: 0 1px 3px rgba(0,0,0,0.20), 0 1px 2px rgba(0,0,0,0.14);
}
.dark .shadow-warm-md {
  box-shadow: 0 4px 12px rgba(0,0,0,0.28), 0 1px 3px rgba(0,0,0,0.20);
}

/* Sidebar item hover */
.tree-toggle:hover,
.day-button:hover,
.notes-list li button:hover {
  background: rgba(47, 109, 98, 0.10);
}

/* Note pane — increase header padding */
.note-header,
.notes-header {
  padding: 1rem 1.25rem;
}

/* Todo pane — remove the old todo-header single-row layout */
.todo-header {
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
}
```

Also add dark mode priority soft backgrounds:
```css
@media (prefers-color-scheme: dark) {
  :root {
    --priority-1-soft: #2a1715;
    --priority-2-soft: #271f0d;
    --priority-3-soft: #101f15;
  }
}

.dark {
  --priority-1-soft: #2a1715;
  --priority-2-soft: #271f0d;
  --priority-3-soft: #101f15;
}
```

---

## Definition of Done

After implementing all changes, the app should feel like this when you open it:

- [ ] The note pane opens to a clean, paper-like surface with a prominent date and a soft placeholder "Start writing…" — no toolbar visible until you hover/focus
- [ ] The todo pane has a compact header: small "Tasks" label, full-width input, styled priority selector (not a native dropdown), and a small keyboard hint
- [ ] Priority groups have warm tinted headers, warm card shadows, and feel like distinct labeled sections rather than three identical boxes
- [ ] The sidebar has a clear hierarchy: app name → nav tabs → Today → tree (scrollable) → appearance toggle (bottom)
- [ ] Dark mode: the note editor background matches the dark surface — no blinding white box
- [ ] All interactive elements (sidebar items, buttons, inputs) have hover states
- [ ] No native `<select>` elements remain in the app
- [ ] Screenshot the result and confirm it looks significantly more finished and inviting than the before state

## Do NOT change
- App state logic (`src/lib/store.ts`, `src/lib/persistence.ts`, `src/lib/schema.ts`)
- Routing structure
- The carryover behavior between days
- Any test files

---

## Reference files

```
CLAUDE.md                                          ← architecture + UX backlog
.claude/skills/brand-guideline/SKILL.md            ← design system rules
.claude/skills/warm-minimalism-ui/SKILL.md         ← component code patterns
src/app/globals.css                                ← all custom CSS
src/components/sidebar.tsx                         ← sidebar
src/components/daily-view.tsx                      ← note + todo panes
src/components/notes-view.tsx                      ← notes full view
src/components/drawing-overlay.tsx                 ← draw mode controls
src/components/markdown-editor.tsx                 ← Toast UI wrapper
```

# Skill: Warm Editorial UI

**Trigger this skill** whenever you are building, editing, or reviewing any UI component, page, layout, or style in DailyTodoApp. This skill defines the complete design language for the app and must be consulted before writing any JSX, CSS, or Tailwind class.

---

## What This Skill Does

This skill makes you an expert in **Warm Editorial** — the design style for DailyTodoApp. It tells you:
- Which shadcn/ui components to reach for
- How to apply the token system
- What Tailwind classes to use (and avoid)
- The rules for typography, spacing, color, and motion
- How each major UI pattern should be built

Always read this fully before generating any UI code.

---

## The Five Pillars (Non-Negotiable)

### 1. Surface Warmth
- Page background: always `var(--paper)` (`#faf8f4`) — never `bg-white` or `bg-gray-*`
- Card/pane surfaces: `var(--paper-strong)` (`#ffffff`) with warm borders
- Borders: `var(--line)` (`#d9d1c5`) — warm, not cool gray
- Sidebar background: `rgba(255,255,255,0.88)` with `backdrop-filter: blur(6px)`
- Body gradient: two radial warm gradients (teal at top-right, amber at bottom-left) over `var(--paper)`

### 2. Ink Typography
- **Two font roles — never mix them up:**
  - `font-display` (serif, e.g. Lora or Georgia): dates, page titles, priority group headings, the app name
  - `font-body` (sans-serif, e.g. Inter or DM Sans): todo text, labels, inputs, buttons, sidebar nav
- Date headers inside panes: `font-display text-lg font-semibold text-[var(--ink-900)]`
- Note title in Notes view: `font-display text-2xl font-semibold border-none outline-none bg-transparent`
- Muted / secondary text: `text-[var(--ink-700)]`
- Strikethrough done todos: `line-through text-[var(--ink-700)] opacity-60`

### 3. Tonal Color
Single accent, desaturated priority palette. Never use bright primaries.

```
Brand accent:     #2f6d62  (deep teal)
Brand soft bg:    #d9ece8

Priority 1 — Critical:  border/badge #c0392b, soft bg #f9e8e6, label "Critical"
Priority 2 — Important: border/badge #c07c30, soft bg #fdf3e3, label "Important"
Priority 3 — Someday:   border/badge #4a7c59, soft bg #e8f4ec, label "Someday"

Destructive:  #b8422e
```

Map to CSS variables: `--priority-1`, `--priority-1-soft`, `--priority-2`, `--priority-2-soft`, `--priority-3`, `--priority-3-soft`.

### 4. Generous Breathing Room
- Main panel padding: `p-4`
- Card/pane internal padding: `p-4` (headers), `p-3` to `p-4` (body)
- List item vertical gap: `gap-2`
- Between major sections: `gap-4`
- Between grouped cards: `gap-3`
- The layout should **never feel cramped**. If something looks tight, add more space before reducing it.

### 5. Soft Structure
- Cards / panes: `rounded-2xl` (16px), `border border-[var(--line)]`
- Inputs / buttons: `rounded-lg` (10px)
- Badges / pills: `rounded-full`
- Box shadows: warm-tinted only:
  ```css
  /* Default card shadow */
  box-shadow: 0 1px 3px rgba(31,36,48,0.06), 0 1px 2px rgba(31,36,48,0.04);
  /* Hover / elevated shadow */
  box-shadow: 0 4px 12px rgba(31,36,48,0.08), 0 1px 3px rgba(31,36,48,0.06);
  ```
- **Never use Tailwind's default `shadow-*` classes** — they use cool-gray rgba. Write the warm shadow inline or via a custom CSS class.

---

## Token Reference

```css
/* Always use these tokens — never hardcode hex values in components */

--ink-900: #1f2430      /* primary text */
--ink-700: #40495e      /* secondary / muted text */
--paper: #faf8f4        /* page background */
--paper-strong: #ffffff /* card surface */
--line: #d9d1c5         /* borders */
--brand: #2f6d62        /* accent */
--brand-soft: #d9ece8   /* accent bg tint */
--warn: #b8422e         /* destructive */

--priority-1: #c0392b
--priority-1-soft: #f9e8e6
--priority-2: #c07c30
--priority-2-soft: #fdf3e3
--priority-3: #4a7c59
--priority-3-soft: #e8f4ec
```

In Tailwind, use arbitrary values: `bg-[var(--brand-soft)]`, `border-[var(--line)]`, `text-[var(--ink-900)]`.

---

## shadcn/ui Component Guide

Before using any shadcn component, generate it: `npx shadcn@latest add <name>`

### Which component to reach for

| Need | shadcn Component | Notes |
|---|---|---|
| Confirmation dialogs (delete note, clear drawing) | `AlertDialog` | Use `variant="destructive"` for the confirm button |
| Toolbar icon tooltips | `Tooltip` + `TooltipProvider` | Wrap toolbar buttons; use `side="bottom"` |
| Task count / priority labels | `Badge` | Custom variant per priority using token colors |
| Drawing color picker | `Popover` | Triggered from the Draw mode button |
| Sidebar scroll area | `ScrollArea` | Replaces `overflow: auto` on `.sidebar-tree` |
| Form inputs | `Input` | Style override to match warm tokens |
| Select (priority picker) | `Select` | Replaces native `<select>` |
| Checkboxes (todos) | `Checkbox` | Style with brand color on checked state |
| Context menu on todo items | `ContextMenu` | For right-click → change priority / delete |
| Loading states | `Skeleton` | For deferred editor load |

### Styling shadcn components for Warm Editorial

Always override the default shadcn neutral tokens with warm equivalents when using components:

```tsx
// Input — warm border, paper background
<Input className="border-[var(--line)] bg-[var(--paper-strong)] rounded-lg
                  focus-visible:ring-[var(--brand)] placeholder:text-[var(--ink-700)]" />

// Button primary — brand filled
<Button className="bg-[var(--brand)] text-white hover:bg-[var(--brand)]/90 rounded-lg">

// Button secondary — paper with border
<Button variant="outline"
        className="border-[var(--line)] bg-[var(--paper-strong)] text-[var(--ink-900)]
                   hover:bg-[var(--brand-soft)] hover:border-[var(--brand)] rounded-lg">

// Badge — priority 1
<Badge className="bg-[var(--priority-1-soft)] text-[var(--priority-1)]
                  border border-[var(--priority-1)]/30 rounded-full font-sans text-xs">

// Checkbox — brand color when checked
<Checkbox className="data-[state=checked]:bg-[var(--brand)]
                     data-[state=checked]:border-[var(--brand)]" />
```

---

## Component Patterns

### Priority Group Card

Each priority group is a card with:
- A colored left-border accent (3–4px, using `--priority-N`)
- A soft tinted background (using `--priority-N-soft`)
- A serif heading with the priority label ("Critical", "Important", "Someday")
- A count badge in the header
- Empty state placeholder when no tasks

```tsx
// Structure
<div className="rounded-xl border border-[var(--line)] overflow-hidden">
  <div className="flex items-center justify-between px-3 py-2
                  border-l-4 border-l-[var(--priority-1)]
                  bg-[var(--priority-1-soft)]">
    <h3 className="font-display text-sm font-semibold text-[var(--ink-900)]">
      Critical
    </h3>
    {count > 0 && (
      <Badge className="...priority-1 badge styles...">
        {count}
      </Badge>
    )}
  </div>
  <ul className="p-2 flex flex-col gap-1.5">
    {/* todo items */}
    {count === 0 && (
      <li className="text-xs text-[var(--ink-700)] px-2 py-3 text-center">
        No tasks — press Enter to add one
      </li>
    )}
  </ul>
</div>
```

### Todo Item

```tsx
<li className="flex items-center justify-between gap-2 px-2 py-1.5
               rounded-lg hover:bg-[var(--brand-soft)]/30 group">
  <label className="flex items-center gap-2.5 flex-1 cursor-pointer">
    <Checkbox checked={todo.done} ... />
    <span className={todo.done
      ? "line-through text-[var(--ink-700)] opacity-60 text-sm"
      : "text-sm text-[var(--ink-900)]"
    }>
      {todo.text}
    </span>
  </label>
  {/* drag handle — visible on group hover */}
  <GripVertical className="h-3.5 w-3.5 text-[var(--ink-700)] opacity-0
                            group-hover:opacity-40 cursor-grab" />
  {/* delete — visible on item hover */}
  <button className="opacity-0 group-hover:opacity-100 text-[var(--warn)]
                     hover:opacity-100 transition-opacity">
    <X className="h-3.5 w-3.5" />
  </button>
</li>
```

### Sidebar Navigation

Active state should be clearly distinct — filled, not just tinted:

```tsx
// Active tab
<Link className="flex-1 rounded-xl px-3 py-2 text-center text-sm font-medium
                 bg-[var(--brand)] text-white border border-[var(--brand)]">

// Inactive tab
<Link className="flex-1 rounded-xl px-3 py-2 text-center text-sm font-medium
                 bg-[var(--paper-strong)] text-[var(--ink-700)]
                 border border-[var(--line)]
                 hover:bg-[var(--brand-soft)] hover:text-[var(--brand)]
                 hover:border-[var(--brand)]">
```

### Note Title Input (Notes View)

```tsx
<input
  className="w-full font-display text-2xl font-semibold text-[var(--ink-900)]
             bg-transparent border-none outline-none
             placeholder:text-[var(--ink-700)]/40"
  placeholder="Untitled Note"
/>
```

### Draw Mode Toggle

Move out of the Toast UI toolbar. Place as a floating button in the top-right corner of the note pane:

```tsx
<div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
  <Tooltip>
    <TooltipTrigger asChild>
      <button className={cn(
        "h-8 w-8 rounded-lg border flex items-center justify-center transition-colors",
        enabled
          ? "bg-[var(--brand-soft)] border-[var(--brand)] text-[var(--brand)]"
          : "bg-white/90 border-[var(--line)] text-[var(--ink-700)] hover:border-[var(--brand)]"
      )}>
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </TooltipTrigger>
    <TooltipContent side="left">Toggle drawing</TooltipContent>
  </Tooltip>
</div>
```

### Today Button (Sidebar)

```tsx
<button
  onClick={() => dispatch({ type: "select-daily", date: todayISO })}
  className="w-full text-left text-xs font-medium px-2 py-1.5 rounded-lg
             text-[var(--brand)] bg-[var(--brand-soft)]
             hover:bg-[var(--brand)] hover:text-white transition-colors"
>
  Today →
</button>
```

---

## Motion & Transitions

Keep animations minimal and purposeful. The app should feel calm, not bouncy.

- **Default transition**: `transition-colors duration-150 ease-in-out`
- **Hover reveals** (drag handles, delete buttons): `transition-opacity duration-100`
- **Sidebar expand/collapse**: Use a simple CSS height transition or `tw-animate-css`'s slide
- **Checkbox check**: shadcn's default check animation is fine — do not override it
- **No bounce, spring, or scale transforms on primary interactions**

---

## What NOT to Do

- ❌ Never use `bg-white` — use `bg-[var(--paper-strong)]`
- ❌ Never use `bg-gray-*` or `text-gray-*` — use ink tokens
- ❌ Never use Tailwind's default `shadow-*` classes — write warm shadows manually
- ❌ Never use bright/saturated colors for priority — use the desaturated palette above
- ❌ Never mix serif and sans-serif within the same UI role (e.g. don't use serif for button labels)
- ❌ Never use `rounded-full` on cards or panes — only on badges and pills
- ❌ Never place Draw controls inside the markdown toolbar DOM
- ❌ Never add a confirm button to a plain delete without an `AlertDialog`
- ❌ Never use `text-red-*` for destructive actions — use `text-[var(--warn)]`

---

## Checklist Before Submitting Any UI Code

- [ ] All colors use CSS token variables (no raw hex)
- [ ] Typography: serif for display roles, sans-serif for UI chrome
- [ ] Card/pane border radius is `rounded-2xl`, inputs are `rounded-lg`
- [ ] Hover states exist on all interactive elements
- [ ] Shadows are warm-tinted (no default Tailwind shadows)
- [ ] Empty states are present for lists/groups
- [ ] Destructive actions use `AlertDialog`
- [ ] New shadcn components are generated first (`npx shadcn@latest add ...`)
- [ ] The improvement plan in `CLAUDE.md` is checked — is this change addressing a known item?

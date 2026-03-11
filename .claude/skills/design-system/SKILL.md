# Skill: Warm Minimalism Design System

**Read this skill** before making any visual, typographic, color, or motion decision in DailyTodoApp.

---

## Quick Rules

1. All colors via CSS variables — never raw hex in JSX or Tailwind
2. One font family (`font-body`, sans-serif) — no serifs anywhere
3. `rounded-2xl` for containers, `rounded-[10px]` for interactive elements, `rounded-full` for badges
4. Warm shadows only — never Tailwind's default `shadow-*`
5. Hover states on every interactive element — no exceptions
6. Shadcn components must be generated before use: `npx shadcn@latest add <name>`
7. Destructive actions always need `AlertDialog` confirmation
8. Icon-only buttons always need `Tooltip` + `aria-label`
9. The editor is Tiptap (Notion-like) — no visible toolbar, content-first
10. Navigation lives in the top navbar, not the sidebar

---

## Brand Identity

**Style:** Warm Minimalism — *"A paper notebook that learned to code."*

| Trait | Description |
|---|---|
| **Calm** | Uses space to breathe, not noise to communicate |
| **Focused** | One thing at a time. UI steps back so user's thoughts step forward |
| **Warm** | Feels like a well-worn notebook, not a cold dashboard |
| **Honest** | Flat surfaces, real labels, no decorative chrome |
| **Quiet** | Interactions are subtle. Nothing bounces |

---

## Color Tokens

```css
/* Light → Dark */
--paper:         #faf8f4  →  #16191f     /* page background */
--paper-strong:  #ffffff  →  #1e2228     /* card/pane surface */
--line:          #e8e2d9  →  #2d3340     /* all borders */
--ink-900:       #1f2430  →  #e8e2d9     /* primary text */
--ink-700:       #40495e  →  #8c95a6     /* secondary/muted text */
--brand:         #2f6d62  →  #5ea89d     /* accent */
--brand-soft:    #d9ece8  →  #1e3533     /* accent bg tint */
--warn:          #b8422e  →  #d45a44     /* destructive */

/* Priority system */
--priority-1:       #c0392b / #d45a44    /* Critical — dusty red */
--priority-1-soft:  #f9e8e6 / #2a1715
--priority-2:       #c07c30 / #d4963a    /* Important — amber */
--priority-2-soft:  #fdf3e3 / #271f0d
--priority-3:       #4a7c59 / #5a9c6e    /* Someday — sage */
--priority-3-soft:  #e8f4ec / #101f15
```

In Tailwind: `bg-[var(--paper)]`, `text-[var(--ink-900)]`, `border-[var(--line)]`

**Rules:**
- One accent (`--brand`), used sparingly: active states, primary buttons, checkbox checks
- Never hardcode hex values — always use CSS custom properties
- Never use Tailwind's `gray-*` palette
- Color communicates meaning only: priority, state, danger

---

## Typography

```
All roles:   font-body — "Source Sans 3", Inter, DM Sans, system-ui, sans-serif
Monospace:   font-mono — JetBrains Mono, Fira Code, ui-monospace
```

| Element | Size | Weight |
|---|---|---|
| Note title (Notes view) | 28px / 1.75rem | 700 |
| Date header (Daily view) | 18px / text-lg | 600 |
| Section heading | 13px | 600 |
| Body / task text | 13.5px | 400 |
| Secondary / hint | 11-12px | 400 |
| Nav pills | 13px | 500 |

Line-height: 1.7 for body, 1.3 for headings. No serifs.

---

## Spacing & Layout

```
App shell:     [top-navbar 52px] / [sidebar 260px | flex-1 content]
Daily layout:  [flex-1 note pane] | [380px todo pane]
Notes layout:  [flex-1 full-width note]
Main padding:  p-6 (1.5rem)
```

Preferred spacings: `gap-2` (8px) between list items, `gap-3` (12px) between priority groups, `p-5` (1.25rem) sidebar padding.

**Rule:** When in doubt, add more space. Cramped UIs feel anxious.

---

## Shape & Elevation

| Element | Radius |
|---|---|
| Cards / panes | 16px (`rounded-2xl`) |
| Inputs / buttons / nav pills | 7-10px |
| Badges / pills | 9999px (`rounded-full`) |
| Priority groups | 14px |

Shadows: Warm-tinted only, defined as `--surface-shadow` in CSS.

---

## Motion

- **Duration:** 150ms for hover/focus, 200ms for reveals, never > 300ms
- **Easing:** `ease` or `ease-in-out`. Never bounce/spring
- **Approved:** `fadeIn`, `slideUp`, `scaleIn` keyframes in globals.css
- No scale transforms on buttons. No animations for animation's sake.

---

## Component Patterns

### Top Navbar
- Height: 52px, backdrop-blur, border-bottom
- Nav pills: pill-shaped tabs with active state bg + shadow
- Theme toggle: icon cycle button (Sun → Moon → Monitor)

### Sidebar
- Clean tree with `ChevronRight` icons (rotate 90° when open)
- Today button: `--brand-soft` bg, `--brand` text, hover fills fully
- Notes list: title + date, active state `--brand-soft`

### Priority Group
- Left-border accent (3px, group color)
- Header bg uses `--priority-N-soft`
- Count badge: `rounded-full`, accent color

### Inline Task Input (Apple Reminders style)
- Lives at the bottom of each priority group
- `+` icon in group's accent color
- Transparent input, placeholder in muted text
- Enter to submit, auto-clears

### Tiptap Editor
- No visible toolbar — content-first
- Placeholder: "Start writing…" in `--ink-700` at 35% opacity
- Styled via `.tiptap-editor` class in globals.css
- Markdown serialization via `tiptap-markdown` extension

---

## Anti-Patterns

| Pattern | Why it breaks the design |
|---|---|
| Glassmorphism (heavy) | Too decorative |
| Gradient fills on components | Only on page body |
| Saturated/bright colors | Use desaturated tonal palette |
| Bold icon strokes | Use default 1.5 stroke width |
| Bounce/spring animations | Contradicts calm personality |
| True black (`#000`) dark mode | Use warm dark blue-gray |
| Serif fonts | Stay sans-serif |
| Visible editor toolbars | Content-first, toolbar-free |

---

## Accessibility

- Text/background: WCAG AA (4.5:1 normal, 3:1 large)
- Focus indicator: `outline: 2px solid var(--brand); outline-offset: 2px`
- Icon-only buttons: `aria-label` + `Tooltip`
- Priority color paired with text label
- Respect `prefers-reduced-motion`

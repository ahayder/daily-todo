---
name: tiptap-editor
description: >
  Apply the Tiptap Editor & Markdown skill when modifying the text editor, adding new formatting features,
  slash commands, bubble menus, or changing the Excalidraw drawing embeds. Use this skill to avoid breaking
  Next.js SSR compatibility or the tiptap-markdown round-tripping rules.
---

# Tiptap Editor & Markdown

> **This skill governs the DailyTodoApp text editor.** The editor is built on Tiptap (ProseMirror) with a strict requirement for markdown serialization and SSR safety.

---

## 1. Core Editor Principles

1. **Content-First**: There is NO permanent visible toolbar. Interactions happen via the `/` Slash Command menu or the floating Bubble Menu on text selection.
2. **SSR Compatibility**: Tiptap must be initialized with `immediatelyRender: false` in React to prevent hydration mismatches in Next.js.
3. **Markdown Round-tripping**: The application persists content as plain markdown (using `tiptap-markdown`). Do not add Tiptap extensions that cannot be flawlessly serialized to and parsed from standard or GitHub-flavored markdown.

---

## 2. Adding Editor Features

Any new extension or feature must be placed in `src/components/editor/`.

### Toolbars and Menus
- Use `src/components/editor/slash-command.tsx` for block-level insertions.
- Use `src/components/editor/bubble-menu.tsx` for inline formatting (bold, italic, links).
- Always use the design system's warm, soft UI patterns (using `var(--paper-strong)` and `var(--line)`) for floating editor menus.

### Custom Node Views
When embedding interactive React components inside the editor (like the drawing integration):
- Node Views must manage their own isolated state.
- Data must be serialized into the markdown as a specialized HTML or fenced code block so `tiptap-markdown` can save it.
- Wrapping components need `contentEditable="false"` to prevent ProseMirror from fighting over keyboard events.

---

## 3. The Drawing Embeds (Excalidraw & TLDraw)

DailyTodoApp uses **Excalidraw** for all new drawings, embedded inside the Tiptap Node View (`src/components/editor/drawing-node.ts` and `drawing-view.tsx`).

### Legacy TLDraw Migration
Older entries might have legacy `tldraw` JSON payloads.
These are strictly considered **read-only migration-era content**. DO NOT attempt to make the legacy tldraw payloads editable. They exist only as a fallback visual, with a button allowing the user to create a fresh Excalidraw canvas to replace it.

---

## 4. Checklist

Before merging editor changes:
- [ ] The `immediatelyRender: false` property was maintained on the `useEditor` hook.
- [ ] New nodes/marks successfully serialize back to plain markdown text.
- [ ] The slash command or bubble menu matches the Warm Minimalism design system.
- [ ] The toolbar remains hidden when not actively selecting text or typing `/`.

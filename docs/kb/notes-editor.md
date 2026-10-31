# Notes & markdown editor
Last verified: 2026-10-31

Notes are full-width docs (title + editor) in folders. The editor (also used for Daily notes) is
Tiptap with markdown round-trip and embedded Excalidraw drawings.

## How it works
- Editor: `src/components/editor/markdown-editor.tsx` — `@tiptap/react` with `immediatelyRender: false` (Next.js SSR), `tiptap-markdown` for serialization, plus toolbar, bubble menu, slash command.
- Drawings: Excalidraw boards stored as node data inside the Tiptap document (`drawing-node.ts`, `drawing-view.tsx`, `drawing-toolbar.tsx`).
- Legacy tldraw payloads render as a non-editable fallback with a way to create a fresh Excalidraw board.
- Read-only while the workspace is in the cached/offline phase (`useIsWorkspaceReadOnly`).
- Notes view: `src/components/notes/notes-view.tsx`.

## Gotchas
- Text must read well in Bengali (note line-height ≥ 1.7).
- More editor detail: `.agents/skills/tiptap-editor/`.

## Related
[sync-persistence.md](sync-persistence.md)

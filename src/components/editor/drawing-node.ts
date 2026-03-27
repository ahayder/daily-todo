import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { DrawingView } from "./drawing-view";

export const DrawingNode = Node.create({
  name: "drawing",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      excalidrawState: {
        default: null,
        // Parse from HTML data attribute (base64-encoded JSON)
        parseHTML: (element: HTMLElement) => {
          const data = element.getAttribute("data-excalidraw");
          if (!data) return null;
          try {
            return JSON.parse(atob(data));
          } catch {
            return null;
          }
        },
        // Render to HTML data attribute (base64-encoded JSON)
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.excalidrawState) return {};
          try {
            const json = JSON.stringify(attributes.excalidrawState);
            return { "data-excalidraw": btoa(json) };
          } catch {
            return {};
          }
        },
      },
      legacyDrawing: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          if (element.hasAttribute("data-tldraw")) return "tldraw";
          return element.getAttribute("data-legacy-drawing");
        },
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.legacyDrawing) return {};
          return { "data-legacy-drawing": attributes.legacyDrawing };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="drawing"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "drawing" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DrawingView);
  },
});

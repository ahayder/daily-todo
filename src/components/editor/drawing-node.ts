import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { DrawingView } from "./drawing-view";

export const DrawingNode = Node.create({
  name: "drawing",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      tldrawState: {
        default: null,
        // Parse from HTML data attribute (base64-encoded JSON)
        parseHTML: (element: HTMLElement) => {
          const data = element.getAttribute("data-tldraw");
          if (!data) return null;
          try {
            return JSON.parse(atob(data));
          } catch {
            return null;
          }
        },
        // Render to HTML data attribute (base64-encoded JSON)
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.tldrawState) return {};
          try {
            const json = JSON.stringify(attributes.tldrawState);
            return { "data-tldraw": btoa(json) };
          } catch {
            return {};
          }
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

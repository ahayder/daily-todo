"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Markdown } from "tiptap-markdown";
import Image from "@tiptap/extension-image";
import { useEffect, useRef } from "react";
import { DrawingNode } from "./editor/drawing-node";
import { EditorToolbar } from "./editor/editor-toolbar";
import { EditorBubbleMenu } from "./editor/bubble-menu";
import { SlashCommand } from "./editor/slash-command";
import { compressImageToBase64 } from "@/lib/image";

type Props = {
  value: string;
  onChange: (nextMarkdown: string) => void;
};

export function MarkdownEditor({ value, onChange }: Props) {
  const isInternalChange = useRef(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: "Start writing…",
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Markdown.configure({
        html: true,
        transformPastedText: true,
        transformCopiedText: true,
      }),
      Image.configure({
        allowBase64: true,
      }),
      DrawingNode,
      SlashCommand,
    ],
    content: value,
    editorProps: {
      attributes: {
        class: "tiptap-editor",
      },
      handleDrop(view, event) {
        if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length > 0) {
          let handled = false;
          Array.from(event.dataTransfer.files).forEach((file) => {
            if (file.type.startsWith("image/")) {
              handled = true;
              event.preventDefault();
              compressImageToBase64(file).then((base64) => {
                const { schema } = view.state;
                const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY });
                if (!coordinates) return;
                const node = schema.nodes.image.create({ src: base64 });
                const transaction = view.state.tr.insert(coordinates.pos, node);
                view.dispatch(transaction);
              });
            }
          });
          if (handled) return true;
        }
        return false;
      },
      handlePaste(view, event) {
        if (event.clipboardData && event.clipboardData.files && event.clipboardData.files.length > 0) {
          let handled = false;
          Array.from(event.clipboardData.files).forEach((file) => {
            if (file.type.startsWith("image/")) {
              handled = true;
              event.preventDefault();
              compressImageToBase64(file).then((base64) => {
                const { schema } = view.state;
                const node = schema.nodes.image.create({ src: base64 });
                const transaction = view.state.tr.replaceSelectionWith(node);
                view.dispatch(transaction);
              });
            }
          });
          if (handled) return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      isInternalChange.current = true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const md = (ed.storage as any).markdown.getMarkdown();
      onChange(md);
    },
  });

  // Sync external value changes (e.g. switching between pages)
  useEffect(() => {
    if (!editor) return;

    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const currentMd = (editor.storage as any).markdown.getMarkdown();
    if (currentMd !== value) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  return (
    <div className="tiptap-wrapper h-full w-full">
      <EditorToolbar editor={editor} />
      <div className="tiptap-content">
        <EditorBubbleMenu editor={editor} />
        <EditorContent editor={editor} className="flex-1" />
      </div>
    </div>
  );
}

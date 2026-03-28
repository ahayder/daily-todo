"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Markdown } from "tiptap-markdown";
import { useEffect, useRef } from "react";
import { DrawingNode } from "./editor/drawing-node";
import { EditorToolbar } from "./editor/editor-toolbar";
import { EditorBubbleMenu } from "./editor/bubble-menu";
import { SlashCommand } from "./editor/slash-command";

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
      DrawingNode,
      SlashCommand,
    ],
    content: value,
    editorProps: {
      attributes: {
        class: "tiptap-editor",
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

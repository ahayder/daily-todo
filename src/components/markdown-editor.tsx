"use client";

import { useEffect, useRef } from "react";
import type { Editor } from "@toast-ui/react-editor";
import dynamic from "next/dynamic";
import "@toast-ui/editor/dist/toastui-editor.css";

const EditorComponent = dynamic(
  async () => {
    const mod = await import("@toast-ui/react-editor");
    return mod.Editor;
  },
  { ssr: false },
);

type Props = {
  value: string;
  onChange: (nextMarkdown: string) => void;
};

export function MarkdownEditor({ value, onChange }: Props) {
  const editorRef = useRef<Editor>(null);

  useEffect(() => {
    const instance = editorRef.current?.getInstance();
    if (!instance) return;

    const toolbar = instance.getRootElement().querySelector(".toastui-editor-toolbar");
    if (!toolbar) return;

    const labelByClass: Record<string, string> = {
      heading: "Heading",
      bold: "Bold",
      italic: "Italic",
      strike: "Strikethrough",
      hr: "Horizontal rule",
      quote: "Quote",
      ul: "Bullet list",
      ol: "Numbered list",
      task: "Task list",
      table: "Insert table",
      image: "Insert image",
      link: "Insert link",
      code: "Inline code",
      codeblock: "Code block",
    };

    toolbar.querySelectorAll("button").forEach((button: Element) => {
      const htmlButton = button as HTMLButtonElement;
      const match = Object.entries(labelByClass).find(([key]) => htmlButton.className.includes(key));
      const fallback = htmlButton.textContent?.trim() || "Editor action";
      htmlButton.setAttribute("title", match?.[1] ?? fallback);
    });
  }, []);

  useEffect(() => {
    const instance = editorRef.current?.getInstance();
    if (!instance) return;

    if (instance.getMarkdown() !== value) {
      instance.setMarkdown(value, false);
    }
  }, [value]);

  return (
    <EditorComponent
      ref={editorRef}
      initialValue={value}
      initialEditType="wysiwyg"
      hideModeSwitch
      usageStatistics={false}
      height="100%"
      toolbarItems={[
        ["heading", "bold", "italic", "strike"],
        ["hr", "quote"],
        ["ul", "ol", "task"],
        ["table", "image", "link"],
        ["code", "codeblock"],
      ]}
      onChange={() => {
        const nextValue = editorRef.current?.getInstance().getMarkdown() ?? "";
        onChange(nextValue);
      }}
    />
  );
}

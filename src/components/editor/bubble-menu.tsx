"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { type Editor } from "@tiptap/react";
import { Bold, Heading1, Heading2, Heading3, List, ListTodo } from "lucide-react";

type Props = {
  editor: Editor | null;
};

export function EditorBubbleMenu({ editor }: Props) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    if (!editor) return;

    const { from, to, empty } = editor.state.selection;
    if (empty || from === to) {
      setIsVisible(false);
      return;
    }

    // Get the bounding rect of the selection
    const view = editor.view;
    const start = view.coordsAtPos(from);
    const end = view.coordsAtPos(to);

    // Get the editor wrapper's bounding rect for relative positioning
    const editorEl = view.dom.closest(".tiptap-wrapper");
    if (!editorEl) return;
    const editorRect = editorEl.getBoundingClientRect();

    const menuWidth = menuRef.current?.offsetWidth ?? 240;
    const centerX = (start.left + end.right) / 2 - editorRect.left - menuWidth / 2;
    const topY = start.top - editorRect.top - 44; // 44px above selection

    setPosition({
      top: Math.max(0, topY),
      left: Math.max(8, centerX),
    });
    setIsVisible(true);
  }, [editor]);

  useEffect(() => {
    if (!editor) return;

    const handleSelectionUpdate = () => {
      // Use requestAnimationFrame for smooth positioning
      requestAnimationFrame(updatePosition);
    };

    editor.on("selectionUpdate", handleSelectionUpdate);
    editor.on("blur", () => setIsVisible(false));

    return () => {
      editor.off("selectionUpdate", handleSelectionUpdate);
      editor.off("blur", () => setIsVisible(false));
    };
  }, [editor, updatePosition]);

  useEffect(() => {
    if (!isVisible) return;

    requestAnimationFrame(updatePosition);
  }, [isVisible, updatePosition]);

  if (!editor || !isVisible) return null;

  return (
    <div
      ref={menuRef}
      className="bubble-menu"
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          editor.chain().focus().toggleBold().run();
        }}
        className={`bubble-btn ${editor.isActive("bold") ? "bubble-btn--active" : ""}`}
      >
        <Bold size={14} />
      </button>
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          editor.chain().focus().toggleHeading({ level: 1 }).run();
        }}
        className={`bubble-btn ${editor.isActive("heading", { level: 1 }) ? "bubble-btn--active" : ""}`}
      >
        <Heading1 size={14} />
      </button>
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          editor.chain().focus().toggleHeading({ level: 2 }).run();
        }}
        className={`bubble-btn ${editor.isActive("heading", { level: 2 }) ? "bubble-btn--active" : ""}`}
      >
        <Heading2 size={14} />
      </button>
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          editor.chain().focus().toggleHeading({ level: 3 }).run();
        }}
        className={`bubble-btn ${editor.isActive("heading", { level: 3 }) ? "bubble-btn--active" : ""}`}
      >
        <Heading3 size={14} />
      </button>
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          editor.chain().focus().toggleBulletList().run();
        }}
        className={`bubble-btn ${editor.isActive("bulletList") ? "bubble-btn--active" : ""}`}
      >
        <List size={14} />
      </button>
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          editor.chain().focus().toggleTaskList().run();
        }}
        className={`bubble-btn ${editor.isActive("taskList") ? "bubble-btn--active" : ""}`}
      >
        <ListTodo size={14} />
      </button>
    </div>
  );
}

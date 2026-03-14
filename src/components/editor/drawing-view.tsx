"use client";

import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Tldraw, useEditor, loadSnapshot, getSnapshot } from "tldraw";
import { DrawingToolbar } from "./drawing-toolbar";
import "tldraw/tldraw.css";

function TldrawInner({
  initialState,
  onChange,
}: {
  initialState: unknown;
  onChange: (state: unknown) => void;
}) {
  const editor = useEditor();

  // Load initial state, then set default tool to draw (pen)
  useEffect(() => {
    if (initialState) {
      try {
        // Validate shape — loadSnapshot expects { document, session }
        if (
          typeof initialState === "object" &&
          initialState !== null &&
          "document" in (initialState as Record<string, unknown>)
        ) {
          // Only load document data, skip session (which contains tool state)
          loadSnapshot(editor.store, {
            document: (initialState as { document: unknown }).document,
          } as Parameters<typeof loadSnapshot>[1]);
        }
      } catch (error) {
        console.warn("Failed to load tldraw state", error);
      }
    }
    // Always default to draw tool
    editor.setCurrentTool("draw");
  }, [editor, initialState]);

  // Sync dark mode from app's .dark class
  useEffect(() => {
    const root = document.documentElement;

    const syncTheme = () => {
      const isDark = root.classList.contains("dark");
      editor.user.updateUserPreferences({
        colorScheme: isDark ? "dark" : "light",
      });
    };

    // Set initial theme
    syncTheme();

    // Observe class changes on <html>
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName === "class") {
          syncTheme();
        }
      }
    });

    observer.observe(root, { attributes: true });
    return () => observer.disconnect();
  }, [editor]);

  // Listen for changes and flush to Tiptap
  const timeoutRef = useRef<NodeJS.Timeout>(null);

  useEffect(() => {
    const unsub = editor.store.listen(() => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        const doc = getSnapshot(editor.store);
        onChange(doc);
      }, 500);
    });
    return () => {
      unsub();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [editor, onChange]);

  return <DrawingToolbar />;
}

export function DrawingView(props: NodeViewProps) {
  const { node, updateAttributes } = props;
  const [isFocused, setIsFocused] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const handleChange = useMemo(() => {
    return (state: unknown) => {
      updateAttributes({ tldrawState: state });
    };
  }, [updateAttributes]);

  // Handle click-outside to unfocus
  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    },
    []
  );

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [handleClickOutside]);

  return (
    <NodeViewWrapper className="drawing-node-wrapper tptp-block my-6">
      <div
        ref={wrapperRef}
        className={`drawing-canvas-container ${
          isFocused ? "drawing-canvas-container--focused" : ""
        } ${props.selected ? "drawing-canvas-container--selected" : ""}`}
        onClick={() => setIsFocused(true)}
      >
        <Tldraw
          hideUi={true}
          inferDarkMode={false}
          components={{
            Toolbar: null,
            StylePanel: null,
            ActionsMenu: null,
            MainMenu: null,
            PageMenu: null,
            NavigationPanel: null,
            HelpMenu: null,
            ZoomMenu: null,
            HelperButtons: null,
            Minimap: null,
            MenuPanel: null,
            QuickActions: null,
          }}
        >
          <TldrawInner
            initialState={node.attrs.tldrawState}
            onChange={handleChange}
          />
        </Tldraw>
      </div>
    </NodeViewWrapper>
  );
}

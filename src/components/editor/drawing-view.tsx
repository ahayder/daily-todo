"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import type {
  BinaryFiles,
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
  ExcalidrawProps,
  AppState as ExcalidrawAppState,
} from "@excalidraw/excalidraw/types";
import { DrawingToolbar } from "./drawing-toolbar";
import "@excalidraw/excalidraw/index.css";

type PersistedExcalidrawState = ExcalidrawInitialDataState | null;
type ExcalidrawChangeHandler = NonNullable<ExcalidrawProps["onChange"]>;

const ExcalidrawCanvas = dynamic(
  () => import("@excalidraw/excalidraw").then((mod) => mod.Excalidraw),
  {
    ssr: false,
    loading: () => <div className="drawing-excalidraw-loading">Loading canvas…</div>,
  },
);

function isPersistedExcalidrawState(value: unknown): value is ExcalidrawInitialDataState {
  if (!value || typeof value !== "object") return false;

  return "elements" in value || "appState" in value || "files" in value;
}

function getTheme() {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function DrawingView(props: NodeViewProps) {
  const { node, updateAttributes } = props;
  const [isFocused, setIsFocused] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    typeof document === "undefined" ? "light" : getTheme(),
  );
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>(null);

  const excalidrawState = useMemo<PersistedExcalidrawState>(() => {
    if (isPersistedExcalidrawState(node.attrs.excalidrawState)) {
      return node.attrs.excalidrawState;
    }

    return null;
  }, [node.attrs.excalidrawState]);

  const isLegacyDrawing = Boolean(node.attrs.legacyDrawing);

  const handleChange = useMemo<ExcalidrawChangeHandler>(() => {
    return (elements, appState, files) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      timeoutRef.current = setTimeout(() => {
        void import("@excalidraw/excalidraw").then(({ serializeAsJSON }) => {
          const state = JSON.parse(
            serializeAsJSON(elements, appState as ExcalidrawAppState, files as BinaryFiles, "local"),
          ) as ExcalidrawInitialDataState;

          updateAttributes({
            excalidrawState: state,
            legacyDrawing: null,
          });
        });
      }, 500);
    };
  }, [updateAttributes]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

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

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(getTheme());
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!excalidrawAPI || isLegacyDrawing) return;

    excalidrawAPI.setActiveTool({ type: "freedraw" });
  }, [excalidrawAPI, isLegacyDrawing]);

  const handleClear = useCallback(() => {
    if (!excalidrawAPI) return;

    excalidrawAPI.updateScene({
      elements: [],
    });
  }, [excalidrawAPI]);

  return (
    <NodeViewWrapper className="drawing-node-wrapper tptp-block my-6">
      <div
        ref={wrapperRef}
        className={`drawing-canvas-container ${
          isFocused ? "drawing-canvas-container--focused" : ""
        } ${props.selected ? "drawing-canvas-container--selected" : ""}`}
        onClick={() => setIsFocused(true)}
      >
        {isLegacyDrawing ? (
          <div className="drawing-legacy-state" contentEditable={false}>
            <div className="drawing-legacy-state__card">
              <p className="drawing-legacy-state__eyebrow">Legacy drawing</p>
              <h3 className="drawing-legacy-state__title">This older board can&apos;t be edited anymore.</h3>
              <p className="drawing-legacy-state__body">
                This note was saved with the old tldraw format. Start a fresh Excalidraw board to keep working.
              </p>
              <button
                type="button"
                className="drawing-legacy-state__button"
                onClick={() => {
                  updateAttributes({
                    legacyDrawing: null,
                    excalidrawState: null,
                  });
                }}
              >
                Create fresh drawing
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="drawing-excalidraw-shell" contentEditable={false}>
              <ExcalidrawCanvas
                excalidrawAPI={setExcalidrawAPI}
                initialData={excalidrawState}
                onChange={handleChange}
                theme={theme}
                UIOptions={{
                  canvasActions: {
                    changeViewBackgroundColor: false,
                    clearCanvas: false,
                    export: false,
                    loadScene: false,
                    saveAsImage: false,
                    saveToActiveFile: false,
                    toggleTheme: false,
                  },
                  tools: {
                    image: false,
                  },
                }}
              />
            </div>
            <DrawingToolbar api={excalidrawAPI} onClear={handleClear} />
          </>
        )}
      </div>
    </NodeViewWrapper>
  );
}

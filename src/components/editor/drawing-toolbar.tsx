"use client";

import { useEditor } from "tldraw";
import { useState, useRef, useEffect } from "react";
import { DefaultColorStyle } from "tldraw";
import {
  Pencil,
  Eraser,
  MousePointer2,
  ArrowUpRight,
  Square,
  Type,
  Undo2,
  Redo2,
  Palette,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const COLORS = [
  { name: "Black", value: "black", hex: "#1d1d1d" },
  { name: "Grey", value: "grey", hex: "#9b9b9b" },
  { name: "Blue", value: "blue", hex: "#4465e9" },
  { name: "Light blue", value: "light-blue", hex: "#4ba1f1" },
  { name: "Green", value: "green", hex: "#099268" },
  { name: "Light green", value: "light-green", hex: "#40c057" },
  { name: "Orange", value: "orange", hex: "#f76707" },
  { name: "Red", value: "red", hex: "#e03131" },
  { name: "Violet", value: "violet", hex: "#ae3ec9" },
];

type Tool = {
  id: string;
  icon: React.ReactNode;
  label: string;
};

const TOOLS: Tool[] = [
  { id: "select", icon: <MousePointer2 size={16} />, label: "Select" },
  { id: "draw", icon: <Pencil size={16} />, label: "Draw" },
  { id: "eraser", icon: <Eraser size={16} />, label: "Eraser" },
  { id: "arrow", icon: <ArrowUpRight size={16} />, label: "Arrow" },
  { id: "geo", icon: <Square size={16} />, label: "Rectangle" },
  { id: "text", icon: <Type size={16} />, label: "Text" },
];

export function DrawingToolbar() {
  const editor = useEditor();
  const [showColors, setShowColors] = useState(false);
  const colorRef = useRef<HTMLDivElement>(null);
  const currentToolId = editor.getCurrentToolId();

  // Close color popover on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (colorRef.current && !colorRef.current.contains(e.target as Node)) {
        setShowColors(false);
      }
    }
    if (showColors) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [showColors]);

  return (
    <div className="drawing-toolbar">
      <div className="drawing-toolbar-inner">
        {TOOLS.map((tool) => (
          <Tooltip key={tool.id}>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={`dtb-btn ${currentToolId === tool.id ? "dtb-btn--active" : ""}`}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  editor.setCurrentTool(tool.id);
                }}
              >
                {tool.icon}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {tool.label}
            </TooltipContent>
          </Tooltip>
        ))}

        <div className="dtb-divider" />

        {/* Color picker */}
        <div className="dtb-color-wrapper" ref={colorRef}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="dtb-btn"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setShowColors(!showColors);
                }}
              >
                <Palette size={16} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Color
            </TooltipContent>
          </Tooltip>
          {showColors && (
            <div className="dtb-color-popover">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  className="dtb-color-swatch"
                  title={c.name}
                  style={{ backgroundColor: c.hex }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    editor.setStyleForNextShapes(DefaultColorStyle, c.value as "black" | "grey" | "blue" | "light-blue" | "green" | "light-green" | "orange" | "red" | "violet");
                    editor.setStyleForSelectedShapes(DefaultColorStyle, c.value as "black" | "grey" | "blue" | "light-blue" | "green" | "light-green" | "orange" | "red" | "violet");
                    setShowColors(false);
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="dtb-divider" />

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="dtb-btn"
              onPointerDown={(e) => {
                e.stopPropagation();
                editor.undo();
              }}
            >
              <Undo2 size={16} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            Undo
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="dtb-btn"
              onPointerDown={(e) => {
                e.stopPropagation();
                editor.redo();
              }}
            >
              <Redo2 size={16} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            Redo
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

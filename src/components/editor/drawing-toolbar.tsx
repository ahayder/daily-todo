"use client";

import { useState, useRef, useEffect } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import {
  Pencil,
  Eraser,
  MousePointer2,
  ArrowUpRight,
  Square,
  Type,
  Palette,
  Trash2,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const COLORS = [
  { name: "Ink", value: "#1f2430", hex: "#1f2430" },
  { name: "Slate", value: "#6c7483", hex: "#6c7483" },
  { name: "Brand", value: "#2f6d62", hex: "#2f6d62" },
  { name: "Blue", value: "#4465e9", hex: "#4465e9" },
  { name: "Amber", value: "#c07c30", hex: "#c07c30" },
  { name: "Red", value: "#b8422e", hex: "#b8422e" },
];

type ToolId = "selection" | "freedraw" | "eraser" | "arrow" | "rectangle" | "text";

type Tool = {
  id: ToolId;
  icon: React.ReactNode;
  label: string;
};

const TOOLS: Tool[] = [
  { id: "selection", icon: <MousePointer2 size={16} />, label: "Select" },
  { id: "freedraw", icon: <Pencil size={16} />, label: "Draw" },
  { id: "eraser", icon: <Eraser size={16} />, label: "Eraser" },
  { id: "arrow", icon: <ArrowUpRight size={16} />, label: "Arrow" },
  { id: "rectangle", icon: <Square size={16} />, label: "Rectangle" },
  { id: "text", icon: <Type size={16} />, label: "Text" },
];

type Props = {
  api: ExcalidrawImperativeAPI | null;
  onClear: () => void;
};

export function DrawingToolbar({ api, onClear }: Props) {
  const [showColors, setShowColors] = useState(false);
  const [activeTool, setActiveTool] = useState<ToolId>("freedraw");
  const [activeColor, setActiveColor] = useState(COLORS[0].value);
  const colorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!api) return;

    const syncFromAppState = () => {
      const appState = api.getAppState();
      const nextTool = appState.activeTool.type;
      setActiveTool((nextTool === "selection" ||
        nextTool === "freedraw" ||
        nextTool === "eraser" ||
        nextTool === "arrow" ||
        nextTool === "rectangle" ||
        nextTool === "text")
        ? nextTool
        : "freedraw");
      setActiveColor(appState.currentItemStrokeColor);
    };

    syncFromAppState();
    return api.onChange(() => {
      syncFromAppState();
    });
  }, [api]);

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

  const selectTool = (tool: ToolId) => {
    if (!api) return;
    api.setActiveTool({ type: tool });
  };

  const selectColor = (color: string) => {
    if (!api) return;
    api.updateScene({
      appState: {
        currentItemStrokeColor: color,
      },
    });
    setShowColors(false);
  };

  return (
    <div className="drawing-toolbar">
      <div className="drawing-toolbar-inner">
        {TOOLS.map((tool) => (
          <Tooltip key={tool.id}>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={tool.label}
                className={`dtb-btn ${activeTool === tool.id ? "dtb-btn--active" : ""}`}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  selectTool(tool.id);
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
                aria-label="Choose stroke color"
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
                  aria-label={c.name}
                  className={`dtb-color-swatch ${activeColor === c.value ? "dtb-color-swatch--active" : ""}`}
                  title={c.name}
                  style={{ backgroundColor: c.hex }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    selectColor(c.value);
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
              aria-label="Clear canvas"
              className="dtb-btn"
              onPointerDown={(e) => {
                e.stopPropagation();
                onClear();
              }}
            >
              <Trash2 size={16} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            Clear canvas
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

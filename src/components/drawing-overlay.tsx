"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DrawingStroke, DrawingTool, Point } from "@/lib/types";

type Props = {
  strokes: DrawingStroke[];
  onChange: (strokes: DrawingStroke[]) => void;
};

const PEN_SIZE = 2;
const ERASER_SIZE = 20;

function drawStroke(ctx: CanvasRenderingContext2D, stroke: DrawingStroke): void {
  if (stroke.points.length < 2) return;

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = stroke.size;

  if (stroke.tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0,0,0,1)";
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = "rgba(23, 33, 52, 0.92)";
  }

  ctx.beginPath();
  ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
  for (let i = 1; i < stroke.points.length; i += 1) {
    ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
  }
  ctx.stroke();
  ctx.restore();
}

function getLocalPoint(event: PointerEvent, canvas: HTMLCanvasElement): Point {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

export function DrawingOverlay({ strokes, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [tool, setTool] = useState<DrawingTool>("pen");
  const [activeStroke, setActiveStroke] = useState<DrawingStroke | null>(null);

  const size = tool === "eraser" ? ERASER_SIZE : PEN_SIZE;

  const controls = useMemo(
    () => (
      <div className="drawing-controls">
        <button type="button" onClick={() => setEnabled((prev) => !prev)}>
          {enabled ? "Hide Drawing" : "Draw"}
        </button>
        {enabled ? (
          <>
            <button
              type="button"
              className={tool === "pen" ? "is-active" : ""}
              onClick={() => setTool("pen")}
            >
              Pen
            </button>
            <button
              type="button"
              className={tool === "eraser" ? "is-active" : ""}
              onClick={() => setTool("eraser")}
            >
              Eraser
            </button>
            <button type="button" onClick={() => onChange([])}>
              Clear
            </button>
          </>
        ) : null}
      </div>
    ),
    [enabled, onChange, tool],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of strokes) {
      drawStroke(ctx, stroke);
    }

    if (activeStroke) {
      drawStroke(ctx, activeStroke);
    }
  }, [strokes, activeStroke]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !enabled) return;

    const handlePointerDown = (event: PointerEvent) => {
      event.preventDefault();
      canvas.setPointerCapture(event.pointerId);

      const point = getLocalPoint(event, canvas);
      setActiveStroke({
        id: crypto.randomUUID(),
        tool,
        size,
        points: [point],
      });
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!activeStroke) return;
      const point = getLocalPoint(event, canvas);
      setActiveStroke((current) =>
        current
          ? {
              ...current,
              points: [...current.points, point],
            }
          : null,
      );
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (!activeStroke) return;
      canvas.releasePointerCapture(event.pointerId);
      onChange([...strokes, activeStroke]);
      setActiveStroke(null);
    };

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("pointerleave", handlePointerUp);

    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointerleave", handlePointerUp);
    };
  }, [enabled, activeStroke, onChange, size, strokes, tool]);

  return (
    <>
      {controls}
      <canvas ref={canvasRef} className={`drawing-layer ${enabled ? "enabled" : ""}`} />
    </>
  );
}

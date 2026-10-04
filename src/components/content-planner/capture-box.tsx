"use client";

import { Check, Plus } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";

type CaptureBoxProps = {
  /** Called with the first line as the title and the rest as notes. */
  onCapture: (title: string, notes: string) => void;
};

export const CAPTURE_PLACEHOLDER =
  "আমি আসলে কী বলতে চাই? এমনভাবে লিখুন যেন পরে title দেখেই idea-টা মনে পড়ে…";

/** Split captured text: first line = title, the rest = notes. */
export function splitCaptureText(text: string): { title: string; notes: string } | null {
  const normalized = text.trim();
  if (!normalized) return null;
  const [title, ...rest] = normalized.split(/\r?\n/);
  return { title: title.trim(), notes: rest.join("\n").trim() };
}

/**
 * Zero-decision capture: one box, Enter saves to Ideas (Shift+Enter for a new
 * line). Focus stays put so several thoughts can be dumped in a row, and a
 * quiet "Saved to Ideas" closes the loop.
 */
export function CaptureBox({ onCapture }: CaptureBoxProps) {
  const [value, setValue] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const id = useId();

  useEffect(() => {
    if (savedAt === null) return;
    const timer = window.setTimeout(() => setSavedAt(null), 2200);
    return () => window.clearTimeout(timer);
  }, [savedAt]);

  const submit = () => {
    const content = splitCaptureText(value);
    if (!content) return;
    onCapture(content.title, content.notes);
    setValue("");
    setSavedAt(Date.now());
    textareaRef.current?.focus();
  };

  return (
    <div className="flex flex-col gap-1">
      <div
        className={cn(
          "flex items-end gap-2 rounded-2xl border border-input bg-card py-1.5 pr-1.5 pl-4 transition-colors",
          "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30",
        )}
      >
        <label htmlFor={id} className="sr-only">
          Capture a thought
        </label>
        <textarea
          id={id}
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              submit();
            } else if (event.key === "Escape") {
              setValue("");
              event.currentTarget.blur();
            }
          }}
          placeholder={CAPTURE_PLACEHOLDER}
          enterKeyHint="done"
          className="field-sizing-content max-h-40 min-h-9 min-w-0 flex-1 resize-none bg-transparent py-1.5 text-[0.9375em] leading-[1.7] text-foreground outline-none placeholder:text-muted-foreground"
        />
        <IconButton
          label="Save to Ideas"
          icon={<Plus />}
          variant="soft"
          size="icon"
          onClick={submit}
          disabled={!value.trim()}
        />
      </div>
      <p className="flex h-5 items-center gap-1 px-4 text-[0.8125rem] text-muted-foreground" aria-live="polite">
        {savedAt !== null ? (
          <>
            <Check aria-hidden="true" className="size-3.5" />
            Saved to Ideas
          </>
        ) : (
          <span className="max-sm:hidden">Enter saves · Shift+Enter for a new line</span>
        )}
      </p>
    </div>
  );
}

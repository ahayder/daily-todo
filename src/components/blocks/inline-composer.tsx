"use client";

import { Plus } from "lucide-react";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type InlineComposerProps = {
  /** Called with trimmed, non-empty text. */
  onSubmit: (text: string) => void;
  /** Visible hint + accessible label, e.g. "Add a must-do…". */
  placeholder: string;
  /**
   * `line`: always-visible single line, Enter adds and keeps focus for rapid entry (todo groups, subtasks).
   * `block`: closed "+ label" trigger that opens a textarea; ⌘/Ctrl+Enter adds, Esc cancels (cards, capture).
   */
  variant?: "line" | "block";
  /** Trigger text for `block`, e.g. "Add card". */
  triggerLabel?: string;
  submitLabel?: string;
  className?: string;
};

export function InlineComposer({
  onSubmit,
  placeholder,
  variant = "line",
  triggerLabel = "Add",
  submitLabel = "Add",
  className,
}: InlineComposerProps) {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();

  const submit = () => {
    const text = value.trim();
    if (!text) return;
    onSubmit(text);
    setValue("");
  };

  if (variant === "line") {
    return (
      <div
        className={cn(
          "group/composer flex items-center gap-2 rounded-full px-3 py-1.5 text-muted-foreground transition-colors hover:bg-card/60 focus-within:bg-card focus-within:ring-1 focus-within:ring-ring pointer-coarse:min-h-11",
          className,
        )}
      >
        <Plus aria-hidden="true" className="size-4 shrink-0 group-focus-within/composer:text-primary" />
        <label htmlFor={id} className="sr-only">
          {placeholder}
        </label>
        <input
          id={id}
          ref={inputRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) {
              event.preventDefault();
              submit();
            } else if (event.key === "Escape") {
              setValue("");
              inputRef.current?.blur();
            }
          }}
          placeholder={placeholder}
          enterKeyHint="enter"
          className="min-w-0 flex-1 bg-transparent text-[0.9375rem] text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>
    );
  }

  if (!open) {
    return (
      <Button variant="ghost" size="sm" className={cn("justify-start text-muted-foreground pointer-coarse:h-11", className)} onClick={() => setOpen(true)}>
        <Plus aria-hidden="true" />
        {triggerLabel}
      </Button>
    );
  }

  const cancel = () => {
    setValue("");
    setOpen(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      submit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
  };

  return (
    <div className={cn("flex flex-col gap-2 animate-enter", className)}>
      <label htmlFor={id} className="sr-only">
        {placeholder}
      </label>
      <Textarea
        id={id}
        autoFocus
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="bg-card"
      />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" className="pointer-coarse:h-11 pointer-coarse:px-4" onClick={cancel}>
          Cancel
        </Button>
        <Button size="sm" className="pointer-coarse:h-11 pointer-coarse:px-4" onClick={submit} disabled={!value.trim()}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

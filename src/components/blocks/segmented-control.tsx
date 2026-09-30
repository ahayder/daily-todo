"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type SegmentedOption<T extends string> = { value: T; label: ReactNode; icon?: ReactNode };

type SegmentedControlProps<T extends string> = {
  /** Accessible name for the group, e.g. "Planner view". */
  label: string;
  options: SegmentedOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  /** Stretch segments to fill the row (mobile pane switchers). */
  fill?: boolean;
  className?: string;
};

/** 2–4 mutually exclusive view states (Now / Set up, Board / Gallery, Todos / Daily note). Not for navigation. */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onValueChange,
  fill = false,
  className,
}: SegmentedControlProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (event: KeyboardEvent, index: number) => {
    const last = options.length - 1;
    let next: number;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = index === last ? 0 : index + 1;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = index === 0 ? last : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    else return;
    event.preventDefault();
    onValueChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-full bg-muted p-1",
        fill && "flex w-full",
        className,
      )}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onValueChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              "inline-flex h-8 items-center justify-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-[color,background-color,box-shadow,transform] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring active:scale-[0.97] motion-reduce:active:scale-100 pointer-coarse:h-11 [&_svg]:size-4",
              fill && "flex-1",
              selected
                ? "bg-card text-foreground shadow-card ring-1 ring-border"
                : "text-muted-foreground hover:bg-card/50 hover:text-foreground",
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

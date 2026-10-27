"use client";

import { Briefcase, Check, User, Video } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { sourceLabel } from "@/lib/memory/history-view";
import type { LifeArea } from "@/lib/types";
import { cn } from "@/lib/utils";

const AREA: Record<LifeArea, { label: string; icon: ReactNode }> = {
  job: { label: "Job", icon: <Briefcase aria-hidden="true" /> },
  content: { label: "Content", icon: <Video aria-hidden="true" /> },
  personal: { label: "Personal", icon: <User aria-hidden="true" /> },
};

/** Life area as a neutral word + icon chip. Never a priority color. */
export function LifeAreaChip({ area }: { area: LifeArea | null }) {
  if (!area) return null;
  return (
    <Badge variant="chip">
      {AREA[area].icon}
      {AREA[area].label}
    </Badge>
  );
}

type TaskRowProps = {
  title: string;
  done: boolean;
  area: LifeArea | null;
  /** "app" or "chat:<name>"; chat sources show as "From Claude". */
  source?: string;
  /** Extra meta, e.g. a time ("07:00") or a washi tag. */
  meta?: ReactNode;
  onToggle: () => void;
  /** Right-side action, e.g. "Do today". */
  action?: ReactNode;
  disabled?: boolean;
};

/** One task: a round check, the plain title, and quiet meta. */
export function TaskRow({ title, done, area, source, meta, onToggle, action, disabled }: TaskRowProps) {
  const who = source && source !== "app" ? sourceLabel(source) : null;
  const from = who ? `From ${who === "An AI chat" ? "an AI chat" : who}` : null;
  return (
    <div className="flex items-start gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/50">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? `Mark “${title}” not done` : `Mark “${title}” done`}
        onClick={onToggle}
        disabled={disabled}
        className={cn(
          // The 28px circle gets a 44px hit area on touch screens.
          "relative mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50 pointer-coarse:size-7 pointer-coarse:after:absolute pointer-coarse:after:-inset-2",
          done ? "border-primary bg-primary text-primary-foreground" : "border-input hover:border-primary",
        )}
      >
        {done ? <Check aria-hidden="true" className="size-3.5 animate-stamp" /> : null}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn("text-[0.9375rem] leading-[1.7] break-words [overflow-wrap:anywhere]", done ? "text-muted-foreground line-through" : "text-foreground")}>
          {title}
        </p>
        {area || from || meta ? (
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[0.8125rem] text-muted-foreground">
            <LifeAreaChip area={area} />
            {meta}
            {from ? <span>{from}</span> : null}
          </div>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

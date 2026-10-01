import { ArrowRight, Lightbulb } from "lucide-react";
import { StageTrack } from "@/components/signature/stage-track";

/**
 * Shown when there are no cards at all. Teaches the flow by showing it: the
 * stage track and one illustrative card (never saved, not interactive).
 */
export function ContentEmptyState() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-2 py-10 text-center animate-enter">
      <div aria-hidden="true" className="grid size-12 place-items-center rounded-full bg-brand-subtle text-brand-subtle-foreground">
        <Lightbulb className="size-5" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="font-heading text-lg font-semibold text-foreground">Start with one specific thought</p>
        <p className="text-sm text-muted-foreground">
          Type it in the box above. Each idea moves along one button at a time — no sorting, no setup.
        </p>
      </div>
      <StageTrack current={null} className="justify-center" />
      <div aria-hidden="true" className="w-full rounded-xl bg-card p-4 text-left shadow-[var(--rim)]">
        <p className="text-[0.8125rem] text-muted-foreground">Example</p>
        <p className="mt-1 font-heading text-[0.9375rem] font-semibold text-foreground">
          Why I stopped planning my week on Sunday
        </p>
        <p className="mt-1 text-sm leading-[1.7] text-muted-foreground">
          Sunday planning made me anxious; a 5-minute Monday check-in works better.
        </p>
        <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-brand-subtle px-3 py-1 text-[0.8125rem] font-semibold text-brand-subtle-foreground">
          Develop this
          <ArrowRight className="size-3.5" />
        </span>
      </div>
    </div>
  );
}

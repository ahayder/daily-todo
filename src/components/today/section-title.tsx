import type { ReactNode, Ref } from "react";

/** A section heading with a quiet hint; focusable when given a ref (focus after actions). */
export function SectionTitle({
  children,
  hint,
  headingRef,
  action,
}: {
  children: string;
  hint?: string;
  headingRef?: Ref<HTMLHeadingElement>;
  /** A small action at the end of the row (e.g. "Edit day plan"). */
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 px-2">
      <h2
        ref={headingRef}
        tabIndex={headingRef ? -1 : undefined}
        className="scroll-mt-4 rounded-md font-heading text-lg font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {children}
      </h2>
      {hint ? <span className="text-[0.8125rem] text-muted-foreground">{hint}</span> : null}
      {action ? <div className="ml-auto self-center">{action}</div> : null}
    </div>
  );
}

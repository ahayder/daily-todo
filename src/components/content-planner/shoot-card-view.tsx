"use client";

import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseShootCard } from "@/lib/content-conveyor";
import { cn } from "@/lib/utils";

const BULLET_RE = /^(\s*)[*\-•]\s+(.*)$/;
const INDENT_CLASS = ["ml-0", "ml-5", "ml-10"] as const;

/** Drop markdown emphasis markers so pasted text reads clean. */
function plain(text: string) {
  return text.replace(/\*\*|__/g, "");
}

/**
 * One part's body as calm reading text: bullet lines get a dot and an indent
 * from their leading spaces, other lines are plain paragraphs.
 */
function PartBody({ body }: { body: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      {body.split(/\r?\n/).map((line, index) => {
        if (!line.trim()) return <span key={index} aria-hidden="true" className="h-2" />;
        const bullet = line.match(BULLET_RE);
        if (!bullet) {
          return (
            <p key={index} className="text-foreground">
              {plain(line.trim())}
            </p>
          );
        }
        const level = Math.min(2, Math.floor(bullet[1].replace(/\t/g, "  ").length / 2));
        return (
          <p key={index} className={cn("relative pl-4 text-foreground", INDENT_CLASS[level])}>
            <span aria-hidden="true" className="absolute top-0 left-0 text-muted-foreground">
              •
            </span>
            {plain(bullet[2])}
          </p>
        );
      })}
    </div>
  );
}

type ShootCardViewProps = {
  labelId: string;
  body: string;
  onEdit: () => void;
};

/**
 * Read-mode Shoot card: each numbered part as a small heading with its text
 * below, easy to glance at while shooting. Part 1 is shown as the intent above,
 * so it is skipped here. Edit switches back to the text box.
 */
export function ShootCardView({ labelId, body, onEdit }: ShootCardViewProps) {
  const parts = parseShootCard(body);
  const hasIntent = parts.some((part) => part.number === 1);
  const shown = hasIntent ? parts.filter((part) => part.number !== 1) : parts;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span id={labelId} className="text-[0.8125rem] font-semibold tracking-wide text-muted-foreground uppercase">
          Shoot card
        </span>
        <Button variant="ghost" size="sm" className="pointer-coarse:h-11 pointer-coarse:px-4" onClick={onEdit}>
          <Pencil aria-hidden="true" />
          Edit
        </Button>
      </div>
      <section
        aria-labelledby={labelId}
        className="flex flex-col gap-4 rounded-xl bg-muted/40 px-4 py-3 text-[1em] leading-[1.7]"
      >
        {shown.map((part, index) => (
          <div key={`${part.number ?? "lead"}-${index}`} className="flex flex-col gap-1">
            {part.number !== null ? (
              <h3 className="font-heading text-[1em] font-bold leading-snug text-foreground">
                <span className="mr-1.5 font-mono text-[0.875em] text-muted-foreground tabular-nums">{part.number}</span>
                {plain(part.heading)}
              </h3>
            ) : null}
            {part.body ? <PartBody body={part.body} /> : null}
          </div>
        ))}
      </section>
    </div>
  );
}

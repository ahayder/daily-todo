"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { ArrowRight, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { getRowSnippet } from "@/lib/content-conveyor";
import type { ContentCard } from "@/lib/types";

type IdeasReviewProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ideas (Inbox) cards in shelf order, read live so edits/deletes show up. */
  ideas: ContentCard[];
  onDevelop: (cardId: string) => void;
  onDelete: (cardId: string) => void;
};

/**
 * One idea at a time, one small decision each: Develop, Keep for later, or
 * Delete (with Undo). The queue is fixed when the review opens so the "left"
 * count only ever goes down.
 */
export function IdeasReview({ open, onOpenChange, ideas, onDevelop, onDelete }: IdeasReviewProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs" />
        <DialogPrimitive.Popup className="fixed inset-x-4 top-1/2 z-50 mx-auto flex max-h-[calc(100dvh-2rem)] w-auto max-w-lg -translate-y-1/2 flex-col gap-4 rounded-2xl bg-popover p-5 text-popover-foreground shadow-card outline-none animate-enter">
          {open ? <ReviewQueue ideas={ideas} onDevelop={onDevelop} onDelete={onDelete} onClose={() => onOpenChange(false)} /> : null}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function ReviewQueue({
  ideas,
  onDevelop,
  onDelete,
  onClose,
}: Omit<IdeasReviewProps, "open" | "onOpenChange"> & { onClose: () => void }) {
  const [queue] = useState(() => ideas.map((card) => card.id));
  const [position, setPosition] = useState(0);
  const byId = new Map(ideas.map((card) => [card.id, card]));

  // Skip cards that left Ideas while the review was open.
  let index = position;
  while (index < queue.length && !byId.has(queue[index])) index += 1;
  const card = index < queue.length ? byId.get(queue[index])! : null;
  const remaining = queue.slice(index).filter((id) => byId.has(id)).length;
  const next = () => setPosition(index + 1);

  return (
    <>
      <div className="flex items-center gap-3">
        <DialogPrimitive.Title className="flex-1 font-heading text-lg font-bold">Review ideas</DialogPrimitive.Title>
        {card ? (
          <span className="font-mono text-[0.8125rem] text-muted-foreground tabular-nums" aria-live="polite">
            {remaining} left
          </span>
        ) : null}
        <IconButton label="Close review" icon={<X />} onClick={onClose} />
      </div>

      {card ? (
        <>
          <DialogPrimitive.Description className="sr-only">
            Decide one idea at a time: develop it, keep it for later, or delete it.
          </DialogPrimitive.Description>
          <div key={card.id} className="flex min-h-0 flex-col gap-2 overflow-y-auto rounded-xl bg-card p-4 animate-enter">
            <p className="font-heading text-[1.125rem] font-semibold leading-snug">{card.title}</p>
            {getRowSnippet(card) ? (
              <p className="text-[0.9375rem] leading-[1.7] whitespace-pre-line text-muted-foreground">{getRowSnippet(card)}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              className="h-10 px-4 pointer-coarse:h-11"
              onClick={() => {
                onDevelop(card.id);
                next();
              }}
            >
              Develop this
              <ArrowRight aria-hidden="true" />
            </Button>
            <Button variant="secondary" className="h-10 pointer-coarse:h-11" onClick={next}>
              Keep for later
            </Button>
            <Button
              variant="ghost"
              className="ml-auto h-10 text-muted-foreground pointer-coarse:h-11"
              onClick={() => {
                onDelete(card.id);
                next();
              }}
            >
              Delete
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-start gap-3">
          <DialogPrimitive.Description className="text-sm text-muted-foreground">
            All caught up. Every idea has a decision for now.
          </DialogPrimitive.Description>
          <Button onClick={onClose}>Done</Button>
        </div>
      )}
    </>
  );
}

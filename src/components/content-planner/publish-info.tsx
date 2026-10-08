"use client";

import { ExternalLink } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type Ref } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CONTENT_PLATFORMS, type ContentCard, type ContentLinks, type ContentPlatform } from "@/lib/types";
import { cn } from "@/lib/utils";

const AUTOSAVE_DELAY_MS = 400;

export const PLATFORM_LABELS: Record<ContentPlatform, string> = {
  youtube: "YouTube",
  facebook: "Facebook",
  tiktok: "TikTok",
  instagram: "Instagram",
  linkedin: "LinkedIn",
};

type PublishDraft = { links: ContentLinks; transcript: string };

function draftFromCard(card: ContentCard): PublishDraft {
  return { links: { ...card.links }, transcript: card.transcript ?? "" };
}

function sameDraft(left: PublishDraft, right: PublishDraft): boolean {
  return (
    left.transcript.trim() === right.transcript.trim() &&
    CONTENT_PLATFORMS.every(
      (platform) => (left.links[platform] ?? "").trim() === (right.links[platform] ?? "").trim(),
    )
  );
}

/** Only real web links get an "open" button. */
function toOpenableUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

type PublishInfoProps = {
  card: ContentCard;
  /** Receives the first link field, so the card can focus it after publishing. */
  firstFieldRef?: Ref<HTMLInputElement>;
  onSave: (cardId: string, links: ContentLinks, transcript: string) => void;
};

/**
 * Where a published video lives (one optional link per platform) and its
 * transcript. Nothing is required. Edits auto-save (debounced) and flush on
 * blur and unmount; outside changes re-seed the fields only while nothing is
 * waiting to save, so a save echo never eats typing.
 */
export function PublishInfo({ card, firstFieldRef, onSave }: PublishInfoProps) {
  const [draft, setDraft] = useState<PublishDraft>(() => draftFromCard(card));
  const [isDirty, setIsDirty] = useState(false);
  const [base, setBase] = useState<PublishDraft>(() => draftFromCard(card));
  const stored = draftFromCard(card);
  if (!isDirty && !sameDraft(base, stored)) {
    setBase(stored);
    setDraft(stored);
  }

  const pendingRef = useRef<PublishDraft | null>(null);
  const timerRef = useRef<number | null>(null);
  const cardIdRef = useRef(card.id);
  const onSaveRef = useRef(onSave);
  useLayoutEffect(() => {
    cardIdRef.current = card.id;
    onSaveRef.current = onSave;
  });

  const flush = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (!pending) return;
    setBase(pending);
    setIsDirty(false);
    onSaveRef.current(cardIdRef.current, pending.links, pending.transcript);
  }, []);

  useEffect(() => flush, [flush]);

  const edit = (next: PublishDraft) => {
    setDraft(next);
    setIsDirty(true);
    pendingRef.current = next;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(flush, AUTOSAVE_DELAY_MS);
  };

  const transcriptId = `card-${card.id}-transcript`;

  return (
    <section aria-labelledby={`card-${card.id}-links-label`} className="mt-6 flex flex-col gap-5 animate-enter">
      <div className="flex flex-col gap-2">
        <h3
          id={`card-${card.id}-links-label`}
          className="text-[0.8125rem] font-semibold tracking-wide text-muted-foreground uppercase"
        >
          Links
        </h3>
        <div className="flex flex-col gap-2">
          {CONTENT_PLATFORMS.map((platform, index) => {
            const id = `card-${card.id}-link-${platform}`;
            const openUrl = toOpenableUrl(draft.links[platform]);
            return (
              <div key={platform} className="flex items-center gap-2">
                <label htmlFor={id} className="w-22 shrink-0 text-sm text-muted-foreground">
                  {PLATFORM_LABELS[platform]}
                </label>
                <input
                  id={id}
                  ref={index === 0 ? firstFieldRef : undefined}
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  value={draft.links[platform] ?? ""}
                  onChange={(event) =>
                    edit({ ...draft, links: { ...draft.links, [platform]: event.target.value } })
                  }
                  onBlur={flush}
                  placeholder="Paste link"
                  className="h-10 min-w-0 flex-1 rounded-xl border border-transparent bg-muted/40 px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground hover:border-input focus-visible:border-ring focus-visible:bg-transparent pointer-coarse:h-11"
                />
                {openUrl ? (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <a
                          href={openUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Open on ${PLATFORM_LABELS[platform]}`}
                          className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "pointer-coarse:size-11")}
                        />
                      }
                    >
                      <ExternalLink aria-hidden="true" />
                    </TooltipTrigger>
                    <TooltipContent>{`Open on ${PLATFORM_LABELS[platform]}`}</TooltipContent>
                  </Tooltip>
                ) : (
                  <span aria-hidden="true" className="size-7 shrink-0 pointer-coarse:size-11" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={transcriptId}
          className="text-[0.8125rem] font-semibold tracking-wide text-muted-foreground uppercase"
        >
          Transcript
        </label>
        <textarea
          id={transcriptId}
          value={draft.transcript}
          onChange={(event) => edit({ ...draft, transcript: event.target.value })}
          onBlur={flush}
          placeholder="Paste the video transcript"
          className="field-sizing-content min-h-24 w-full resize-none rounded-xl border border-transparent bg-muted/40 px-3 py-2.5 text-[1em] leading-[1.7] text-foreground outline-none transition-colors placeholder:text-muted-foreground hover:border-input focus-visible:border-ring focus-visible:bg-transparent"
        />
      </div>
    </section>
  );
}

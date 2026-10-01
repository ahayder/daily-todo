"use client";

import { ArrowLeft, ArrowRight, Check, Copy, MoreHorizontal, Sparkles, Trash2 } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { StageTrack } from "@/components/signature/stage-track";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import {
  buildChatGptClipboard,
  draftToNotes,
  getEditorSections,
  getNextStep,
  getStageForColumn,
  hasChatGptPrompt,
  notesToDraft,
  type CardDraftSections,
  type ConveyorSection,
} from "@/lib/content-conveyor";
import type { ContentCard } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CardMoveItems } from "./content-shelf";
import { SECTION_LABELS, SECTION_PLACEHOLDERS } from "./stage-labels";

const AUTOSAVE_DELAY_MS = 400;

type Draft = { title: string; sections: CardDraftSections };

function draftFromCard(card: ContentCard): Draft {
  return { title: card.title, sections: notesToDraft(card.notes) };
}

export type CardDetailProps = {
  card: ContentCard;
  /** Position of the card within its stage (for Move up / Move to top). */
  index: number;
  /** `pane`: desktop right side. `sheet`: phone full screen with a Back button. */
  layout: "pane" | "sheet";
  /** Section to focus once (e.g. right after "Develop this"). */
  focusSection: ConveyorSection | null;
  onFocusHandled: () => void;
  onBack?: () => void;
  onUpdateCard: (cardId: string, title: string, notes: string) => void;
  onMoveCard: (cardId: string, targetColumnId: string, targetIndex: number) => void;
  onAdvance: (cardId: string, title: string, notes: string) => void;
  onDeleteCard: (cardId: string) => void;
};

/**
 * One card, fully readable and editable in place: the stage track, the title,
 * each conveyor section as its own labelled box, and exactly one next step.
 * Edits auto-save (debounced) and flush on blur, card switch and unmount.
 */
export function CardDetail({
  card,
  index,
  layout,
  focusSection,
  onFocusHandled,
  onBack,
  onUpdateCard,
  onMoveCard,
  onAdvance,
  onDeleteCard,
}: CardDetailProps) {
  const [draft, setDraft] = useState<Draft>(() => draftFromCard(card));
  const [copied, setCopied] = useState<"chatgpt" | "markdown" | null>(null);
  const sectionRefs = useRef<Partial<Record<ConveyorSection, HTMLTextAreaElement | null>>>({});

  const stage = getStageForColumn(card.columnId);
  const nextStep = getNextStep(card.columnId);
  const sections = getEditorSections(card.columnId, card.notes);

  // Autosave plumbing. `pendingRef` holds unsaved edits (`isDirty` mirrors it
  // for rendering); `base` is the stored title/notes the draft corresponds to,
  // including our own last write. A stored card that differs from `base` while
  // nothing is pending is an external change (sync, stage advance) and
  // re-seeds the draft — our own save echo never does, so typing is safe.
  const pendingRef = useRef<Draft | null>(null);
  const timerRef = useRef<number | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [base, setBase] = useState({ title: card.title, notes: card.notes });
  if (!isDirty && (base.title !== card.title || base.notes !== card.notes)) {
    setBase({ title: card.title, notes: card.notes });
    setDraft(draftFromCard(card));
  }
  const cardRef = useRef(card);
  const onUpdateRef = useRef(onUpdateCard);
  useLayoutEffect(() => {
    cardRef.current = card;
    onUpdateRef.current = onUpdateCard;
  });

  const flush = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (!pending) return;
    const current = cardRef.current;
    const title = pending.title.trim() || current.title;
    const notes = draftToNotes(pending.sections, getEditorSections(current.columnId, current.notes));
    setBase({ title, notes });
    setIsDirty(false);
    if (title === current.title && notes === current.notes) return;
    onUpdateRef.current(current.id, title, notes);
  }, []);

  useEffect(() => flush, [flush]);

  const edit = (next: Draft) => {
    setDraft(next);
    setIsDirty(true);
    pendingRef.current = next;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(flush, AUTOSAVE_DELAY_MS);
  };

  useLayoutEffect(() => {
    if (!focusSection) return;
    const target = sectionRefs.current[focusSection];
    if (!target) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "center", behavior: "smooth" });
    onFocusHandled();
  }, [focusSection, onFocusHandled, sections.length]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(null), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const currentNotes = () => draftToNotes(draft.sections, sections);
  const currentTitle = () => draft.title.trim() || card.title;

  const copy = async (kind: "chatgpt" | "markdown") => {
    const title = currentTitle();
    const notes = currentNotes();
    const payload =
      kind === "chatgpt"
        ? buildChatGptClipboard(card.columnId, { title, notes })
        : notes
          ? `${title}\n\n${notes}`
          : title;
    if (!payload) return;
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(kind);
    } catch {
      setCopied(null);
    }
  };

  const advance = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    pendingRef.current = null;
    const title = currentTitle();
    const notes = currentNotes();
    setBase({ title, notes });
    setIsDirty(false);
    onAdvance(card.id, title, notes);
  };

  const isSheet = layout === "sheet";

  return (
    <article
      aria-label={card.title}
      className={cn("flex min-h-0 flex-col", isSheet ? "h-full" : "h-full rounded-2xl bg-card shadow-[var(--rim)]")}
    >
      <header
        className={cn(
          "flex items-center gap-2 border-b border-border px-4 py-3",
          isSheet && "pt-[max(0.75rem,env(safe-area-inset-top))]",
        )}
      >
        {onBack ? <IconButton label="Back to list" icon={<ArrowLeft />} onClick={onBack} /> : null}
        {/* key: re-stamp the current stage when it changes. */}
        {isSheet ? (
          <span className="flex-1" />
        ) : (
          <StageTrack key={stage ?? "none"} current={stage} className="min-w-0 flex-1" />
        )}
        <DropdownMenu>
          <DropdownMenuTrigger render={<IconButton label="Card actions" icon={<MoreHorizontal />} />} />
          <DropdownMenuContent align="end" className="w-52">
            {stage ? <CardMoveItems card={card} stage={stage} index={index} onMoveCard={onMoveCard} /> : null}
            <DropdownMenuItem onClick={() => void copy("markdown")}>
              <Copy aria-hidden="true" />
              Copy as Markdown
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => onDeleteCard(card.id)}>
              <Trash2 aria-hidden="true" />
              Delete card
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-6 sm:px-6">
        {isSheet ? <StageTrack key={stage ?? "none"} current={stage} className="mb-3" /> : null}
        <label htmlFor={`card-title-${card.id}`} className="sr-only">
          Title
        </label>
        <textarea
          id={`card-title-${card.id}`}
          rows={1}
          value={draft.title}
          onChange={(event) => edit({ ...draft, title: event.target.value.replace(/\r?\n/g, " ") })}
          onBlur={flush}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              sectionRefs.current[sections[0]]?.focus();
            }
          }}
          className="field-sizing-content w-full resize-none rounded-lg bg-transparent font-heading text-[1.5625em] font-bold leading-snug text-foreground outline-none focus-visible:bg-muted/50"
        />

        <div className="mt-4 flex flex-col gap-5">
          {sections.map((name) => {
            const id = `card-${card.id}-${name.toLowerCase().replace(/\s+/g, "-")}`;
            return (
              <div key={name} className="flex flex-col gap-1.5 animate-enter">
                <label htmlFor={id} className="text-[0.8125rem] font-semibold tracking-wide text-muted-foreground uppercase">
                  {SECTION_LABELS[name]}
                </label>
                <textarea
                  id={id}
                  ref={(element) => {
                    sectionRefs.current[name] = element;
                  }}
                  value={draft.sections[name] ?? ""}
                  onChange={(event) =>
                    edit({ ...draft, sections: { ...draft.sections, [name]: event.target.value } })
                  }
                  onBlur={flush}
                  placeholder={SECTION_PLACEHOLDERS[name]}
                  className="field-sizing-content min-h-20 w-full resize-none rounded-xl border border-transparent bg-muted/40 px-3 py-2.5 text-[1em] leading-[1.7] text-foreground outline-none transition-colors placeholder:text-muted-foreground hover:border-input focus-visible:border-ring focus-visible:bg-transparent"
                />
              </div>
            );
          })}
        </div>
      </div>

      {nextStep || hasChatGptPrompt(card.columnId) ? (
        <footer
          className={cn(
            "flex flex-wrap items-center gap-2 border-t border-border px-4 py-3 sm:px-6",
            isSheet && "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
          )}
        >
          {nextStep ? (
            <Button className="h-10 px-4 pointer-coarse:h-11" onClick={advance}>
              {nextStep.label}
              <ArrowRight aria-hidden="true" />
            </Button>
          ) : null}
          {hasChatGptPrompt(card.columnId) ? (
            <Button variant="ghost" className="h-10 pointer-coarse:h-11" onClick={() => void copy("chatgpt")}>
              {copied === "chatgpt" ? <Check aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
              {copied === "chatgpt" ? "Copied — paste in ChatGPT" : "Copy for ChatGPT"}
            </Button>
          ) : null}
          {copied === "markdown" ? (
            <span className="text-[0.8125rem] text-muted-foreground" aria-live="polite">
              Copied as Markdown
            </span>
          ) : null}
        </footer>
      ) : copied === "markdown" ? (
        <p className="border-t border-border px-6 py-3 text-[0.8125rem] text-muted-foreground" aria-live="polite">
          Copied as Markdown
        </p>
      ) : null}
    </article>
  );
}

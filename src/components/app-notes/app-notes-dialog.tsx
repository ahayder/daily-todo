"use client";

import { useMemo, useRef, useState, type Dispatch, type KeyboardEvent, type RefObject } from "react";
import { Check, Pencil, RotateCcw, Trash2 } from "lucide-react";

import type { AppAction } from "@/components/app/app-context";
import { SegmentedControl } from "@/components/blocks/segmented-control";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { Textarea } from "@/components/ui/textarea";
import { getVisibleAppNotes } from "@/lib/store";
import type { AppNote, AppNoteKind } from "@/lib/types";
import { cn } from "@/lib/utils";

const KIND_OPTIONS: { value: AppNoteKind; label: string }[] = [
  { value: "idea", label: "Idea" },
  { value: "improvement", label: "Improvement" },
  { value: "bug", label: "Bug" },
];

const KIND_LABEL: Record<AppNoteKind, string> = { idea: "Idea", improvement: "Improvement", bug: "Bug" };

const SCREEN_LABEL: Record<string, string> = {
  todos: "Todos",
  notes: "Notes",
  planner: "Daily Planner",
  "content-planner": "Content Planner",
  today: "Today",
  history: "History",
  chat: "From chat",
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notes: Record<string, AppNote>;
  dispatch: Dispatch<AppAction>;
  /** The view the user is on, saved with each note. */
  screen: string;
  /** True while the app is still connecting and can't save yet. */
  isReadOnly: boolean;
  /** Where focus goes back to on close (what the user was working in). */
  returnFocusRef?: RefObject<HTMLElement | null>;
};

function formatDate(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

/**
 * Quick capture for notes about the app itself, reachable from every screen.
 * Save keeps the box open so several thoughts can go in a row; the list below
 * is for a quick look back. Deleting is a soft delete; Undo shows inside the
 * dialog because a toast would sit under the modal and can't be clicked.
 */
export function AppNotesDialog({ open, onOpenChange, notes, dispatch, screen, isReadOnly, returnFocusRef }: Props) {
  const [text, setText] = useState("");
  const [kind, setKind] = useState<AppNoteKind>("idea");
  const [showDone, setShowDone] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  /** The last done/delete, shown with Undo inside the dialog. */
  const [lastAction, setLastAction] = useState<{ note: AppNote; type: "deleted" | "done" } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const visible = useMemo(() => getVisibleAppNotes(notes), [notes]);
  const doneCount = visible.filter((note) => note.status === "done").length;
  const listed = showDone ? visible : visible.filter((note) => note.status === "open");

  const save = () => {
    if (isReadOnly || !text.trim()) return;
    dispatch({ type: "create-app-note", text, kind, screen });
    setText("");
    setJustSaved(true);
    inputRef.current?.focus();
  };

  // On the whole capture area, so Cmd/Ctrl+Enter still saves after picking a type.
  const handleCaptureKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      save();
    }
  };

  const saveEdit = (noteId: string) => {
    if (editText.trim()) dispatch({ type: "update-app-note", noteId, text: editText });
    setEditingId(null);
  };

  // After a row disappears, keep keyboard focus in the dialog on the capture box.
  const afterRowAction = (note: AppNote, type: "deleted" | "done") => {
    setLastAction({ note, type });
    setJustSaved(false);
    inputRef.current?.focus();
  };

  const remove = (note: AppNote) => {
    dispatch({ type: "delete-app-note", noteId: note.id });
    afterRowAction(note, "deleted");
  };

  const toggleDone = (note: AppNote) => {
    const status = note.status === "done" ? "open" : "done";
    dispatch({ type: "update-app-note", noteId: note.id, status });
    if (status === "done") afterRowAction(note, "done");
  };

  const undoLastAction = () => {
    if (lastAction?.type === "deleted") dispatch({ type: "restore-app-note", noteId: lastAction.note.id });
    if (lastAction?.type === "done") dispatch({ type: "update-app-note", noteId: lastAction.note.id, status: "open" });
    setLastAction(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Esc while editing a note cancels the edit, not the whole dialog.
        if (!next && editingId) {
          setEditingId(null);
          return;
        }
        if (!next) setLastAction(null);
        onOpenChange(next);
      }}
    >
      <DialogContent
        finalFocus={returnFocusRef}
        className="max-h-[calc(100dvh-2rem)] max-w-lg grid-cols-[minmax(0,1fr)] grid-rows-[auto_auto_minmax(0,1fr)]"
      >
        <DialogHeader>
          <DialogTitle>Note for the app</DialogTitle>
          <DialogDescription>
            Jot down an idea, improvement or bug, then get back to work.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3" onKeyDown={handleCaptureKeyDown}>
          <Textarea
            ref={inputRef}
            autoFocus
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setJustSaved(false);
            }}
            placeholder="What should the app do better?"
            aria-label="Note text"
            className="min-h-24"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SegmentedControl label="Note type" options={KIND_OPTIONS} value={kind} onValueChange={setKind} />
            <div className="flex items-center gap-3">
              {justSaved ? (
                <span role="status" className="inline-flex items-center gap-1 text-[0.8125rem] text-success">
                  <Check className="size-3.5" aria-hidden="true" />
                  Saved
                </span>
              ) : null}
              <Button onClick={save} disabled={isReadOnly || !text.trim()}>
                {isReadOnly ? "Connecting…" : "Save note"}
              </Button>
            </div>
          </div>
        </div>

        <section aria-label="Your app notes" className="flex min-h-0 flex-col gap-2 border-t border-border pt-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[0.8125rem] font-semibold text-muted-foreground">
              {listed.length} {showDone ? "notes" : "open"}
            </h3>
            {doneCount > 0 ? (
              <Button variant="ghost" size="sm" onClick={() => setShowDone((value) => !value)}>
                {showDone ? "Hide done" : `Show done (${doneCount})`}
              </Button>
            ) : null}
          </div>

          {lastAction ? (
            <div
              role="status"
              className="flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-1.5 text-[0.8125rem] text-foreground"
            >
              <span>{lastAction.type === "deleted" ? "Note deleted" : "Marked done"}</span>
              <Button variant="ghost" size="sm" onClick={undoLastAction}>
                Undo
              </Button>
            </div>
          ) : null}

          {listed.length === 0 ? (
            <p className="py-4 text-center text-[0.8125rem] text-muted-foreground">
              {doneCount > 0 ? "All caught up, no open notes." : "Nothing here yet. Your notes will show up here."}
            </p>
          ) : (
            <ul className="-mx-1 min-h-0 flex-1 overflow-y-auto">
              {listed.map((note) => (
                <li
                  key={note.id}
                  className="group flex items-start gap-2 rounded-lg px-1 py-2 hover:bg-muted"
                >
                  <span className="mt-0.5 shrink-0 rounded-full bg-muted px-2 py-0.5 text-[0.8125rem] text-muted-foreground group-hover:bg-background">
                    {KIND_LABEL[note.kind]}
                  </span>
                  <div className="min-w-0 flex-1">
                    {editingId === note.id ? (
                      <Textarea
                        autoFocus
                        value={editText}
                        onChange={(event) => setEditText(event.target.value)}
                        onBlur={() => saveEdit(note.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) saveEdit(note.id);
                        }}
                        aria-label="Edit note"
                        className="min-h-16"
                      />
                    ) : (
                      <p
                        className={cn(
                          "whitespace-pre-wrap text-sm text-foreground [overflow-wrap:anywhere]",
                          note.status === "done" && "text-muted-foreground line-through",
                        )}
                      >
                        {note.text}
                      </p>
                    )}
                    <p className="mt-0.5 text-[0.8125rem] text-muted-foreground tabular-nums">
                      {formatDate(note.createdAt)}
                      {note.screen ? ` · ${SCREEN_LABEL[note.screen] ?? note.screen}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                    <IconButton
                      label={note.status === "done" ? "Mark open" : "Mark done"}
                      icon={note.status === "done" ? <RotateCcw /> : <Check />}
                      disabled={isReadOnly}
                      onClick={() => toggleDone(note)}
                    />
                    <IconButton
                      label="Edit"
                      icon={<Pencil />}
                      disabled={isReadOnly}
                      onClick={() => {
                        setEditingId(note.id);
                        setEditText(note.text);
                      }}
                    />
                    <IconButton
                      label="Delete"
                      icon={<Trash2 />}
                      disabled={isReadOnly}
                      onClick={() => remove(note)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}

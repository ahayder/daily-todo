"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";

type SeriesNameDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the trimmed, non-empty name. */
  onCreate: (title: string) => void;
};

/** Name a new series — one field, Enter creates. */
export function SeriesNameDialog({ open, onOpenChange, onCreate }: SeriesNameDialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs" />
        <DialogPrimitive.Popup className="fixed inset-x-4 top-1/2 z-50 mx-auto flex w-auto max-w-md -translate-y-1/2 flex-col gap-4 rounded-2xl bg-popover p-5 text-popover-foreground shadow-card outline-none animate-enter">
          {open ? <NameForm onCreate={onCreate} onClose={() => onOpenChange(false)} /> : null}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function NameForm({ onCreate, onClose }: { onCreate: (title: string) => void; onClose: () => void }) {
  const [value, setValue] = useState("");
  const id = useId();
  const title = value.trim();

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!title) return;
        onCreate(title);
        onClose();
      }}
    >
      <div className="flex items-center gap-3">
        <DialogPrimitive.Title className="flex-1 font-heading text-lg font-bold">New series</DialogPrimitive.Title>
        <IconButton label="Close" icon={<X />} onClick={onClose} />
      </div>
      <DialogPrimitive.Description className="sr-only">
        Give the series a name. You can add what it is about later.
      </DialogPrimitive.Description>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-[0.8125rem] font-semibold text-muted-foreground">
          Name
        </label>
        <input
          id={id}
          autoFocus
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="e.g. Money basics"
          autoComplete="off"
          className="h-10 rounded-lg border border-input bg-background px-3 text-[0.9375rem] text-foreground outline-none placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:h-11"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" className="h-10 pointer-coarse:h-11" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" className="h-10 px-4 pointer-coarse:h-11" disabled={!title}>
          Create series
        </Button>
      </div>
    </form>
  );
}

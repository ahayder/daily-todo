"use client";

import type { ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** e.g. `Delete "Weekly review"?` — name the thing. */
  title: ReactNode;
  /** One sentence on the consequence, e.g. "Its 4 notes will be deleted too." */
  description: ReactNode;
  /** Verb + noun, e.g. "Delete folder". Never "OK" / "Yes". */
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
};

/**
 * Confirmation for big, hard-to-undo deletes (workspace, folder, note, column).
 * Small recoverable deletes (a todo, a card) act instantly with an Undo toast instead.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-popover text-popover-foreground shadow-card">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-heading text-lg leading-tight font-semibold">{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="pointer-coarse:h-11">{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            className="pointer-coarse:h-11"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

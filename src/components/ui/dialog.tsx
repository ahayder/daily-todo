"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function Dialog(props: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogPortal(props: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogOverlay({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/20 duration-150 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 motion-reduce:duration-0",
        className,
      )}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  ...props
}: DialogPrimitive.Popup.Props) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 gap-4 rounded-2xl border border-[var(--line)] bg-[var(--paper-strong)] p-5 text-[var(--ink-900)] shadow-[var(--surface-shadow)] outline-none duration-150 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 motion-reduce:duration-0",
          className,
        )}
        {...props}
      >
        {children}
        <Tooltip>
          <TooltipTrigger
            aria-label="Close dialog"
            className="absolute top-4 right-4 inline-flex size-8 items-center justify-center rounded-lg text-[var(--ink-700)] transition-colors duration-150 hover:bg-[var(--paper)] hover:text-[var(--ink-900)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
            render={<DialogPrimitive.Close />}
          >
            <X className="size-4" />
          </TooltipTrigger>
          <TooltipContent side="left" className="text-xs">
            Close
          </TooltipContent>
        </Tooltip>
      </DialogPrimitive.Popup>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("grid gap-1.5 pr-10", className)} {...props} />;
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 border-t border-[var(--line)] pt-4 sm:flex-row sm:justify-between",
        className,
      )}
      {...props}
    />
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      className={cn("text-lg font-semibold text-[var(--ink-900)]", className)}
      {...props}
    />
  );
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      className={cn("text-sm text-[var(--ink-700)]", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
};

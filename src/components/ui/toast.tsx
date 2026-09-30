"use client"

// Adapted from the shadcn base-nova toast (Base UI Toast): local `cn`, lucide icons,
// and motion capped at 220ms per .design/DESIGN.md.
import * as React from "react"
import { Toast as ToastPrimitive } from "@base-ui/react/toast"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** App-wide toast manager. Prefer `showUndoToast` for deletes; `toast.add(...)` for anything else. */
const toast = ToastPrimitive.createToastManager()

/** Long enough to notice and reach Undo without rushing (ADHD-friendly). */
const UNDO_TOAST_TIMEOUT_MS = 8000

/**
 * The standard "act instantly, offer Undo" toast for small recoverable deletes (a todo, a card).
 * `onUndo` must restore the exact item and position; the toast closes itself after Undo.
 */
function showUndoToast({ title, onUndo }: { title: string; onUndo: () => void }) {
  const id = toast.add({
    title,
    timeout: UNDO_TOAST_TIMEOUT_MS,
    actionProps: {
      children: "Undo",
      onClick: () => {
        onUndo()
        toast.close(id)
      },
    },
  })
  return id
}

function ToastViewport({ className, ...props }: ToastPrimitive.Viewport.Props) {
  return (
    <ToastPrimitive.Viewport
      data-slot="toast-viewport"
      className={cn(
        "pointer-events-none fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 mx-auto w-auto max-w-sm outline-none sm:right-4 sm:left-auto sm:mx-0 sm:w-full",
        className
      )}
      {...props}
    />
  )
}

function Toast({ className, ...props }: ToastPrimitive.Root.Props) {
  return (
    <ToastPrimitive.Root
      data-slot="toast"
      className={cn(
        "group/toast pointer-events-auto absolute right-0 bottom-0 z-[calc(1000-var(--toast-index))] w-full origin-bottom rounded-full bg-foreground text-background shadow-card will-change-transform outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring",
        "[--gap:0.75rem] [--height:var(--toast-frontmost-height,var(--toast-height))] [--offset-y:calc(var(--toast-offset-y)*-1+calc(var(--toast-index)*var(--gap)*-1)+var(--toast-swipe-movement-y))] [--peek:0.75rem] [--scale:calc(max(0,1-(var(--toast-index)*0.1)))] [--shrink:calc(1-var(--scale))]",
        "h-(--height) [transform:translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)-(var(--toast-index)*var(--peek))-(var(--shrink)*var(--height))))_scale(var(--scale))] [transition:transform_220ms_var(--ease-ui),opacity_220ms,height_160ms] motion-reduce:[transition:opacity_160ms]",
        "after:absolute after:top-full after:left-0 after:h-[calc(var(--gap)+1px)] after:w-full after:content-['']",
        "data-expanded:h-(--toast-height) data-expanded:[transform:translateX(var(--toast-swipe-movement-x))_translateY(var(--offset-y))]",
        "data-limited:opacity-0 data-starting-style:opacity-0 data-starting-style:[transform:translateY(150%)]",
        "data-ending-style:opacity-0 [&[data-ending-style]:not([data-limited]):not([data-swipe-direction])]:[transform:translateY(150%)]",
        "data-ending-style:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y)+150%))]",
        "data-ending-style:data-[swipe-direction=left]:[transform:translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--offset-y))]",
        "data-ending-style:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))]",
        className
      )}
      {...props}
    />
  )
}

function ToastContent({ className, ...props }: ToastPrimitive.Content.Props) {
  return (
    <ToastPrimitive.Content
      data-slot="toast-content"
      className={cn(
        "flex h-full items-center gap-2 overflow-hidden py-1.5 pr-1.5 pl-4 transition-opacity data-behind:opacity-0 data-expanded:opacity-100",
        className
      )}
      {...props}
    />
  )
}

function ToastTitle({ className, ...props }: ToastPrimitive.Title.Props) {
  return (
    <ToastPrimitive.Title
      data-slot="toast-title"
      className={cn("text-sm font-medium", className)}
      {...props}
    />
  )
}

function ToastDescription({ className, ...props }: ToastPrimitive.Description.Props) {
  return (
    <ToastPrimitive.Description
      data-slot="toast-description"
      className={cn("text-sm text-background/75", className)}
      {...props}
    />
  )
}

function ToastAction({
  className,
  render = <Button variant="secondary" />,
  ...props
}: ToastPrimitive.Action.Props) {
  return (
    <ToastPrimitive.Action
      data-slot="toast-action"
      render={render}
      className={cn(
        "shrink-0 bg-[color-mix(in_oklch,var(--background)_18%,var(--foreground))] font-semibold text-background hover:bg-[color-mix(in_oklch,var(--background)_28%,var(--foreground))] hover:text-background pointer-coarse:h-11",
        className
      )}
      {...props}
    />
  )
}

function ToastClose({
  className,
  children,
  render = <Button variant="secondary" size="icon" />,
  ...props
}: ToastPrimitive.Close.Props) {
  return (
    <ToastPrimitive.Close
      data-slot="toast-close"
      aria-label="Dismiss"
      render={render}
      className={cn(
        "shrink-0 bg-transparent text-background/70 hover:bg-[color-mix(in_oklch,var(--background)_18%,var(--foreground))] hover:text-background pointer-coarse:size-11",
        className
      )}
      {...props}
    >
      {children ?? <XIcon aria-hidden="true" />}
    </ToastPrimitive.Close>
  )
}

function ToastIcon({ type }: { type: string | undefined }) {
  const icon =
    type === "success" ? (
      <CircleCheckIcon className="text-success" aria-hidden="true" />
    ) : type === "info" ? (
      <InfoIcon className="text-info" aria-hidden="true" />
    ) : type === "warning" || type === "error" ? (
      <TriangleAlertIcon className="text-destructive" aria-hidden="true" />
    ) : null

  if (!icon) return null

  return (
    <span data-slot="toast-icon" className="shrink-0 [&_svg:not([class*='size-'])]:size-4">
      {icon}
    </span>
  )
}

function ToastList() {
  const { toasts } = ToastPrimitive.useToastManager()

  return toasts.map((toastItem) => (
    <Toast key={toastItem.id} toast={toastItem}>
      <ToastContent>
        <ToastIcon type={toastItem.type} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <ToastTitle />
          <ToastDescription />
        </div>
        <ToastAction />
        <ToastClose />
      </ToastContent>
    </Toast>
  ))
}

/** Mount once near the app root. */
function Toaster({ children, toastManager = toast, ...props }: ToastPrimitive.Provider.Props) {
  return (
    <ToastPrimitive.Provider toastManager={toastManager} {...props}>
      {children}
      <ToastPrimitive.Portal data-slot="toast-portal">
        <ToastViewport>
          <ToastList />
        </ToastViewport>
      </ToastPrimitive.Portal>
    </ToastPrimitive.Provider>
  )
}

const useToastManager = ToastPrimitive.useToastManager

export { Toaster, showUndoToast, toast, useToastManager }

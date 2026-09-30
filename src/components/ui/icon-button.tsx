"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

type IconButtonProps = Omit<React.ComponentProps<typeof Button>, "aria-label" | "children" | "size"> & {
  /** Accessible name and tooltip text. Required: icon-only buttons are unlabeled otherwise. */
  label: string
  icon: React.ReactNode
  size?: "icon-xs" | "icon-sm" | "icon" | "icon-lg"
  tooltipSide?: "top" | "right" | "bottom" | "left"
}

/** Icon-only button with a built-in tooltip and aria-label. Default variant: ghost. */
function IconButton({
  label,
  icon,
  variant = "ghost",
  size = "icon-sm",
  tooltipSide = "top",
  className,
  ...props
}: IconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant={variant}
            size={size}
            aria-label={label}
            className={cn("pointer-coarse:size-11", className)}
            {...props}
          />
        }
      >
        {icon}
      </TooltipTrigger>
      <TooltipContent side={tooltipSide}>{label}</TooltipContent>
    </Tooltip>
  )
}

export { IconButton }
export type { IconButtonProps }

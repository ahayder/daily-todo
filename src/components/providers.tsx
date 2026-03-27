"use client";

import type { ReactNode } from "react";
import { AppProvider } from "@/components/app-context";
import { DesktopUpdateProvider } from "@/components/desktop-update-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider>
      <DesktopUpdateProvider>
        <AppProvider>{children}</AppProvider>
      </DesktopUpdateProvider>
    </TooltipProvider>
  );
}

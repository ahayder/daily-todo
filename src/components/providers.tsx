"use client";

import type { ReactNode } from "react";
import { AppProvider } from "@/components/app-context";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider>
      <AppProvider>{children}</AppProvider>
    </TooltipProvider>
  );
}

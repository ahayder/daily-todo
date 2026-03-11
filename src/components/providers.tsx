"use client";

import type { ReactNode } from "react";
import { AppProvider } from "@/components/app-context";

export function Providers({ children }: { children: ReactNode }) {
  return <AppProvider>{children}</AppProvider>;
}

"use client";

import { useMemo, type ReactNode } from "react";
import { AuthProvider } from "@/components/auth-context";
import { AppProvider } from "@/components/app-context";
import { DesktopUpdateProvider } from "@/components/desktop-update-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { AuthRepository } from "@/lib/auth";
import type { PersistenceRepository } from "@/lib/persistence";
import { createPocketBaseAuthRepository } from "@/lib/pocketbase/auth-repository";
import { createPocketBasePersistenceRepository } from "@/lib/pocketbase/persistence-repository";

export function Providers({
  children,
  authRepository,
  persistenceRepository,
}: {
  children: ReactNode;
  authRepository?: AuthRepository;
  persistenceRepository?: PersistenceRepository;
}) {
  const resolvedAuthRepository = useMemo(
    () => authRepository ?? createPocketBaseAuthRepository(),
    [authRepository],
  );
  const resolvedPersistenceRepository = useMemo(
    () => persistenceRepository ?? createPocketBasePersistenceRepository(),
    [persistenceRepository],
  );

  return (
    <TooltipProvider>
      <DesktopUpdateProvider>
        <AuthProvider repository={resolvedAuthRepository}>
          <AppProvider repository={resolvedPersistenceRepository}>{children}</AppProvider>
        </AuthProvider>
      </DesktopUpdateProvider>
    </TooltipProvider>
  );
}

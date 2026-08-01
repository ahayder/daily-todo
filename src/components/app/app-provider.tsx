"use client";

import { createContext, useContext } from "react";
import { usePathname } from "next/navigation";
import { AuthGate } from "@/components/auth/auth-gate";
import { useAuth } from "@/components/auth/auth-context";
import { VerificationPendingScreen } from "@/components/auth/verification-pending-screen";
import {
  ensureSelectedDailyDate,
  ensureSelectedNoteFolderId,
  ensureSelectedNoteId,
  ensureSelectedPlannerPresetId,
} from "./app-context.reducer";
import type { AppContextValue, AppProviderProps } from "./app-context.types";
import { useAppPersistenceState } from "./use-app-persistence-state";

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children, repository }: AppProviderProps) {
  const { session, status: authStatus } = useAuth();
  const pathname = usePathname();
  const { state, value } = useAppPersistenceState({
    authStatus,
    repository,
    session,
  });

  const isPublicAuthRoute = pathname.startsWith("/auth/reset");

  if (isPublicAuthRoute) {
    return children;
  }

  if (authStatus === "loading") {
    return <AppLoadingScreen label="Restoring your workspace" />;
  }

  if (authStatus === "verification-pending") {
    return <VerificationPendingScreen />;
  }

  if (authStatus === "anonymous") {
    return <AuthGate />;
  }

  if (!state || !value) {
    return <AppLoadingScreen label="Loading your notes and todos" />;
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppState(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppState must be used within AppProvider");
  }

  const selectedDailyDate = ensureSelectedDailyDate(context.state);
  const selectedNoteId = ensureSelectedNoteId(context.state);
  const selectedNoteFolderId = ensureSelectedNoteFolderId(context.state);
  const selectedPlannerPresetId = ensureSelectedPlannerPresetId(context.state);

  if (
    context.state.uiState.selectedDailyDate !== selectedDailyDate ||
    context.state.uiState.selectedNoteId !== selectedNoteId ||
    context.state.uiState.selectedNoteFolderId !== selectedNoteFolderId ||
    context.state.uiState.selectedPlannerPresetId !== selectedPlannerPresetId
  ) {
    return {
      ...context,
      state: {
        ...context.state,
        uiState: {
          ...context.state.uiState,
          selectedDailyDate,
          selectedNoteId,
          selectedNoteFolderId,
          selectedPlannerPresetId,
        },
      },
    };
  }

  return context;
}

function AppLoadingScreen({ label }: { label: string }) {
  return (
    <main className="auth-screen">
      <section className="auth-card auth-card--loading">
        <div className="app-logo auth-card__logo" aria-hidden="true" />
        <p className="auth-card__eyebrow">DailyTodo</p>
        <h1 className="auth-card__title">{label}</h1>
      </section>
    </main>
  );
}

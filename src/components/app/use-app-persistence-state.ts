"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
} from "react";
import type { AuthSession, AuthStatus } from "@/lib/auth";
import {
  createPersistenceMetadata,
  seedAppState,
  type PersistenceMetadata,
  type PersistenceRepository,
  type PersistenceStatus,
} from "@/lib/persistence";
import { isDevelopmentWorkspaceSession } from "@/lib/dev-mode";
import type { AppState, NoteBodyStatus } from "@/lib/types";
import { appReducer, loadDevelopmentWorkspaceState, saveDevelopmentWorkspaceState, serializeStateForSync } from "./app-context.reducer";
import type { AppAction, AppContextValue } from "./app-context.types";

const WORKSPACE_REMOTE_SAVE_DEBOUNCE_MS = 3000;
const NOTE_BODY_REMOTE_SAVE_DEBOUNCE_MS = 5000;
const REMOTE_SAVE_THROTTLE_MS = 10000;

type UseAppPersistenceStateArgs = {
  authStatus: AuthStatus;
  repository: PersistenceRepository;
  session: AuthSession | null;
};

export function useAppPersistenceState({
  authStatus,
  repository,
  session,
}: UseAppPersistenceStateArgs) {
  const [state, setState] = useState<AppState | null>(null);
  const saveSnapshotRef = useRef<string | null>(null);
  const metadataRef = useRef<PersistenceMetadata>(createPersistenceMetadata());
  const dirtySnapshotRef = useRef<string | null>(null);
  const latestStateRef = useRef<AppState | null>(null);
  const lastAuthenticatedUserIdRef = useRef<string | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const lastRemoteSaveStartedAtRef = useRef<number | null>(null);
  const remoteSaveInFlightRef = useRef(false);
  const saveAfterCurrentRef = useRef(false);
  const themeMode = state?.uiState.themeMode;
  const [syncStatus, setSyncStatus] = useState<PersistenceStatus>("idle");
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [persistenceAvailable, setPersistenceAvailable] = useState(true);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [hasUnsyncedChanges, setHasUnsyncedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSyncIssue, setHasSyncIssue] = useState(false);
  const noteBodySaveTimerRef = useRef<number | null>(null);
  const noteBodySnapshotRef = useRef<Record<string, string>>({});
  const [selectedBodyStatus, setSelectedBodyStatus] = useState<NoteBodyStatus>("idle");
  const [selectedBodyNotice, setSelectedBodyNotice] = useState<string | null>(null);
  const [selectedBodyError, setSelectedBodyError] = useState<string | null>(null);

  const dispatch = useMemo<Dispatch<AppAction>>(
    () => (action) => {
      setState((current) => (current ? appReducer(current, action) : current));
    },
    [],
  );

  useEffect(() => {
    latestStateRef.current = state;
  }, [state]);

  const clearSaveTimer = useCallback(() => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  }, []);

  const clearNoteBodySaveTimer = useCallback(() => {
    if (noteBodySaveTimerRef.current !== null) {
      window.clearTimeout(noteBodySaveTimerRef.current);
      noteBodySaveTimerRef.current = null;
    }
  }, []);

  const applySaveOutcome = useCallback(
    (
      result:
        | {
            status: PersistenceStatus;
            metadata: PersistenceMetadata;
            notice: string | null;
            errorMessage: string | null;
            resolvedState?: AppState;
          }
        | null,
      attemptedSnapshot: string,
    ) => {
      if (result) {
        metadataRef.current = result.metadata;
        setSyncStatus(result.status);
        setSyncNotice(result.notice);
        setSyncError(result.errorMessage);
        setPersistenceAvailable(true);

        if (result.status === "synced") {
          setHasSyncIssue(false);
          setLastSavedAt(result.metadata.lastRemoteUpdatedAt ?? result.metadata.lastLocalMutationAt);
          setLastSyncedAt(result.metadata.lastRemoteUpdatedAt);

          const successfulSnapshot = result.resolvedState
            ? serializeStateForSync(result.resolvedState)
            : attemptedSnapshot;
          saveSnapshotRef.current = successfulSnapshot;

          if (result.resolvedState && dirtySnapshotRef.current === attemptedSnapshot) {
            latestStateRef.current = result.resolvedState;
            setState(result.resolvedState);
          }

          if (dirtySnapshotRef.current === attemptedSnapshot) {
            dirtySnapshotRef.current = null;
            setHasPendingChanges(false);
            setHasUnsyncedChanges(false);
          } else {
            setHasPendingChanges(Boolean(dirtySnapshotRef.current));
            setHasUnsyncedChanges(Boolean(dirtySnapshotRef.current));
          }

          return;
        }

        setHasSyncIssue(result.status === "error");
        setLastSavedAt(result.metadata.lastRemoteUpdatedAt ?? result.metadata.lastLocalMutationAt);
        setHasPendingChanges(Boolean(dirtySnapshotRef.current));
        setHasUnsyncedChanges(Boolean(dirtySnapshotRef.current) || result.status === "offline");
        return;
      }

      setSyncStatus("error");
      setSyncNotice("Your latest changes are still available on this device.");
      setSyncError("We couldn’t sync right now.");
      setHasSyncIssue(false);
      setHasPendingChanges(Boolean(dirtySnapshotRef.current));
      setHasUnsyncedChanges(Boolean(dirtySnapshotRef.current));
    },
    [],
  );

  const flushLatestState = useCallback(
    async ({
      forceCurrentState = false,
      bypassThrottle = false,
    }: { forceCurrentState?: boolean; bypassThrottle?: boolean } = {}) => {
      if (!session || authStatus !== "authenticated") {
        return;
      }

      const currentState = latestStateRef.current;
      if (!currentState) {
        return;
      }

      const currentSnapshot = serializeStateForSync(currentState);
      const attemptedSnapshot = dirtySnapshotRef.current ?? (forceCurrentState ? currentSnapshot : null);

      if (!attemptedSnapshot) {
        setIsSaving(false);
        return;
      }

      if (isDevelopmentWorkspaceSession(session)) {
        saveDevelopmentWorkspaceState(currentState);
        saveSnapshotRef.current = attemptedSnapshot;
        dirtySnapshotRef.current = null;
        metadataRef.current = createPersistenceMetadata({
          ...metadataRef.current,
          lastLocalMutationAt: new Date().toISOString(),
        });
        setHasPendingChanges(false);
        setHasUnsyncedChanges(false);
        setHasSyncIssue(false);
        setIsSaving(false);
        setSyncStatus("synced");
        setSyncNotice("Development workspace is active. Changes stay on this device.");
        setSyncError(null);
        setLastSavedAt(metadataRef.current.lastLocalMutationAt);
        setLastSyncedAt(null);
        return;
      }

      if (remoteSaveInFlightRef.current) {
        saveAfterCurrentRef.current = true;
        return;
      }

      if (!bypassThrottle) {
        const lastRemoteSaveStartedAt = lastRemoteSaveStartedAtRef.current;
        if (lastRemoteSaveStartedAt !== null) {
          const remainingThrottleMs =
            REMOTE_SAVE_THROTTLE_MS - (Date.now() - lastRemoteSaveStartedAt);

          if (remainingThrottleMs > 0) {
            clearSaveTimer();
            setIsSaving(true);
            saveTimerRef.current = window.setTimeout(() => {
              saveTimerRef.current = null;
              void flushLatestState();
            }, remainingThrottleMs);
            return;
          }
        }
      }

      remoteSaveInFlightRef.current = true;
      lastRemoteSaveStartedAtRef.current = Date.now();
      setIsSaving(true);
      setSyncStatus("syncing");
      setSyncNotice("Saving your latest changes to PocketBase.");
      setSyncError(null);

      try {
        const result = await repository.save({
          userId: session.userId,
          state: currentState,
          baseMetadata: metadataRef.current,
          now: new Date(),
        });

        applySaveOutcome(result, attemptedSnapshot);
      } catch {
        applySaveOutcome(null, attemptedSnapshot);
      } finally {
        remoteSaveInFlightRef.current = false;

        if (saveAfterCurrentRef.current) {
          saveAfterCurrentRef.current = false;
          void flushLatestState();
          return;
        }

        setIsSaving(false);
      }
    },
    [applySaveOutcome, authStatus, clearSaveTimer, repository, session],
  );

  const queueSave = useCallback(
    (delayMs: number) => {
      clearSaveTimer();
      setIsSaving(true);
      saveTimerRef.current = window.setTimeout(() => {
        saveTimerRef.current = null;
        void flushLatestState();
      }, delayMs);
    },
    [clearSaveTimer, flushLatestState],
  );

  useEffect(() => {
    if (session?.userId) {
      lastAuthenticatedUserIdRef.current = session.userId;
    }
  }, [session?.userId]);

  useEffect(() => {
    if (authStatus !== "authenticated" || !session) {
      if (authStatus === "anonymous" && lastAuthenticatedUserIdRef.current) {
        void repository.clearUserData({ userId: lastAuthenticatedUserIdRef.current });
        lastAuthenticatedUserIdRef.current = null;
      }

      saveSnapshotRef.current = null;
      dirtySnapshotRef.current = null;
      latestStateRef.current = null;
      clearSaveTimer();
      clearNoteBodySaveTimer();
      lastRemoteSaveStartedAtRef.current = null;
      remoteSaveInFlightRef.current = false;
      saveAfterCurrentRef.current = false;
      noteBodySnapshotRef.current = {};
      metadataRef.current = createPersistenceMetadata();
      startTransition(() => {
        setState(null);
        setSyncStatus("idle");
        setSyncNotice(null);
        setSyncError(null);
        setLastSavedAt(null);
        setLastSyncedAt(null);
        setPersistenceAvailable(true);
        setHasPendingChanges(false);
        setHasUnsyncedChanges(false);
        setIsSaving(false);
        setHasSyncIssue(false);
        setSelectedBodyStatus("idle");
        setSelectedBodyNotice(null);
        setSelectedBodyError(null);
      });
      return;
    }

    if (isDevelopmentWorkspaceSession(session)) {
      const devState = loadDevelopmentWorkspaceState();
      const snapshot = serializeStateForSync(devState);
      saveSnapshotRef.current = snapshot;
      dirtySnapshotRef.current = null;
      metadataRef.current = createPersistenceMetadata({
        lastLocalMutationAt: new Date().toISOString(),
      });
      startTransition(() => {
        setHasPendingChanges(false);
        setHasUnsyncedChanges(false);
        setIsSaving(false);
        setHasSyncIssue(false);
        setState(devState);
        setSyncStatus("synced");
        setSyncNotice("Development workspace is active. Changes stay on this device.");
        setSyncError(null);
        setLastSavedAt(metadataRef.current.lastLocalMutationAt);
        setLastSyncedAt(null);
        setPersistenceAvailable(true);
        setSelectedBodyStatus("idle");
        setSelectedBodyNotice(null);
        setSelectedBodyError(null);
      });
      return;
    }

    let mounted = true;

    const hydrate = async () => {
      try {
        setSyncStatus("loading");
        await repository.evictExpiredCachedBodies({ userId: session.userId, now: new Date() });
        const result = await repository.load({
          userId: session.userId,
          now: new Date(),
          onRemoteSync: (remoteResult) => {
            if (!mounted) {
              return;
            }

            const snapshot = serializeStateForSync(remoteResult.state);
            saveSnapshotRef.current = snapshot;
            dirtySnapshotRef.current = null;
            setHasPendingChanges(false);
            setHasUnsyncedChanges(remoteResult.status !== "synced");
            setIsSaving(false);
            setHasSyncIssue(remoteResult.status === "error");
            metadataRef.current = remoteResult.metadata;
            setState(remoteResult.state);
            setSyncStatus(remoteResult.status);
            setSyncNotice(remoteResult.notice);
            setSyncError(remoteResult.errorMessage);
            setLastSavedAt(
              remoteResult.metadata.lastRemoteUpdatedAt ?? remoteResult.metadata.lastLocalMutationAt,
            );
            setLastSyncedAt(remoteResult.metadata.lastRemoteUpdatedAt);
            setPersistenceAvailable(remoteResult.persistenceAvailable);
          },
        });
        if (!mounted) {
          return;
        }

        const snapshot = serializeStateForSync(result.state);
        saveSnapshotRef.current = snapshot;
        dirtySnapshotRef.current = null;
        setHasPendingChanges(false);
        setHasUnsyncedChanges(result.status !== "synced");
        setIsSaving(false);
        setHasSyncIssue(result.status === "error");
        metadataRef.current = result.metadata;
        setState(result.state);
        setSyncStatus(result.status);
        setSyncNotice(result.notice);
        setSyncError(result.errorMessage);
        setLastSavedAt(result.metadata.lastRemoteUpdatedAt ?? result.metadata.lastLocalMutationAt);
        setLastSyncedAt(result.metadata.lastRemoteUpdatedAt);
        setPersistenceAvailable(result.persistenceAvailable);
      } catch {
        if (!mounted) {
          return;
        }

        setState(seedAppState(new Date()));
        setSyncStatus("error");
        setSyncNotice("We couldn’t restore your last synced workspace.");
        setSyncError("We couldn’t restore your workspace.");
        setLastSavedAt(null);
        setHasSyncIssue(true);
        setHasUnsyncedChanges(false);
        setIsSaving(false);
      }
    };

    void hydrate();

    return () => {
      mounted = false;
    };
  }, [authStatus, clearNoteBodySaveTimer, clearSaveTimer, repository, session]);

  const selectedNoteId = state?.uiState.selectedNoteId ?? null;
  const selectedNote = selectedNoteId ? state?.notesDocs[selectedNoteId] ?? null : null;

  useEffect(() => {
    if (!session || authStatus !== "authenticated" || !selectedNoteId || !selectedNote) {
      setSelectedBodyStatus("idle");
      setSelectedBodyNotice(null);
      setSelectedBodyError(null);
      return;
    }

    if (typeof selectedNote.markdown === "string") {
      noteBodySnapshotRef.current[selectedNoteId] ??= selectedNote.markdown;
      setSelectedBodyStatus("ready");
      setSelectedBodyNotice(null);
      setSelectedBodyError(null);
      return;
    }

    let cancelled = false;
    setSelectedBodyStatus("loading");
    setSelectedBodyNotice(null);
    setSelectedBodyError(null);

    void repository
      .loadNoteBody({
        userId: session.userId,
        noteId: selectedNoteId,
        now: new Date(),
      })
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (result.markdown !== null) {
          const loadedMarkdown = result.markdown;
          noteBodySnapshotRef.current[selectedNoteId] = loadedMarkdown;
          setState((current) => {
            if (!current?.notesDocs[selectedNoteId]) {
              return current;
            }

            return {
              ...current,
              notesDocs: {
                ...current.notesDocs,
                [selectedNoteId]: {
                  ...current.notesDocs[selectedNoteId],
                  markdown: loadedMarkdown,
                  updatedAt: result.updatedAtClient ?? current.notesDocs[selectedNoteId].updatedAt,
                },
              },
            };
          });
        }

        setSelectedBodyStatus(result.status === "error" ? "error" : result.status);
        setSelectedBodyNotice(result.notice);
        setSelectedBodyError(result.errorMessage);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setSelectedBodyStatus("error");
        setSelectedBodyNotice(null);
        setSelectedBodyError("We couldn’t load this note right now.");
      });

    return () => {
      cancelled = true;
    };
  }, [authStatus, repository, selectedNote, selectedNoteId, session]);

  useEffect(() => {
    if (
      !session ||
      authStatus !== "authenticated" ||
      !selectedNoteId ||
      !selectedNote ||
      typeof selectedNote.markdown !== "string"
    ) {
      clearNoteBodySaveTimer();
      return;
    }

    const previousMarkdown = noteBodySnapshotRef.current[selectedNoteId];
    if (previousMarkdown === selectedNote.markdown) {
      return;
    }

    void repository.primeRecentNoteCache({
      userId: session.userId,
      noteBodies: [
        {
          noteId: selectedNoteId,
          markdown: selectedNote.markdown,
          updatedAtClient: selectedNote.updatedAt,
        },
      ],
      now: new Date(),
    });

    clearNoteBodySaveTimer();
    noteBodySaveTimerRef.current = window.setTimeout(() => {
      noteBodySaveTimerRef.current = null;
      void repository
        .saveNoteBody({
          userId: session.userId,
          noteId: selectedNoteId,
          markdown: selectedNote.markdown ?? "",
          updatedAtClient: selectedNote.updatedAt,
          now: new Date(),
        })
        .then((result) => {
          noteBodySnapshotRef.current[selectedNoteId] = result.markdown;
          setSelectedBodyStatus(result.status === "offline" ? "stale-offline" : "ready");
          setSelectedBodyNotice(result.notice);
          setSelectedBodyError(result.errorMessage);
        })
        .catch(() => {
          setSelectedBodyStatus("error");
          setSelectedBodyNotice(null);
          setSelectedBodyError("We couldn’t save this note right now.");
        });
    }, NOTE_BODY_REMOTE_SAVE_DEBOUNCE_MS);

    return clearNoteBodySaveTimer;
  }, [authStatus, clearNoteBodySaveTimer, repository, selectedNote, selectedNoteId, session]);

  useLayoutEffect(() => {
    if (typeof window === "undefined" || !state) {
      return;
    }

    const root = document.documentElement;
    const query = window.matchMedia("(prefers-color-scheme: dark)");

    const applyDarkState = (isDark: boolean) => {
      root.classList.toggle("dark", isDark);
      root.style.colorScheme = isDark ? "dark" : "light";
    };

    if (state.uiState.themeMode === "dark") {
      applyDarkState(true);
      return;
    }

    if (state.uiState.themeMode === "light") {
      applyDarkState(false);
      return;
    }

    applyDarkState(query.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      applyDarkState(event.matches);
    };

    query.addEventListener("change", handleChange);
    return () => {
      query.removeEventListener("change", handleChange);
    };
  }, [state, themeMode]);

  useEffect(() => {
    if (!session || !state || authStatus !== "authenticated") {
      return;
    }

    const nextSnapshot = serializeStateForSync(state);
    if (nextSnapshot === saveSnapshotRef.current) {
      dirtySnapshotRef.current = null;
      return;
    }

    if (isDevelopmentWorkspaceSession(session)) {
      dirtySnapshotRef.current = nextSnapshot;
      startTransition(() => {
        setHasPendingChanges(true);
        setHasUnsyncedChanges(true);
        setIsSaving(true);
        setHasSyncIssue(false);
      });
      queueSave(150);
      return clearSaveTimer;
    }

    dirtySnapshotRef.current = nextSnapshot;
    startTransition(() => {
      setHasPendingChanges(true);
      setHasUnsyncedChanges(true);
      setIsSaving(true);
      setHasSyncIssue(false);
      setSyncStatus("syncing");
      setSyncNotice("Saving your latest changes to PocketBase.");
      setSyncError(null);
    });

    queueSave(WORKSPACE_REMOTE_SAVE_DEBOUNCE_MS);
    return clearSaveTimer;
  }, [authStatus, clearSaveTimer, queueSave, session, state]);

  const retrySync = useCallback(async () => {
    if (!session || !state || authStatus !== "authenticated") {
      return;
    }

    dirtySnapshotRef.current ??= serializeStateForSync(state);
    setHasPendingChanges(true);
    setHasUnsyncedChanges(true);
    setHasSyncIssue(false);
    clearSaveTimer();
    await flushLatestState({ forceCurrentState: true, bypassThrottle: true });
  }, [authStatus, clearSaveTimer, flushLatestState, session, state]);

  useEffect(() => {
    if (!session || authStatus !== "authenticated") {
      return;
    }

    const flushIfNeeded = () => {
      if (!state || !dirtySnapshotRef.current) {
        return;
      }

      if (isDevelopmentWorkspaceSession(session)) {
        clearSaveTimer();
        void flushLatestState({ forceCurrentState: true });
        return;
      }

      clearSaveTimer();
      void flushLatestState({ forceCurrentState: true, bypassThrottle: true });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushIfNeeded();
      }
    };

    window.addEventListener("pagehide", flushIfNeeded);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", flushIfNeeded);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [authStatus, clearSaveTimer, flushLatestState, session, state]);

  const syncIndicator: AppContextValue["sync"]["indicator"] = hasSyncIssue
    ? "issue"
    : isSaving
      ? "saving"
      : hasUnsyncedChanges
        ? "unsynced"
        : "saved";

  const value = useMemo<AppContextValue | null>(
    () =>
      state
        ? {
            state,
            dispatch,
            notes: {
              selectedBodyStatus,
              selectedBodyNotice,
              selectedBodyError,
            },
            sync: {
              status: syncStatus,
              indicator: syncIndicator,
              lastSavedAt,
              lastSyncedAt,
              notice: syncNotice,
              errorMessage: syncError,
              hasPendingChanges,
              hasUnsyncedChanges,
              isSaving,
              persistenceAvailable,
            },
            retrySync,
          }
        : null,
    [
      dispatch,
      hasPendingChanges,
      hasUnsyncedChanges,
      isSaving,
      lastSavedAt,
      lastSyncedAt,
      selectedBodyError,
      selectedBodyNotice,
      selectedBodyStatus,
      persistenceAvailable,
      retrySync,
      state,
      syncError,
      syncIndicator,
      syncNotice,
      syncStatus,
    ],
  );

  return {
    state,
    value,
  };
}

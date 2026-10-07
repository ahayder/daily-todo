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
  extractLocalOnlyUIState,
  extractSyncableUIState,
  getMaxTimestamp,
  mergeUiState,
  type PersistenceMetadata,
  type PersistenceRepository,
  type PersistenceStatus,
  type ServerLoadResult,
} from "@/lib/persistence";
import {
  applySyncOpsToState,
  diffSyncRecords,
  enqueueOps,
  fingerprintSyncValue,
  getMissingRecordOps,
  getSyncRecordValuesFromState,
  type ApplyOpResult,
  type SyncOp,
  type SyncRecordValue,
} from "@/lib/sync-outbox";
import { isDevelopmentWorkspaceSession } from "@/lib/dev-mode";
import { THEME_HINT_STORAGE_KEY } from "@/lib/theme-hint";
import { toISODate } from "@/lib/date";
import type { AppState, NoteBodyStatus } from "@/lib/types";
import { appReducer, loadDevelopmentWorkspaceState, saveDevelopmentWorkspaceState } from "./app-context.reducer";
import type { AppAction, AppContextValue } from "./app-context.types";

const OUTBOX_FLUSH_DEBOUNCE_MS = 600;
const OUTBOX_RETRY_INTERVAL_MS = 30_000;
const NOTE_BODY_REMOTE_SAVE_DEBOUNCE_MS = 5000;
const REFRESH_MIN_INTERVAL_MS = 5000;

/**
 * - cached: showing this device's saved copy, read-only, while the server loads
 * - ready: showing the server's data; edits are queued and sent per record
 * - load-failed: the server couldn't be reached; read-only until it can
 */
export type SyncPhase = "idle" | "cached" | "ready" | "load-failed";

type UseAppPersistenceStateArgs = {
  authStatus: AuthStatus;
  repository: PersistenceRepository;
  session: AuthSession | null;
};

/** Read-only mode blocks any action that changes synced content (UI-only actions still work). */
function changesSyncedContent(current: AppState, next: AppState) {
  return (
    current.dailyPages !== next.dailyPages ||
    current.todoWorkspaces !== next.todoWorkspaces ||
    current.notesDocs !== next.notesDocs ||
    current.noteFolders !== next.noteFolders ||
    current.plannerPresets !== next.plannerPresets ||
    current.contentBoard !== next.contentBoard ||
    current.contentCards !== next.contentCards
  );
}

/** Server data plus this device's own UI preferences (theme, sidebar, focus timer…). */
function withDeviceUi(serverState: AppState, deviceState: AppState | null): AppState {
  if (!deviceState) return serverState;
  return {
    ...serverState,
    uiState: mergeUiState(
      extractSyncableUIState(serverState.uiState),
      extractLocalOnlyUIState(deviceState.uiState),
      serverState.uiState,
    ),
  };
}

export function useAppPersistenceState({
  authStatus,
  repository,
  session,
}: UseAppPersistenceStateArgs) {
  const [state, setState] = useState<AppState | null>(null);
  const [phase, setPhaseState] = useState<SyncPhase>("idle");
  const phaseRef = useRef<SyncPhase>("idle");
  const latestStateRef = useRef<AppState | null>(null);
  /** The state this device last turned into outbox operations. */
  const prevStateRef = useRef<AppState | null>(null);
  const outboxRef = useRef<SyncOp[]>([]);
  /** What this device last saw on the server, per record (for version checks). */
  const metadataRef = useRef<PersistenceMetadata>(createPersistenceMetadata());
  const lastAuthenticatedUserIdRef = useRef<string | null>(null);
  const flushTimerRef = useRef<number | null>(null);
  const flushInFlightRef = useRef(false);
  const flushAgainRef = useRef(false);
  const lastRefreshStartedAtRef = useRef(0);
  const flushOutboxRef = useRef<() => Promise<void>>(async () => {});
  const themeMode = state?.uiState.themeMode;
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [syncStatus, setSyncStatus] = useState<PersistenceStatus>("idle");
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const noteBodySaveTimerRef = useRef<number | null>(null);
  const noteBodySnapshotRef = useRef<Record<string, string>>({});
  const [selectedBodyStatus, setSelectedBodyStatus] = useState<NoteBodyStatus>("idle");
  const [selectedBodyNotice, setSelectedBodyNotice] = useState<string | null>(null);
  const [selectedBodyError, setSelectedBodyError] = useState<string | null>(null);
  const userId = authStatus === "authenticated" ? (session?.userId ?? null) : null;
  const isDevSession = session ? isDevelopmentWorkspaceSession(session) : false;

  const setPhase = useCallback((next: SyncPhase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  const dispatch = useMemo<Dispatch<AppAction>>(
    () => (action) => {
      setState((current) => {
        if (!current) return current;
        const next = appReducer(current, action);
        if (next !== current && phaseRef.current !== "ready" && changesSyncedContent(current, next)) {
          return current;
        }
        latestStateRef.current = next;
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    latestStateRef.current = state;
  }, [state]);

  const clearFlushTimer = useCallback(() => {
    if (flushTimerRef.current !== null) {
      window.clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
  }, []);

  const clearNoteBodySaveTimer = useCallback(() => {
    if (noteBodySaveTimerRef.current !== null) {
      window.clearTimeout(noteBodySaveTimerRef.current);
      noteBodySaveTimerRef.current = null;
    }
  }, []);

  const persistOutbox = useCallback(
    (ops: SyncOp[]) => {
      outboxRef.current = ops;
      setPendingCount(ops.length);
      if (userId && !isDevSession) {
        repository.saveOutbox({ userId, ops });
      }
    },
    [isDevSession, repository, userId],
  );

  const saveCache = useCallback(
    (next: AppState) => {
      if (userId && !isDevSession) {
        repository.saveLocalCache({ userId, state: next, metadata: metadataRef.current });
      }
    },
    [isDevSession, repository, userId],
  );

  /** Turns this device's edits since the last capture into queued operations. */
  const captureLocalEdits = useCallback(() => {
    const prev = prevStateRef.current;
    const next = latestStateRef.current;
    if (!prev || !next || prev === next || phaseRef.current !== "ready") {
      return 0;
    }

    const { ops, blockedDeletes } = diffSyncRecords({
      prev: getSyncRecordValuesFromState(prev),
      next: getSyncRecordValuesFromState(next),
      serverRecords: metadataRef.current.records,
      now: new Date().toISOString(),
    });
    prevStateRef.current = next;
    saveCache(next);

    if (blockedDeletes > 0) {
      console.warn(`[sync] Blocked ${blockedDeletes} deletes from a single change.`);
      setSyncNotice(`Skipped removing ${blockedDeletes} items at once to keep your data safe.`);
    }

    if (ops.length > 0) {
      persistOutbox(enqueueOps(outboxRef.current, ops));
    }
    return ops.length;
  }, [persistOutbox, saveCache]);

  const flushOutbox = useCallback(async (): Promise<void> => {
    if (!userId || isDevSession || phaseRef.current !== "ready") return;
    if (flushInFlightRef.current) {
      flushAgainRef.current = true;
      return;
    }

    clearFlushTimer();
    captureLocalEdits();
    const sent = outboxRef.current;
    if (sent.length === 0) {
      setIsSaving(false);
      return;
    }

    flushInFlightRef.current = true;
    setIsSaving(true);
    setSyncStatus("syncing");

    let results: ApplyOpResult[];
    try {
      results = await repository.applyOps({ userId, ops: sent });
    } catch {
      results = sent.map((op) => ({
        key: op.key,
        status: "failed",
        errorMessage: "Sync is offline right now.",
        offline: true,
      }));
    }

    const sentByKey = new Map(sent.map((op) => [op.key, op]));
    const records = { ...metadataRef.current.records };
    const merged: SyncRecordValue[] = [];
    const failures: Array<{ errorMessage: string; offline: boolean }> = [];
    let outbox = outboxRef.current;

    for (const result of results) {
      const op = sentByKey.get(result.key);
      if (!op) continue;
      if (result.status === "failed") {
        failures.push({ errorMessage: result.errorMessage, offline: result.offline });
        continue;
      }

      const written = result.status === "merged" ? result.record : op.record;
      const serverUpdatedAtClient = result.status === "skipped" ? null : result.serverUpdatedAtClient;
      if (result.status !== "skipped") {
        if (op.type === "delete") {
          delete records[op.key];
        } else {
          records[op.key] = {
            key: op.key,
            kind: op.kind,
            fingerprint: fingerprintSyncValue(written.value),
            lastRemoteUpdatedAt: serverUpdatedAtClient,
            lastRemoteUpdatedAtClient: serverUpdatedAtClient,
          };
        }
      }

      const queued = outbox.find((candidate) => candidate.key === op.key);
      if (queued && queued.updatedAtClient === op.updatedAtClient) {
        outbox = outbox.filter((candidate) => candidate.key !== op.key);
        if (result.status === "merged") merged.push(result.record);
      } else if (queued && result.status === "written") {
        // A newer edit arrived while this one was sending: base it on what is now on the server.
        outbox = outbox.map((candidate) =>
          candidate.key === op.key
            ? { ...candidate, base: written, baseUpdatedAtClient: serverUpdatedAtClient }
            : candidate,
        );
      }
    }

    metadataRef.current = { ...metadataRef.current, records };
    persistOutbox(outbox);

    const current = latestStateRef.current;
    if (merged.length > 0 && current) {
      const ops = merged.map((record) => ({ type: "upsert" as const, record }));
      const next = applySyncOpsToState(current, ops);
      prevStateRef.current = applySyncOpsToState(prevStateRef.current ?? current, ops);
      latestStateRef.current = next;
      setState(next);
      setSyncNotice("A page was also edited on another device — both changes were kept.");
    }

    flushInFlightRef.current = false;

    if (failures.length > 0) {
      // Offline: edits simply wait ("N changes waiting"). Anything else is a real issue.
      const rejected = failures.find((failure) => !failure.offline);
      setSyncStatus(rejected ? "error" : "offline");
      setSyncError((rejected ?? failures[0]).errorMessage);
      setIsSaving(false);
      return;
    }

    const now = new Date().toISOString();
    setSyncStatus("synced");
    setSyncError(null);
    setLastSavedAt(now);
    setLastSyncedAt(now);
    if (latestStateRef.current) saveCache(latestStateRef.current);

    if (flushAgainRef.current || outboxRef.current.length > 0) {
      flushAgainRef.current = false;
      void flushOutboxRef.current();
      return;
    }
    setIsSaving(false);
  }, [captureLocalEdits, clearFlushTimer, isDevSession, persistOutbox, repository, saveCache, userId]);

  useEffect(() => {
    flushOutboxRef.current = flushOutbox;
  }, [flushOutbox]);

  const scheduleFlush = useCallback(
    (delayMs: number) => {
      clearFlushTimer();
      setIsSaving(true);
      flushTimerRef.current = window.setTimeout(() => {
        flushTimerRef.current = null;
        void flushOutbox();
      }, delayMs);
    },
    [clearFlushTimer, flushOutbox],
  );

  /** Shows the server's data, with this device's unsent edits on top. */
  const applyServerState = useCallback(
    (server: ServerLoadResult) => {
      captureLocalEdits();
      const outbox = outboxRef.current;
      const next = applySyncOpsToState(withDeviceUi(server.state, latestStateRef.current), outbox);
      metadataRef.current = createPersistenceMetadata({
        records: server.serverRecords,
        hasMigratedToSplitStore: true,
        lastRemoteUpdatedAtClient: getMaxTimestamp(
          Object.values(server.serverRecords).map((record) => record.lastRemoteUpdatedAtClient),
        ),
      });

      // Only creates records the server doesn't have yet (today's page, first-run defaults).
      const missing = getMissingRecordOps({
        state: next,
        serverRecords: server.serverRecords,
        outbox,
        now: new Date().toISOString(),
      });
      if (missing.length > 0) {
        persistOutbox(enqueueOps(outbox, missing));
      }

      prevStateRef.current = next;
      latestStateRef.current = next;
      setState(next);
      setPhase("ready");
      setLoadError(null);
      setSyncError(null);
      setSyncStatus(outboxRef.current.length > 0 ? "syncing" : "synced");
      setLastSavedAt(metadataRef.current.lastRemoteUpdatedAtClient);
      setLastSyncedAt(new Date().toISOString());
      saveCache(next);

      if (outboxRef.current.length > 0) {
        scheduleFlush(0);
      }
    },
    [captureLocalEdits, persistOutbox, saveCache, scheduleFlush, setPhase],
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

      clearFlushTimer();
      clearNoteBodySaveTimer();
      latestStateRef.current = null;
      prevStateRef.current = null;
      outboxRef.current = [];
      flushInFlightRef.current = false;
      flushAgainRef.current = false;
      noteBodySnapshotRef.current = {};
      metadataRef.current = createPersistenceMetadata();
      phaseRef.current = "idle";
      startTransition(() => {
        setState(null);
        setPhaseState("idle");
        setLoadError(null);
        setPendingCount(0);
        setIsSaving(false);
        setSyncStatus("idle");
        setSyncNotice(null);
        setSyncError(null);
        setLastSavedAt(null);
        setLastSyncedAt(null);
        setSelectedBodyStatus("idle");
        setSelectedBodyNotice(null);
        setSelectedBodyError(null);
      });
      return;
    }

    if (isDevelopmentWorkspaceSession(session)) {
      const devState = loadDevelopmentWorkspaceState();
      latestStateRef.current = devState;
      prevStateRef.current = devState;
      phaseRef.current = "ready";
      startTransition(() => {
        setState(devState);
        setPhaseState("ready");
        setSyncStatus("synced");
        setSyncNotice("Development workspace is active. Changes stay on this device.");
        setLastSavedAt(new Date().toISOString());
      });
      return;
    }

    let cancelled = false;
    const sessionUserId = session.userId;
    const outbox = repository.loadOutbox({ userId: sessionUserId });
    outboxRef.current = outbox;
    const cached = latestStateRef.current
      ? null
      : repository.loadCached({ userId: sessionUserId, now: new Date() });
    if (cached) {
      metadataRef.current = cached.metadata;
      latestStateRef.current = cached.state;
      phaseRef.current = "cached";
    }
    startTransition(() => {
      setPendingCount(outbox.length);
      setSyncStatus("loading");
    });

    void (async () => {
      // Show the device copy with normal priority, before the server request
      // starts. (As a low-priority transition it could land *after* the
      // server's data and briefly put the stale copy back on screen.)
      await Promise.resolve();
      if (cancelled) return;
      if (cached && phaseRef.current === "cached") {
        setState(cached.state);
        setPhaseState("cached");
        setLastSavedAt(cached.metadata.lastRemoteUpdatedAtClient);
      }

      try {
        await repository.evictExpiredCachedBodies({ userId: sessionUserId, now: new Date() }).catch(() => {});
        const server = await repository.loadServer({ userId: sessionUserId, now: new Date() });
        if (!cancelled) applyServerState(server);
      } catch {
        if (cancelled) return;
        setPhase("load-failed");
        setSyncStatus("offline");
        setLoadError(
          latestStateRef.current
            ? "Can’t reach the server, so this device’s saved copy is shown read-only."
            : "Can’t reach the server right now.",
        );
      }
    })();

    return () => {
      cancelled = true;
    };
    // loadAttempt re-runs the load after a failure.
  }, [
    applyServerState,
    authStatus,
    clearFlushTimer,
    clearNoteBodySaveTimer,
    loadAttempt,
    persistOutbox,
    repository,
    session,
    setPhase,
  ]);

  const refreshFromServer = useCallback(async () => {
    if (!userId || isDevSession || phaseRef.current !== "ready" || flushInFlightRef.current) return;
    if (Date.now() - lastRefreshStartedAtRef.current < REFRESH_MIN_INTERVAL_MS) return;
    lastRefreshStartedAtRef.current = Date.now();

    try {
      const server = await repository.loadServer({ userId, now: new Date() });
      if (phaseRef.current === "ready" && !flushInFlightRef.current) {
        applyServerState(server);
      }
    } catch {
      // Keep showing what we have; queued edits retry on their own.
    }
  }, [applyServerState, isDevSession, repository, userId]);

  // Retry: flush queued edits when the connection returns, on focus, and every
  // 30s while anything is waiting; retry a failed load the same way.
  useEffect(() => {
    if (!userId || isDevSession) return;

    const kick = () => {
      if (phaseRef.current === "load-failed") {
        setLoadAttempt((attempt) => attempt + 1);
        return;
      }
      if (phaseRef.current === "ready") {
        void flushOutbox().then(() => refreshFromServer());
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") kick();
      else void flushOutbox();
    };
    const interval = window.setInterval(() => {
      if (outboxRef.current.length > 0 || phaseRef.current === "load-failed") kick();
    }, OUTBOX_RETRY_INTERVAL_MS);

    window.addEventListener("online", kick);
    window.addEventListener("focus", kick);
    window.addEventListener("pagehide", flushOutbox);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("online", kick);
      window.removeEventListener("focus", kick);
      window.removeEventListener("pagehide", flushOutbox);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [flushOutbox, isDevSession, refreshFromServer, userId]);

  const selectedNoteId = state?.uiState.selectedNoteId ?? null;
  const selectedNote = selectedNoteId ? state?.notesDocs[selectedNoteId] ?? null : null;
  // The note-body effects key off the note's content, not its object identity:
  // React can replay queued state updates and hand back an equal-but-new note
  // object, which must not restart note loading or the body save debounce.
  const hasSelectedNote = selectedNote !== null;
  const selectedNoteMarkdown = selectedNote?.markdown;
  const selectedNoteUpdatedAt = selectedNote?.updatedAt;
  const hasSelectedNoteBody = typeof selectedNoteMarkdown === "string";

  // Load the body when a note is selected or its body goes missing — not on
  // every local edit, which would reload the older remote copy over the typing.
  useEffect(() => {
    if (!session || authStatus !== "authenticated" || !selectedNoteId || !hasSelectedNote) {
      startTransition(() => {
        setSelectedBodyStatus("idle");
        setSelectedBodyNotice(null);
        setSelectedBodyError(null);
      });
      return;
    }

    const currentMarkdown = latestStateRef.current?.notesDocs[selectedNoteId]?.markdown;
    const lastSnapshotMarkdown = noteBodySnapshotRef.current[selectedNoteId];
    const isCachedBodyUpToDate =
      typeof currentMarkdown === "string" && lastSnapshotMarkdown === currentMarkdown;

    if (isCachedBodyUpToDate) {
      startTransition(() => {
        setSelectedBodyStatus("ready");
        setSelectedBodyNotice(null);
        setSelectedBodyError(null);
      });
      return;
    }

    let cancelled = false;
    startTransition(() => {
      setSelectedBodyStatus("loading");
      setSelectedBodyNotice(null);
      setSelectedBodyError(null);
    });

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
  }, [authStatus, hasSelectedNote, hasSelectedNoteBody, repository, selectedNoteId, session]);

  useEffect(() => {
    if (
      !session ||
      authStatus !== "authenticated" ||
      !selectedNoteId ||
      !hasSelectedNote ||
      typeof selectedNoteMarkdown !== "string" ||
      selectedNoteUpdatedAt === undefined
    ) {
      clearNoteBodySaveTimer();
      return;
    }

    const previousMarkdown = noteBodySnapshotRef.current[selectedNoteId];
    if (previousMarkdown === selectedNoteMarkdown) {
      return;
    }

    void repository.primeRecentNoteCache({
      userId: session.userId,
      noteBodies: [
        {
          noteId: selectedNoteId,
          markdown: selectedNoteMarkdown,
          updatedAtClient: selectedNoteUpdatedAt,
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
          markdown: selectedNoteMarkdown ?? "",
          updatedAtClient: selectedNoteUpdatedAt,
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
  }, [
    authStatus,
    clearNoteBodySaveTimer,
    hasSelectedNote,
    repository,
    selectedNoteId,
    selectedNoteMarkdown,
    selectedNoteUpdatedAt,
    session,
  ]);

  useLayoutEffect(() => {
    if (typeof window === "undefined" || !state) {
      return;
    }

    const root = document.documentElement;
    const query = window.matchMedia("(prefers-color-scheme: dark)");

    const applyDarkState = (isDark: boolean) => {
      root.classList.toggle("dark", isDark);
      root.style.colorScheme = isDark ? "dark" : "light";
      // Read by the pre-hydration script in app/layout.tsx so the first paint matches.
      try {
        window.localStorage.setItem(THEME_HINT_STORAGE_KEY, isDark ? "dark" : "light");
      } catch {
        // Storage can be unavailable (private mode); the theme still applies after hydration.
      }
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


  // Every committed state change: queue this device's edits and send them soon.
  useEffect(() => {
    if (!state || !session || authStatus !== "authenticated") {
      return;
    }

    if (isDevSession) {
      if (prevStateRef.current !== state) {
        saveDevelopmentWorkspaceState(state);
        prevStateRef.current = state;
      }
      return;
    }

    if (captureLocalEdits() > 0) {
      startTransition(() => scheduleFlush(OUTBOX_FLUSH_DEBOUNCE_MS));
    }
  }, [authStatus, captureLocalEdits, isDevSession, scheduleFlush, session, state]);

  // Drop a pending send only when the signed-in user (or repository) changes, not when
  // the session object is merely refreshed.
  useEffect(() => clearFlushTimer, [clearFlushTimer, repository, userId]);

  // Advance the daily view to the real "today" once the server's data is shown,
  // and again when the calendar day rolls over while the app stays open. It
  // waits for "ready" so today's page is always carried over from the latest
  // real day, never from a stale device copy.
  const lastEnsuredDayRef = useRef<string | null>(null);
  const isReady = authStatus === "authenticated" && state !== null && phase === "ready";
  useEffect(() => {
    if (!isReady) {
      lastEnsuredDayRef.current = null;
      return;
    }

    const ensureToday = () => {
      const today = toISODate(new Date());
      if (lastEnsuredDayRef.current === today) {
        return;
      }
      lastEnsuredDayRef.current = today;
      dispatch({ type: "ensure-daily-today", date: today });
    };

    ensureToday();

    const handleFocus = () => ensureToday();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        ensureToday();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [dispatch, isReady]);

  const retrySync = useCallback(async () => {
    if (!userId || isDevSession) {
      return;
    }

    if (phaseRef.current !== "ready") {
      setLoadAttempt((attempt) => attempt + 1);
      return;
    }

    setSyncError(null);
    await flushOutbox();
    lastRefreshStartedAtRef.current = 0;
    await refreshFromServer();
  }, [flushOutbox, isDevSession, refreshFromServer, userId]);

  const isReadOnly = phase !== "ready";
  const hasUnsyncedChanges = pendingCount > 0;
  const syncIndicator: AppContextValue["sync"]["indicator"] =
    phase === "cached" || phase === "idle"
      ? "loading"
      : phase === "load-failed"
        ? "offline-readonly"
        : syncStatus === "error"
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
              notice: loadError ?? syncNotice,
              errorMessage: syncError,
              hasPendingChanges: hasUnsyncedChanges,
              hasUnsyncedChanges,
              isSaving,
              isReadOnly,
              pendingCount,
              persistenceAvailable: true,
            },
            retrySync,
          }
        : null,
    [
      dispatch,
      hasUnsyncedChanges,
      isReadOnly,
      isSaving,
      lastSavedAt,
      lastSyncedAt,
      loadError,
      pendingCount,
      retrySync,
      selectedBodyError,
      selectedBodyNotice,
      selectedBodyStatus,
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
    loadError,
    retryLoad: () => setLoadAttempt((attempt) => attempt + 1),
  };
}

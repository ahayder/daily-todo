"use client";

import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, Download, LoaderCircle, RefreshCw } from "lucide-react";
import { getName, getVersion } from "@tauri-apps/api/app";
import { isTauri } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import {
  check,
  type DownloadEvent,
  type Update,
} from "@tauri-apps/plugin-updater";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type UpdatePhase =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "installing"
  | "relaunching"
  | "up-to-date"
  | "error";

type CheckForUpdatesOptions = {
  userInitiated?: boolean;
};

type UpdaterLogAction = "check" | "install";

type UpdaterLogEntry = {
  action: UpdaterLogAction;
  currentVersion: string | null;
  latestVersion: string | null;
  message: string;
  rawError: string;
  timestamp: string;
  userInitiated?: boolean;
};

type DesktopUpdateContextValue = {
  appName: string;
  currentVersion: string | null;
  latestVersion: string | null;
  releaseNotes: string | null;
  phase: UpdatePhase;
  errorMessage: string | null;
  isDialogOpen: boolean;
  isSupported: boolean;
  isUpdateAvailable: boolean;
  progressPercent: number | null;
  progressText: string | null;
  checkForUpdates: (options?: CheckForUpdatesOptions) => Promise<boolean>;
  dismissDialog: () => void;
  installUpdate: () => Promise<void>;
  openDialog: () => void;
};

const noopAsync = async () => false;
const noopInstall = async () => {};
const DesktopUpdateContext = createContext<DesktopUpdateContextValue>({
  appName: "DailyTodoApp",
  currentVersion: null,
  latestVersion: null,
  releaseNotes: null,
  phase: "idle",
  errorMessage: null,
  isDialogOpen: false,
  isSupported: false,
  isUpdateAvailable: false,
  progressPercent: null,
  progressText: null,
  checkForUpdates: noopAsync,
  dismissDialog: () => {},
  installUpdate: noopInstall,
  openDialog: () => {},
});

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    const normalizedMessage = error.message.toLowerCase();
    if (normalizedMessage.includes("404") || normalizedMessage.includes("not found")) {
      return "The update feed could not be reached. If releases are hosted in a private GitHub repo, the desktop updater cannot access them.";
    }
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    const normalizedMessage = error.toLowerCase();
    if (normalizedMessage.includes("404") || normalizedMessage.includes("not found")) {
      return "The update feed could not be reached. If releases are hosted in a private GitHub repo, the desktop updater cannot access them.";
    }
    return error;
  }

  return "The update feed could not be reached. If releases are hosted in a private GitHub repo, the desktop updater cannot access them.";
}

function getRawError(error: unknown) {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function recordUpdaterError(entry: UpdaterLogEntry) {
  console.error("[updater]", entry);

  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem("dailytodo.updater-last-error.v1", JSON.stringify(entry));
  } catch (storageError) {
    console.warn("Failed to persist updater error log", storageError);
  }
}

export function DesktopUpdateProvider({ children }: { children: ReactNode }) {
  const [appName, setAppName] = useState("DailyTodoApp");
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [releaseNotes, setReleaseNotes] = useState<string | null>(null);
  const [phase, setPhase] = useState<UpdatePhase>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSupported] = useState(() => typeof window !== "undefined" && isTauri());
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState<number | null>(null);
  const pendingUpdateRef = useRef<Update | null>(null);
  const checkTimerRef = useRef<number | null>(null);
  const isCheckingRef = useRef(false);

  useEffect(() => {
    if (!isSupported) {
      return;
    }

    let cancelled = false;

    void Promise.allSettled([getName(), getVersion()]).then((results) => {
      if (cancelled) {
        return;
      }

      const [nameResult, versionResult] = results;

      if (nameResult.status === "fulfilled") {
        setAppName(nameResult.value);
      }

      if (versionResult.status === "fulfilled") {
        setCurrentVersion(versionResult.value);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isSupported]);

  async function resetPendingUpdate() {
    if (pendingUpdateRef.current) {
      await pendingUpdateRef.current.close();
      pendingUpdateRef.current = null;
    }
  }

  function scheduleIdleReset(nextPhase: Extract<UpdatePhase, "up-to-date" | "error">) {
    if (checkTimerRef.current !== null) {
      window.clearTimeout(checkTimerRef.current);
    }

    checkTimerRef.current = window.setTimeout(() => {
      setPhase((current) => (current === nextPhase ? "idle" : current));
    }, 4000);
  }

  async function checkForUpdates(options?: CheckForUpdatesOptions) {
    if (!isSupported || isCheckingRef.current) {
      return false;
    }

    const userInitiated = options?.userInitiated ?? false;
    isCheckingRef.current = true;
    setErrorMessage(null);
    setDownloadedBytes(0);
    setTotalBytes(null);
    setPhase("checking");

    try {
      const availableUpdate = await check();
      isCheckingRef.current = false;

      if (!availableUpdate) {
        await resetPendingUpdate();
        setLatestVersion(null);
        setReleaseNotes(null);
        setPhase(userInitiated ? "up-to-date" : "idle");
        setIsDialogOpen(false);

        if (userInitiated) {
          scheduleIdleReset("up-to-date");
        }

        return false;
      }

      await resetPendingUpdate();
      pendingUpdateRef.current = availableUpdate;
      setCurrentVersion(availableUpdate.currentVersion);
      setLatestVersion(availableUpdate.version);
      setReleaseNotes(availableUpdate.body ?? null);
      setPhase("available");
      setIsDialogOpen(true);
      return true;
    } catch (error) {
      isCheckingRef.current = false;
      const nextErrorMessage = getErrorMessage(error);
      setErrorMessage(nextErrorMessage);
      recordUpdaterError({
        action: "check",
        currentVersion,
        latestVersion,
        message: nextErrorMessage,
        rawError: getRawError(error),
        timestamp: new Date().toISOString(),
        userInitiated,
      });
      setPhase("error");

      if (userInitiated) {
        setIsDialogOpen(true);
      } else {
        scheduleIdleReset("error");
      }

      return false;
    }
  }

  async function installUpdate() {
    const pendingUpdate = pendingUpdateRef.current;

    if (!pendingUpdate) {
      return;
    }

    setErrorMessage(null);
    setDownloadedBytes(0);
    setTotalBytes(null);
    setPhase("downloading");
    setIsDialogOpen(true);

    try {
      await pendingUpdate.downloadAndInstall((event: DownloadEvent) => {
        startTransition(() => {
          if (event.event === "Started") {
            setTotalBytes(event.data.contentLength ?? null);
            setDownloadedBytes(0);
            return;
          }

          if (event.event === "Progress") {
            setDownloadedBytes((current) => current + event.data.chunkLength);
            return;
          }

          setPhase("installing");
        });
      });

      setPhase("relaunching");
      await relaunch();
    } catch (error) {
      const nextErrorMessage = getErrorMessage(error);
      setErrorMessage(nextErrorMessage);
      recordUpdaterError({
        action: "install",
        currentVersion,
        latestVersion,
        message: nextErrorMessage,
        rawError: getRawError(error),
        timestamp: new Date().toISOString(),
      });
      setPhase("error");
    }
  }

  const runInitialCheck = useEffectEvent(() => {
    void checkForUpdates();
  });

  useEffect(() => {
    if (!isSupported) {
      return;
    }

    const checkTimeout = window.setTimeout(() => {
      runInitialCheck();
    }, 0);

    return () => {
      window.clearTimeout(checkTimeout);

      if (checkTimerRef.current !== null) {
        window.clearTimeout(checkTimerRef.current);
      }

      if (pendingUpdateRef.current) {
        void pendingUpdateRef.current.close();
      }
    };
  }, [isSupported]);

  const progressPercent =
    totalBytes && totalBytes > 0
      ? Math.max(0, Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)))
      : null;

  const progressText =
    phase === "downloading"
      ? totalBytes && totalBytes > 0
        ? `${formatBytes(downloadedBytes)} of ${formatBytes(totalBytes)}`
        : "Preparing download"
      : phase === "installing"
        ? "Replacing the app bundle"
        : phase === "relaunching"
          ? "Restarting the app"
          : null;

  const contextValue: DesktopUpdateContextValue = {
    appName,
    currentVersion,
    latestVersion,
    releaseNotes,
    phase,
    errorMessage,
    isDialogOpen,
    isSupported,
    isUpdateAvailable:
      latestVersion !== null ||
      phase === "downloading" ||
      phase === "installing" ||
      phase === "relaunching",
    progressPercent,
    progressText,
    checkForUpdates,
    dismissDialog: () => setIsDialogOpen(false),
    installUpdate,
    openDialog: () => setIsDialogOpen(true),
  };

  return (
    <DesktopUpdateContext.Provider value={contextValue}>
      {children}
      <DesktopUpdateDialog />
    </DesktopUpdateContext.Provider>
  );
}

function DesktopUpdateDialog() {
  const {
    appName,
    currentVersion,
    latestVersion,
    releaseNotes,
    phase,
    errorMessage,
    isDialogOpen,
    progressPercent,
    progressText,
    checkForUpdates,
    dismissDialog,
    installUpdate,
  } = useDesktopUpdate();

  if (!isDialogOpen) {
    return null;
  }

  const isBusy =
    phase === "checking" ||
    phase === "downloading" ||
    phase === "installing" ||
    phase === "relaunching";

  const title =
    phase === "error"
      ? "Updater needs attention"
      : phase === "downloading"
        ? "Downloading update"
        : phase === "installing"
          ? "Installing update"
          : phase === "relaunching"
            ? "Restarting"
            : latestVersion
              ? `Update ready for ${appName}`
              : "Checking for updates";

  const actionLabel =
    phase === "error"
      ? latestVersion
        ? "Try Again"
        : "Retry Check"
      : phase === "available"
        ? "Update Now"
        : phase === "downloading"
          ? "Downloading..."
          : phase === "installing"
            ? "Installing..."
            : "Restarting...";

  const Icon =
    phase === "error"
      ? RefreshCw
      : isBusy
        ? LoaderCircle
        : latestVersion
          ? Download
          : CheckCircle2;

  return (
    <AlertDialog open={isDialogOpen} onOpenChange={dismissDialog}>
      <AlertDialogContent className="alert-dialog-content max-w-md">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-[var(--brand-soft)] text-[var(--brand)]">
            <Icon className={isBusy ? "size-5 animate-spin" : "size-5"} />
          </AlertDialogMedia>
          <AlertDialogTitle className="font-semibold text-[var(--ink-900)]">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="w-full text-left text-[var(--ink-700)]">
            <span>
              {latestVersion ? (
                <>
                  Version <span className="font-medium text-[var(--ink-900)]">{latestVersion}</span>
                  {" "}is available
                  {currentVersion ? (
                    <>
                      {" "}for your current build
                      {" "}
                      <span className="font-medium text-[var(--ink-900)]">{currentVersion}</span>.
                    </>
                  ) : (
                    "."
                  )}
                </>
              ) : (
                phase === "error"
                  ? "The app could not reach the configured update feed."
                  : "The app could not confirm the newest release yet."
              )}
            </span>
          </AlertDialogDescription>
          <div className="w-full space-y-3 text-left sm:col-start-2">
            {progressText ? (
              <div className="space-y-2">
                <div className="h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--line)_80%,transparent)]">
                  <div
                    className="h-full rounded-full bg-[var(--brand)] transition-all"
                    style={{ width: `${progressPercent ?? 18}%` }}
                  />
                </div>
                <p className="text-xs text-[var(--ink-700)]">
                  {progressPercent ? `${progressPercent}% · ` : ""}
                  {progressText}
                </p>
              </div>
            ) : null}
            {errorMessage ? (
              <p className="rounded-xl border border-[color-mix(in_srgb,var(--warn)_25%,transparent)] bg-[color-mix(in_srgb,var(--warn)_7%,transparent)] px-3 py-2 text-sm text-[var(--warn)]">
                {errorMessage}
              </p>
            ) : null}
            {releaseNotes ? (
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2">
                <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-700)]">
                  Release Notes
                </p>
                <p className="max-h-28 overflow-y-auto whitespace-pre-wrap text-sm text-[var(--ink-900)]">
                  {releaseNotes}
                </p>
              </div>
            ) : null}
            <p className="text-xs text-[var(--ink-700)]">
              This personal macOS build is unsigned for public distribution, so Gatekeeper may ask
              you to approve the app again in Privacy & Security after install.
            </p>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            type="button"
            variant="outline"
            className="alert-dialog-cancel"
            onClick={dismissDialog}
            disabled={isBusy}
          >
            {latestVersion ? "Later" : "Close"}
          </Button>
          <Button
            type="button"
            onClick={() => {
              if (phase === "error" && !latestVersion) {
                void checkForUpdates({ userInitiated: true });
                return;
              }

              void installUpdate();
            }}
            disabled={isBusy || (!latestVersion && phase !== "error")}
          >
            {actionLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function useDesktopUpdate() {
  return useContext(DesktopUpdateContext);
}

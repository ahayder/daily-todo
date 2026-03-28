"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useId,
  type Dispatch,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { toISODate } from "@/lib/date";
import { getDayLabel, getMonthLabel, getYearMonth } from "@/lib/date";
import type { AppAction } from "@/components/app-context";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/components/auth-context";
import { cn } from "@/lib/utils";
import { DEFAULT_NOTES_FOLDER_ID, getSortedDailyDates } from "@/lib/store";
import type { AppState, NoteDoc, NoteFolder, ThemeMode } from "@/lib/types";
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Copy,
  FilePlus2,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  PanelsTopLeft,
  Plus,
  Trash2,
  ArrowDownToLine,
  LoaderCircle,
  LogOut,
  Monitor,
  Moon,
  Sun,
} from "lucide-react";

type Props = {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  sync: {
    hasUnsyncedChanges: boolean;
  };
  retrySync: () => Promise<void>;
};

const THEME_ICONS: Record<ThemeMode, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

const THEME_CYCLE: ThemeMode[] = ["light", "dark", "system"];

function getThemeLabel(themeMode: ThemeMode) {
  if (themeMode === "light") return "Light mode";
  if (themeMode === "dark") return "Dark mode";
  return "System theme";
}

function getThemeMenuLabel(themeMode: ThemeMode) {
  if (themeMode === "light") return "Switch to dark mode";
  if (themeMode === "dark") return "Switch to system theme";
  return "Switch to light mode";
}

function getThemeButtonLabel(themeMode: ThemeMode) {
  return `${getThemeMenuLabel(themeMode)} from ${getThemeLabel(themeMode).toLowerCase()}`;
}

function getAvatarLabel(email: string | null | undefined) {
  if (!email) return "Workspace account";
  return `Account menu for ${email}`;
}

function getAvatarInitials(email: string | null | undefined) {
  if (!email) return "ME";

  const localPart = email.split("@")[0]?.replace(/[^a-zA-Z0-9]+/g, " ").trim() ?? "";
  const segments = localPart.split(/\s+/).filter(Boolean);

  if (segments.length >= 2) {
    return `${segments[0][0] ?? ""}${segments[1][0] ?? ""}`.toUpperCase();
  }

  const compact = localPart.replace(/\s+/g, "");
  return (compact.slice(0, 2) || "ME").toUpperCase();
}

function SidebarProfileMenu({
  email,
  hasUnsyncedChanges,
  retrySync,
}: {
  email: string | null | undefined;
  hasUnsyncedChanges: boolean;
  retrySync: () => Promise<void>;
}) {
  const { signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const avatarInitials = getAvatarInitials(email);
  const accountLabel = email ?? "Workspace account";

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  return (
    <div className="sidebar-profile" ref={menuRef}>
      {isOpen ? (
        <div id={menuId} role="menu" aria-label="Account menu" className="sidebar-profile-menu">
          <div className="sidebar-profile-menu__header">
            <span className="sidebar-profile-menu__eyebrow">Signed in as</span>
            <span className="sidebar-profile-menu__email">{accountLabel}</span>
          </div>
          <button
            type="button"
            role="menuitem"
            className="sidebar-profile-menu__item sidebar-profile-menu__item--danger"
            onClick={async () => {
              try {
                setIsSigningOut(true);
                if (hasUnsyncedChanges) {
                  await retrySync();
                }
                await signOut();
              } finally {
                setIsSigningOut(false);
                setIsOpen(false);
              }
            }}
          >
            <span className="sidebar-profile-menu__item-copy">
              <span className="sidebar-profile-menu__item-title">Log out</span>
              <span className="sidebar-profile-menu__item-subtitle">Sign out of this workspace</span>
            </span>
            {isSigningOut ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
          </button>
        </div>
      ) : null}
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        aria-label={getAvatarLabel(email)}
        className="sidebar-profile-trigger"
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="sidebar-profile-trigger__avatar" aria-hidden="true">
          {avatarInitials}
        </span>
        <span className="sidebar-profile-trigger__copy">
          <span className="sidebar-profile-trigger__title">{email ?? "Workspace account"}</span>
          <span className="sidebar-profile-trigger__subtitle">Open account menu</span>
        </span>
      </button>
    </div>
  );
}

type NotesTreeNode =
  | { kind: "folder"; folder: NoteFolder }
  | { kind: "note"; note: NoteDoc };

function buildNotesTree(state: AppState) {
  const foldersByParent = new Map<string | null, NoteFolder[]>();
  const notesByFolder = new Map<string | null, NoteDoc[]>();

  for (const folder of Object.values(state.noteFolders).sort((a, b) => {
    if (a.id === DEFAULT_NOTES_FOLDER_ID) return -1;
    if (b.id === DEFAULT_NOTES_FOLDER_ID) return 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  })) {
    const parentId = folder.parentId && state.noteFolders[folder.parentId] ? folder.parentId : null;
    const siblings = foldersByParent.get(parentId) ?? [];
    siblings.push(folder);
    foldersByParent.set(parentId, siblings);
  }

  for (const note of Object.values(state.notesDocs).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  )) {
    const folderId = note.folderId && state.noteFolders[note.folderId] ? note.folderId : null;
    const notes = notesByFolder.get(folderId) ?? [];
    notes.push(note);
    notesByFolder.set(folderId, notes);
  }

  return { foldersByParent, notesByFolder };
}

function NoteRow({
  note,
  isActive,
  folderName,
  dispatch,
}: {
  note: NoteDoc;
  isActive: boolean;
  folderName: string;
  dispatch: Dispatch<AppAction>;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `note:${note.id}`,
    data: {
      noteId: note.id,
      type: "note",
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.55 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "sidebar-item-row sidebar-item-row--hoverable sidebar-item-row--note",
        isActive && "sidebar-item-row--active",
        isDragging && "sidebar-item-row--dragging",
      )}
    >
      <button
        type="button"
        className={cn("note-item sidebar-item-button", isActive && "note-item--active")}
        onClick={() => dispatch({ type: "select-note", noteId: note.id })}
        {...attributes}
        {...listeners}
      >
        <span className="note-item-title">{note.title || "Untitled Note"}</span>
        <span className="note-item-meta">
          <span className="note-item-meta-chip">
            <Folder className="h-3 w-3" />
            <span>{folderName}</span>
          </span>
          <span className="note-item-meta-chip">
            <CalendarDays className="h-3 w-3" />
            <span>
              {new Date(note.updatedAt).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </span>
          </span>
        </span>
      </button>
    </div>
  );
}

function FolderRow({
  folder,
  isSelected,
  isExpanded,
  isDraggingNote,
  dispatch,
}: {
  folder: NoteFolder;
  isSelected: boolean;
  isExpanded: boolean;
  isDraggingNote: boolean;
  dispatch: Dispatch<AppAction>;
}) {
  const isDefaultFolder = folder.id === DEFAULT_NOTES_FOLDER_ID;
  const [draftName, setDraftName] = useState(folder.name);
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { isOver, setNodeRef } = useDroppable({
    id: `folder:${folder.id}`,
    data: {
      folderId: folder.id,
      type: "folder",
    },
    disabled: isEditing,
  });

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const commitRename = () => {
    dispatch({ type: "rename-note-folder", folderId: folder.id, name: draftName });
    setIsEditing(false);
  };

  const cancelRename = () => {
    setDraftName(folder.name);
    setIsEditing(false);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitRename();
    }

    if (event.key === "Escape") {
      event.preventDefault();
      cancelRename();
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "sidebar-item-row sidebar-item-row--hoverable",
        isSelected && "sidebar-item-row--active",
        isDraggingNote && "sidebar-item-row--drop-candidate",
        isOver && "sidebar-item-row--drop-target",
      )}
    >
      {isEditing ? (
        <div
          className={cn(
            "note-folder-row note-folder-item sidebar-item-button",
            isSelected && "note-folder-item--active",
          )}
        >
          <button
            type="button"
            className="folder-expand-toggle"
            aria-label={isExpanded ? `Collapse folder ${folder.name}` : `Expand folder ${folder.name}`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => dispatch({ type: "toggle-note-folder", folderId: folder.id })}
          >
            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
          <FolderOpen className="h-3.5 w-3.5 tree-folder-icon" />
          <input
            ref={inputRef}
            aria-label={`Rename folder ${folder.name}`}
            className="note-folder-input"
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            onBlur={commitRename}
            onKeyDown={handleKeyDown}
          />
        </div>
      ) : (
        <>
          <button
            type="button"
            className="folder-expand-toggle"
            aria-label={isExpanded ? `Collapse folder ${folder.name}` : `Expand folder ${folder.name}`}
            onClick={() => dispatch({ type: "toggle-note-folder", folderId: folder.id })}
          >
            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            className={cn("note-folder-row note-folder-item sidebar-item-button", isSelected && "note-folder-item--active")}
            onClick={() => {
              if (isSelected) {
                if (isDefaultFolder) {
                  return;
                }
                setDraftName(folder.name);
                setIsEditing(true);
                return;
              }

              dispatch({ type: "select-note-folder", folderId: folder.id });
            }}
          >
            {isExpanded || isSelected ? (
              <FolderOpen className="h-3.5 w-3.5 tree-folder-icon" />
            ) : (
              <Folder className="h-3.5 w-3.5 tree-folder-icon" />
            )}
            <span className="note-folder-name">{folder.name}</span>
            {isDraggingNote && (
              <span className={cn("note-folder-drop-hint", isOver && "note-folder-drop-hint--active")}>
                <ArrowDownToLine className="h-3 w-3" />
                {isOver ? "Drop to move" : "Move here"}
              </span>
            )}
          </button>
        </>
      )}

    </div>
  );
}

function NotesTree({
  state,
  dispatch,
  parentFolderId = null,
  depth = 0,
  activeDraggedNoteId = null,
}: {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  parentFolderId?: string | null;
  depth?: number;
  activeDraggedNoteId?: string | null;
}) {
  const { foldersByParent, notesByFolder } = buildNotesTree(state);
  const folders = foldersByParent.get(parentFolderId) ?? [];
  const notes = notesByFolder.get(parentFolderId) ?? [];
  const nodes: NotesTreeNode[] = [
    ...folders.map((folder) => ({ kind: "folder" as const, folder })),
    ...notes.map((note) => ({ kind: "note" as const, note })),
  ];

  if (!nodes.length) {
    return null;
  }

  return (
    <div className={cn(depth > 0 && "notes-tree-children")}>
      {nodes.map((node) =>
        node.kind === "folder" ? (
          <div key={node.folder.id} className="tree-group">
            <FolderRow
              folder={node.folder}
              isSelected={
                state.uiState.selectedNoteFolderId === node.folder.id &&
                state.uiState.selectedNoteId === null
              }
              isExpanded={state.uiState.expandedNoteFolders.includes(node.folder.id)}
              isDraggingNote={Boolean(activeDraggedNoteId)}
              dispatch={dispatch}
            />
            {state.uiState.expandedNoteFolders.includes(node.folder.id) && (
              <NotesTree
                state={state}
                dispatch={dispatch}
                parentFolderId={node.folder.id}
                depth={depth + 1}
                activeDraggedNoteId={activeDraggedNoteId}
              />
            )}
          </div>
        ) : (
          <NoteRow
            key={node.note.id}
            note={node.note}
            isActive={state.uiState.selectedNoteId === node.note.id}
            folderName={state.noteFolders[node.note.folderId ?? DEFAULT_NOTES_FOLDER_ID]?.name ?? "Notes"}
            dispatch={dispatch}
          />
        ),
      )}
    </div>
  );
}

export function Sidebar({ state, dispatch, sync, retrySync }: Props) {
  const [activeDraggedNoteId, setActiveDraggedNoteId] = useState<string | null>(null);
  const { session } = useAuth();
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
  );
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  if (state.uiState.isSidebarCollapsed) {
    return null;
  }

  const sortedDates = getSortedDailyDates(state);
  const todayISO = mounted ? toISODate(new Date()) : "";

  const groupedYears = new Map<string, Map<string, string[]>>();

  for (const date of sortedDates) {
    const year = date.slice(0, 4);
    const month = getYearMonth(date);
    if (!groupedYears.has(year)) {
      groupedYears.set(year, new Map<string, string[]>());
    }
    const months = groupedYears.get(year);
    if (!months) continue;
    if (!months.has(month)) {
      months.set(month, []);
    }
    months.get(month)?.push(date);
  }

  const plannerPresets = Object.values(state.plannerPresets).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
  const themeMode = mounted ? state.uiState.themeMode : "dark";
  const ThemeIcon = THEME_ICONS[themeMode];
  const nextThemeMode = THEME_CYCLE[(THEME_CYCLE.indexOf(themeMode) + 1) % THEME_CYCLE.length];

  const isDailyView = !mounted || state.uiState.lastView === "daily";
  const isPlannerView = mounted && state.uiState.lastView === "planner";

  const handleDragEnd = (event: DragEndEvent) => {
    const noteId = event.active.data.current?.noteId as string | undefined;
    const folderId = event.over?.data.current?.folderId as string | undefined;

    setActiveDraggedNoteId(null);

    if (!noteId || !folderId) {
      return;
    }

    dispatch({
      type: "move-note-to-folder",
      noteId,
      folderId,
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    const noteId = event.active.data.current?.noteId as string | undefined;
    setActiveDraggedNoteId(noteId ?? null);
  };

  return (
    <aside className="sidebar">
      {isDailyView && mounted && (
        <button
          type="button"
          onClick={() => {
            if (todayISO) dispatch({ type: "select-daily", date: todayISO });
          }}
          className="today-btn"
        >
          <CalendarDays className="h-4 w-4" />
          <span>Today</span>
        </button>
      )}

      {!isDailyView && mounted && (
        <div className="sidebar-section-header">
          <span className="sidebar-section-label">
            {isPlannerView ? (
              <>
                <PanelsTopLeft className="h-3.5 w-3.5" />
                Planner Presets
              </>
            ) : (
              <>
                <FileText className="h-3.5 w-3.5" />
                Notes
              </>
            )}
          </span>
          <div className="flex items-center gap-1">
            {isPlannerView ? (
              <>
                {state.uiState.selectedPlannerPresetId && (
                  <button
                    type="button"
                    className="sidebar-add-btn"
                    onClick={() =>
                      dispatch({
                        type: "duplicate-planner-preset",
                        presetId: state.uiState.selectedPlannerPresetId!,
                      })
                    }
                    aria-label="Duplicate preset"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  className="sidebar-add-btn"
                  onClick={() => dispatch({ type: "create-planner-preset" })}
                  aria-label="New preset"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="sidebar-add-btn"
                  onClick={() => dispatch({ type: "create-note-folder" })}
                  aria-label="New folder"
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className="sidebar-add-btn"
                  onClick={() => dispatch({ type: "create-note" })}
                  aria-label="New note"
                >
                  <FilePlus2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveDraggedNoteId(null)}
      >
      <ScrollArea className="flex-1 min-h-0">
        {!mounted ? null : isDailyView ? (
          <div className="sidebar-tree">
            {Array.from(groupedYears.keys())
              .sort((a, b) => b.localeCompare(a))
              .map((year) => {
                const yearExpanded = state.uiState.expandedYears.includes(year);
                const months = groupedYears.get(year);
                return (
                  <div key={year} className="tree-group">
                    <button
                      type="button"
                      className="tree-toggle"
                      onClick={() => dispatch({ type: "toggle-year", year })}
                    >
                      {yearExpanded ? (
                        <FolderOpen className="h-3.5 w-3.5 tree-folder-icon" />
                      ) : (
                        <Folder className="h-3.5 w-3.5 tree-folder-icon" />
                      )}
                      <span>{year}</span>
                    </button>

                    {yearExpanded && months && (
                      <div className="tree-children">
                        {Array.from(months.keys())
                          .sort((a, b) => b.localeCompare(a))
                          .map((month) => {
                            const monthExpanded = state.uiState.expandedMonths.includes(month);
                            return (
                              <div key={month} className="tree-group">
                                <button
                                  type="button"
                                  className="tree-toggle"
                                  onClick={() => dispatch({ type: "toggle-month", month })}
                                >
                                  {monthExpanded ? (
                                    <FolderOpen className="h-3.5 w-3.5 tree-folder-icon" />
                                  ) : (
                                    <Folder className="h-3.5 w-3.5 tree-folder-icon" />
                                  )}
                                  <span>{getMonthLabel(month)}</span>
                                </button>
                                {monthExpanded && (
                                  <div className="tree-children">
                                    {(months.get(month) || [])
                                      .sort((a, b) => b.localeCompare(a))
                                      .map((date) => (
                                        <button
                                          key={date}
                                          type="button"
                                          className={cn(
                                            "tree-leaf",
                                            state.uiState.selectedDailyDate === date && "tree-leaf--active",
                                          )}
                                          onClick={() => dispatch({ type: "select-daily", date })}
                                        >
                                          {getDayLabel(date)}
                                        </button>
                                      ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        ) : isPlannerView ? (
          <div className="notes-list">
            {plannerPresets.map((preset) => (
              <div
                key={preset.id}
                className={cn(
                  "sidebar-item-row",
                  state.uiState.selectedPlannerPresetId === preset.id && "sidebar-item-row--active",
                )}
              >
                <button
                  type="button"
                  className={cn(
                    "note-item sidebar-item-button",
                    state.uiState.selectedPlannerPresetId === preset.id && "note-item--active",
                  )}
                  onClick={() => dispatch({ type: "select-planner-preset", presetId: preset.id })}
                >
                  <span className="note-item-title">{preset.name}</span>
                  <span className="note-item-date">
                    {new Date(preset.updatedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </button>
                <button
                  type="button"
                  className="sidebar-row-action sidebar-row-action--danger"
                  onClick={() => dispatch({ type: "delete-planner-preset", presetId: preset.id })}
                  aria-label={`Delete ${preset.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="notes-list">
            <NotesTree state={state} dispatch={dispatch} activeDraggedNoteId={activeDraggedNoteId} />
          </div>
        )}
      </ScrollArea>
      </DndContext>
      <div className="sidebar-footer">
        <div className="sidebar-footer-bar">
          <SidebarProfileMenu
            email={session?.email}
            hasUnsyncedChanges={sync.hasUnsyncedChanges}
            retrySync={retrySync}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={getThemeButtonLabel(themeMode)}
                className="sidebar-theme-button"
                onClick={() => dispatch({ type: "set-theme-mode", themeMode: nextThemeMode })}
              >
                <ThemeIcon className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {getThemeMenuLabel(themeMode)}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </aside>
  );
}

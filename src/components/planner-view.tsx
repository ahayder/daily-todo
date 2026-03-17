"use client";

import { useEffect, useMemo, useState, type Dispatch } from "react";
import type { AppAction } from "@/components/app-context";
import { cn } from "@/lib/utils";
import type {
  AppState,
  PlannerDayKey,
  PlannerEvent,
  PlannerEventColor,
} from "@/lib/types";
import { PLANNER_DAY_ORDER, PLANNER_EVENT_COLORS } from "@/lib/store";
import { Clock3, Layers3, Trash2 } from "lucide-react";

type Props = {
  state: AppState;
  dispatch: Dispatch<AppAction>;
};

type DragState = {
  dayKey: PlannerDayKey;
  startSlot: number;
  endSlot: number;
};

type SelectionState = {
  dayKey: PlannerDayKey;
  startSlot: number;
  endSlot: number;
};

type EditorState = {
  mode: "create" | "edit";
  dayKey: PlannerDayKey;
  eventId?: string;
  title: string;
  startMinutes: number;
  endMinutes: number;
  color: PlannerEventColor;
  notes: string;
  anchorTop: number;
};

type EventLayout = {
  event: PlannerEvent;
  column: number;
  columns: number;
};

const SLOT_MINUTES = 30;
const SLOT_HEIGHT = 18;
const TOTAL_SLOTS = 48;
const DAY_BODY_HEIGHT = SLOT_HEIGHT * TOTAL_SLOTS;
const POPOVER_HEIGHT = 312;

const COLOR_STYLES: Record<
  PlannerEventColor,
  { accent: string; bg: string; ring: string }
> = {
  teal: { accent: "#2f6d62", bg: "rgba(47, 109, 98, 0.16)", ring: "rgba(47, 109, 98, 0.28)" },
  gold: { accent: "#b48838", bg: "rgba(192, 124, 48, 0.18)", ring: "rgba(192, 124, 48, 0.3)" },
  rose: { accent: "#bb5b5b", bg: "rgba(192, 91, 91, 0.16)", ring: "rgba(192, 91, 91, 0.28)" },
  sage: { accent: "#4a7c59", bg: "rgba(74, 124, 89, 0.17)", ring: "rgba(74, 124, 89, 0.3)" },
  lavender: { accent: "#7c6ea8", bg: "rgba(124, 110, 168, 0.16)", ring: "rgba(124, 110, 168, 0.28)" },
};

const DAY_LABELS: Record<PlannerDayKey, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

function slotIndexToMinutes(slotIndex: number) {
  return slotIndex * SLOT_MINUTES;
}

function minutesToSlotIndex(minutes: number) {
  return Math.floor(minutes / SLOT_MINUTES);
}

function minutesToTimeLabel(minutes: number) {
  const safeMinutes = Math.max(0, Math.min(24 * 60, minutes));
  const hours24 = Math.floor(safeMinutes / 60) % 24;
  const mins = safeMinutes % 60;
  const suffix = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${String(mins).padStart(2, "0")} ${suffix}`;
}

function buildTimeOptions() {
  const options: Array<{ value: number; label: string }> = [];
  for (let slot = 0; slot <= TOTAL_SLOTS; slot += 1) {
    const value = slot * SLOT_MINUTES;
    options.push({ value, label: minutesToTimeLabel(value) });
  }
  return options;
}

function createEditorState(input: {
  mode: "create" | "edit";
  dayKey: PlannerDayKey;
  eventId?: string;
  title?: string;
  startMinutes: number;
  endMinutes: number;
  color?: PlannerEventColor;
  notes?: string;
  anchorTop: number;
}): EditorState {
  return {
    mode: input.mode,
    dayKey: input.dayKey,
    eventId: input.eventId,
    title: input.title ?? "",
    startMinutes: input.startMinutes,
    endMinutes: Math.max(input.startMinutes + SLOT_MINUTES, input.endMinutes),
    color: input.color ?? "teal",
    notes: input.notes ?? "",
    anchorTop: input.anchorTop,
  };
}

function computePopoverTop(anchorTop: number) {
  return Math.max(8, Math.min(anchorTop + 10, DAY_BODY_HEIGHT - POPOVER_HEIGHT - 8));
}

function computeEventLayouts(events: PlannerEvent[]): EventLayout[] {
  const sorted = [...events].sort(
    (a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes,
  );
  const layouts: EventLayout[] = [];
  let cluster: PlannerEvent[] = [];
  let clusterEnd = -1;

  const flushCluster = () => {
    if (!cluster.length) return;

    const active: Array<{ event: PlannerEvent; column: number }> = [];
    const clusterLayouts = new Map<string, EventLayout>();
    let maxColumns = 1;

    for (const event of cluster) {
      for (let index = active.length - 1; index >= 0; index -= 1) {
        if (active[index].event.endMinutes <= event.startMinutes) {
          active.splice(index, 1);
        }
      }

      let column = 0;
      while (active.some((item) => item.column === column)) {
        column += 1;
      }

      active.push({ event, column });
      maxColumns = Math.max(maxColumns, active.length);
      clusterLayouts.set(event.id, { event, column, columns: 1 });
    }

    cluster.forEach((event) => {
      const layout = clusterLayouts.get(event.id);
      if (layout) {
        layouts.push({ ...layout, columns: maxColumns });
      }
    });
  };

  for (const event of sorted) {
    if (!cluster.length) {
      cluster = [event];
      clusterEnd = event.endMinutes;
      continue;
    }

    if (event.startMinutes < clusterEnd) {
      cluster.push(event);
      clusterEnd = Math.max(clusterEnd, event.endMinutes);
      continue;
    }

    flushCluster();
    cluster = [event];
    clusterEnd = event.endMinutes;
  }

  flushCluster();
  return layouts;
}

export function PlannerView({ state, dispatch }: Props) {
  const presetId = state.uiState.selectedPlannerPresetId;
  const preset = presetId ? state.plannerPresets[presetId] : null;
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [selectionState, setSelectionState] = useState<SelectionState | null>(null);
  const [editorState, setEditorState] = useState<EditorState | null>(null);
  const timeOptions = useMemo(() => buildTimeOptions(), []);

  useEffect(() => {
    const handleMouseUp = () => {
      setDragState(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setEditorState(null);
        setSelectionState(null);
        setDragState(null);
      }
    };

    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const closeEditor = () => {
    setEditorState(null);
    setSelectionState(null);
    setDragState(null);
  };

  const openCreateEditor = (dayKey: PlannerDayKey, startSlot: number, endSlot: number) => {
    const normalizedStartSlot = Math.min(startSlot, endSlot);
    const normalizedEndSlot = Math.max(startSlot, endSlot);
    setSelectionState({
      dayKey,
      startSlot: normalizedStartSlot,
      endSlot: normalizedEndSlot,
    });
    setEditorState(
      createEditorState({
        mode: "create",
        dayKey,
        startMinutes: slotIndexToMinutes(normalizedStartSlot),
        endMinutes: slotIndexToMinutes(normalizedEndSlot + 1),
        anchorTop: normalizedStartSlot * SLOT_HEIGHT,
      }),
    );
  };

  const openEditEditor = (dayKey: PlannerDayKey, event: PlannerEvent) => {
    setSelectionState(null);
    setEditorState(
      createEditorState({
        mode: "edit",
        dayKey,
        eventId: event.id,
        title: event.title,
        startMinutes: event.startMinutes,
        endMinutes: event.endMinutes,
        color: event.color,
        notes: event.notes,
        anchorTop: minutesToSlotIndex(event.startMinutes) * SLOT_HEIGHT,
      }),
    );
  };

  const dayOrder = preset?.dayOrder ?? PLANNER_DAY_ORDER;

  if (!preset || !presetId) {
    return (
      <section className="empty-view-container">
        <div className="empty-view">
          <Layers3 className="mb-3 h-8 w-8 text-[var(--ink-700)] opacity-30" />
          <p className="text-sm text-[var(--ink-700)]">
            Create or select a weekly preset to start planning.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="planner-layout">
      <div className="planner-board">
        <div className="planner-grid-shell">
          <div className="planner-grid">
            <div className="planner-time-column">
              <div className="planner-time-header">Time</div>
              <div className="planner-time-slots">
                {Array.from({ length: TOTAL_SLOTS }, (_, slotIndex) => (
                  <div key={slotIndex} className="planner-time-slot">
                    {slotIndex % 2 === 0 ? (
                      <span>{minutesToTimeLabel(slotIndexToMinutes(slotIndex))}</span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            {dayOrder.map((dayKey) => {
              const day = preset.days[dayKey];
              const layouts = computeEventLayouts(day.events);

              return (
                <div key={dayKey} className="planner-day-column">
                  <div className="planner-day-header">
                    <span className="planner-day-label">{DAY_LABELS[dayKey]}</span>
                    <input
                      aria-label={`${DAY_LABELS[dayKey]} title`}
                      className="planner-day-title"
                      value={day.title}
                      onChange={(event) =>
                        dispatch({
                          type: "rename-planner-day",
                          presetId,
                          dayKey,
                          title: event.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="planner-day-body">
                    <div className="planner-day-slots">
                      {Array.from({ length: TOTAL_SLOTS }, (_, slotIndex) => {
                        const isDragging =
                          dragState?.dayKey === dayKey &&
                          slotIndex >= Math.min(dragState.startSlot, dragState.endSlot) &&
                          slotIndex <= Math.max(dragState.startSlot, dragState.endSlot);
                        const isSelected =
                          selectionState?.dayKey === dayKey &&
                          slotIndex >= selectionState.startSlot &&
                          slotIndex <= selectionState.endSlot;

                        return (
                          <button
                            key={slotIndex}
                            type="button"
                            data-testid={`planner-slot-${dayKey}-${slotIndex}`}
                            className={cn(
                              "planner-slot",
                              slotIndex % 2 === 0 && "planner-slot--hour",
                              isDragging && "planner-slot--draft",
                              isSelected && "planner-slot--selected",
                            )}
                            onMouseDown={() => {
                              setEditorState(null);
                              setSelectionState(null);
                              setDragState({ dayKey, startSlot: slotIndex, endSlot: slotIndex });
                            }}
                            onMouseEnter={() => {
                              if (!dragState || dragState.dayKey !== dayKey) return;
                              setDragState({ ...dragState, endSlot: slotIndex });
                            }}
                            onMouseUp={() => {
                              if (!dragState || dragState.dayKey !== dayKey) return;
                              openCreateEditor(dayKey, dragState.startSlot, dragState.endSlot);
                              setDragState(null);
                            }}
                          >
                            <span className="sr-only">
                              {DAY_LABELS[dayKey]} {minutesToTimeLabel(slotIndexToMinutes(slotIndex))}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="planner-events-layer">
                      {layouts.map(({ event, column, columns }) => {
                        const top = (event.startMinutes / SLOT_MINUTES) * SLOT_HEIGHT;
                        const height =
                          ((event.endMinutes - event.startMinutes) / SLOT_MINUTES) * SLOT_HEIGHT;
                        const gap = 6;
                        const width = `calc(${100 / columns}% - ${gap}px)`;
                        const left = `calc(${(100 / columns) * column}% + ${gap / 2}px)`;
                        const palette = COLOR_STYLES[event.color];

                        return (
                          <button
                            key={event.id}
                            type="button"
                            className={cn(
                              "planner-event-card",
                              editorState?.eventId === event.id && "planner-event-card--active",
                            )}
                            style={{
                              top,
                              height,
                              width,
                              left,
                              background: palette.bg,
                              borderColor: palette.ring,
                              color: palette.accent,
                            }}
                            onClick={() => openEditEditor(dayKey, event)}
                          >
                            <span className="planner-event-time">
                              {minutesToTimeLabel(event.startMinutes)} -{" "}
                              {minutesToTimeLabel(event.endMinutes)}
                            </span>
                            <span className="planner-event-title">{event.title}</span>
                            {event.notes ? (
                              <span className="planner-event-notes">{event.notes}</span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>

                    {editorState?.dayKey === dayKey ? (
                      <div
                        className="planner-popover"
                        style={{ top: computePopoverTop(editorState.anchorTop) }}
                        data-testid="planner-editor-popover"
                      >
                        <div className="planner-editor-header">
                          <div>
                            <p className="planner-editor-kicker">
                              {editorState.mode === "create" ? "New block" : "Edit block"}
                            </p>
                            <h2 className="planner-editor-title">{DAY_LABELS[editorState.dayKey]}</h2>
                          </div>
                          {editorState.mode === "edit" && editorState.eventId ? (
                            <button
                              type="button"
                              className="planner-editor-delete"
                              onClick={() => {
                                if (!editorState.eventId) return;
                                dispatch({
                                  type: "delete-planner-event",
                                  presetId,
                                  dayKey: editorState.dayKey,
                                  eventId: editorState.eventId,
                                });
                                closeEditor();
                              }}
                              aria-label="Delete planner block"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          ) : null}
                        </div>

                        <label className="planner-field">
                          <span>Block title</span>
                          <input
                            aria-label="Planner event title"
                            className="planner-text-input"
                            value={editorState.title}
                            onChange={(event) =>
                              setEditorState({ ...editorState, title: event.target.value })
                            }
                            placeholder="Deep work, sleep, family time..."
                          />
                        </label>

                        <div className="planner-field-grid">
                          <label className="planner-field">
                            <span>Start</span>
                            <select
                              aria-label="Planner event start time"
                              className="planner-select"
                              value={editorState.startMinutes}
                              onChange={(event) => {
                                const nextStart = Number(event.target.value);
                                setEditorState({
                                  ...editorState,
                                  startMinutes: nextStart,
                                  endMinutes: Math.max(nextStart + SLOT_MINUTES, editorState.endMinutes),
                                });
                              }}
                            >
                              {timeOptions.slice(0, -1).map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="planner-field">
                            <span>End</span>
                            <select
                              aria-label="Planner event end time"
                              className="planner-select"
                              value={editorState.endMinutes}
                              onChange={(event) =>
                                setEditorState({
                                  ...editorState,
                                  endMinutes: Number(event.target.value),
                                })
                              }
                            >
                              {timeOptions.slice(1).map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>

                        <div className="planner-field">
                          <span>Color</span>
                          <div className="planner-color-row">
                            {PLANNER_EVENT_COLORS.map((color) => {
                              const palette = COLOR_STYLES[color];
                              return (
                                <button
                                  key={color}
                                  type="button"
                                  aria-label={`Color ${color}`}
                                  className={cn(
                                    "planner-color-swatch",
                                    editorState.color === color && "planner-color-swatch--active",
                                  )}
                                  style={{
                                    background: palette.bg,
                                    color: palette.accent,
                                    borderColor: palette.ring,
                                  }}
                                  onClick={() => setEditorState({ ...editorState, color })}
                                >
                                  {color}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <label className="planner-field">
                          <span>Notes</span>
                          <textarea
                            aria-label="Planner event notes"
                            className="planner-textarea"
                            rows={3}
                            value={editorState.notes}
                            onChange={(event) =>
                              setEditorState({ ...editorState, notes: event.target.value })
                            }
                            placeholder="Optional notes, intention, or boundaries for this block."
                          />
                        </label>

                        <div className="planner-editor-preview">
                          <Clock3 className="h-4 w-4" />
                          <span>
                            {minutesToTimeLabel(editorState.startMinutes)} -{" "}
                            {minutesToTimeLabel(editorState.endMinutes)}
                          </span>
                        </div>

                        <div className="planner-editor-actions">
                          <button
                            type="button"
                            className="planner-secondary-btn"
                            onClick={closeEditor}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="planner-primary-btn"
                            onClick={() => {
                              if (editorState.mode === "create") {
                                dispatch({
                                  type: "create-planner-event",
                                  presetId,
                                  dayKey: editorState.dayKey,
                                  title: editorState.title,
                                  startMinutes: editorState.startMinutes,
                                  endMinutes: editorState.endMinutes,
                                  color: editorState.color,
                                  notes: editorState.notes,
                                });
                              } else if (editorState.eventId) {
                                dispatch({
                                  type: "update-planner-event",
                                  presetId,
                                  dayKey: editorState.dayKey,
                                  eventId: editorState.eventId,
                                  updates: {
                                    title: editorState.title,
                                    startMinutes: editorState.startMinutes,
                                    endMinutes: editorState.endMinutes,
                                    color: editorState.color,
                                    notes: editorState.notes,
                                  },
                                });
                              }
                              closeEditor();
                            }}
                          >
                            {editorState.mode === "create" ? "Save block" : "Update block"}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

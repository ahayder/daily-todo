"use client";

import {
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { AppAction } from "@/components/app/app-context";
import {
  assignPlannerEventLanes,
  buildPlannerAllocationSegments,
  clampPlannerMinute,
  formatPlannerDuration,
  formatPlannerTime,
  getDefaultPlannerSliceRange,
  getPlannerArcPath,
  getPlannerPoint,
  getPlannerPurposeScheduledMinutes,
  MINUTES_PER_DAY,
  plannerInputValueToMinutes,
  plannerMinutesToInputValue,
  PLANNER_SNAP_MINUTES,
  snapPlannerMinute,
} from "@/components/planner/planner-radial-utils";
import {
  createPlannerPurpose,
  makeId,
  PLANNER_DAY_ORDER,
  PLANNER_EVENT_COLORS,
} from "@/lib/store";
import type {
  AppState,
  PlannerDayKey,
  PlannerEvent,
  PlannerEventColor,
  PlannerPurpose,
  PlannerPurposeRole,
} from "@/lib/types";
import {
  CalendarClock,
  Clock3,
  Layers2,
  Layers3,
  PanelRightClose,
  PanelRightOpen,
  PieChart,
  Plus,
  Trash2,
} from "lucide-react";

type Props = {
  state: AppState;
  dispatch: Dispatch<AppAction>;
};

type PlannerMode = "schedule" | "allocate";

type PurposeDraft = {
  title: string;
  color: PlannerEventColor;
  targetMinutes: number;
  role: PlannerPurposeRole;
  notes: string;
};

type DragState = {
  eventId: string;
  edge: "start" | "end";
};

type DragPreview = {
  eventId: string;
  startMinutes: number;
  endMinutes: number;
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

const DAY_SHORT_LABELS: Record<PlannerDayKey, string> = {
  monday: "M",
  tuesday: "T",
  wednesday: "W",
  thursday: "T",
  friday: "F",
  saturday: "S",
  sunday: "S",
};

const COLOR_LABELS: Record<PlannerEventColor, string> = {
  teal: "Teal",
  gold: "Gold",
  rose: "Rose",
  sage: "Sage",
  lavender: "Lavender",
};

const COLOR_VARS: Record<PlannerEventColor, string> = {
  teal: "var(--planner-teal)",
  gold: "var(--planner-gold)",
  rose: "var(--planner-rose)",
  sage: "var(--planner-sage)",
  lavender: "var(--planner-lavender)",
};

const CLOCK_LABELS = [
  { minutes: 0, label: "12a" },
  { minutes: 6 * 60, label: "6a" },
  { minutes: 12 * 60, label: "12p" },
  { minutes: 18 * 60, label: "6p" },
];

const TIME_OPTIONS = Array.from(
  { length: MINUTES_PER_DAY / PLANNER_SNAP_MINUTES + 1 },
  (_, index) => {
    const value = index * PLANNER_SNAP_MINUTES;
    return { value, label: formatPlannerTime(value) };
  },
);

function purposeToDraft(purpose?: PlannerPurpose | null): PurposeDraft {
  return {
    title: purpose?.title ?? "",
    color: purpose?.color ?? "teal",
    targetMinutes: purpose?.targetMinutes ?? 60,
    role: purpose?.role ?? "primary",
    notes: purpose?.notes ?? "",
  };
}

function getPurposeStyle(color: PlannerEventColor): CSSProperties {
  return { "--planner-purpose-color": COLOR_VARS[color] } as CSSProperties;
}

function PurposeFields({
  draft,
  onChange,
}: {
  draft: PurposeDraft;
  onChange: (draft: PurposeDraft) => void;
}) {
  return (
    <div className="planner-purpose-fields">
      <label className="planner-field">
        <span>Main focus</span>
        <input
          aria-label="Planner main focus title"
          className="planner-text-input"
          value={draft.title}
          onChange={(event) => onChange({ ...draft, title: event.target.value })}
          placeholder="Work, health, family, rest..."
        />
      </label>

      <div className="planner-field-grid">
        <label className="planner-field">
          <span>Daily target</span>
          <div className="planner-hours-input-wrap">
            <input
              aria-label="Planner main focus target hours"
              className="planner-text-input"
              type="number"
              min="0"
              max="24"
              step="0.25"
              value={draft.targetMinutes / 60}
              onChange={(event) =>
                onChange({
                  ...draft,
                  targetMinutes: Math.min(
                    MINUTES_PER_DAY,
                    Math.max(0, Math.round(Number(event.target.value || 0) * 60)),
                  ),
                })
              }
            />
            <span>hours</span>
          </div>
        </label>

        <label className="planner-field">
          <span>Allocation</span>
          <select
            aria-label="Planner main focus allocation role"
            className="planner-select"
            value={draft.role}
            onChange={(event) =>
              onChange({ ...draft, role: event.target.value as PlannerPurposeRole })
            }
          >
            <option value="primary">Primary · counts toward 24h</option>
            <option value="secondary">Secondary · may overlap</option>
          </select>
        </label>
      </div>

      <div className="planner-field">
        <span>Color</span>
        <div className="planner-color-row">
          {PLANNER_EVENT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Color ${color}`}
              aria-pressed={draft.color === color}
              className="planner-color-swatch"
              style={getPurposeStyle(color)}
              onClick={() => onChange({ ...draft, color })}
            >
              <span className="planner-purpose-dot" />
              {COLOR_LABELS[color]}
            </button>
          ))}
        </div>
      </div>

      <label className="planner-field">
        <span>Notes</span>
        <textarea
          aria-label="Planner main focus notes"
          className="planner-textarea"
          rows={2}
          value={draft.notes}
          onChange={(event) => onChange({ ...draft, notes: event.target.value })}
          placeholder="Optional intention or boundary for this focus."
        />
      </label>
    </div>
  );
}

function PlannerDayPicker({
  selectedDayKey,
  selectedDays,
  onToggle,
  label,
}: {
  selectedDayKey: PlannerDayKey;
  selectedDays: PlannerDayKey[];
  onToggle: (dayKey: PlannerDayKey) => void;
  label: string;
}) {
  return (
    <div className="planner-apply-days">
      <span>{label}</span>
      <div className="planner-apply-day-grid">
        {PLANNER_DAY_ORDER.map((dayKey) => {
          const isSource = dayKey === selectedDayKey;
          return (
            <label key={dayKey} className="planner-apply-day">
              <input
                type="checkbox"
                checked={selectedDays.includes(dayKey)}
                disabled={isSource}
                aria-label={`${label} ${DAY_LABELS[dayKey]}`}
                onChange={() => onToggle(dayKey)}
              />
              <span title={DAY_LABELS[dayKey]}>{DAY_SHORT_LABELS[dayKey]}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export function PlannerView(props: Props) {
  const presetId = props.state.uiState.selectedPlannerPresetId;
  const preset = presetId ? props.state.plannerPresets[presetId] : null;

  if (!preset || !presetId) {
    return (
      <section className="empty-view-container">
        <div className="empty-view">
          <Layers3 className="mb-3 h-8 w-8 text-[var(--ink-700)] opacity-30" />
          <p className="text-sm text-[var(--ink-700)]">
            Create or select a daily plan to start planning.
          </p>
        </div>
      </section>
    );
  }

  return <PlannerPresetView key={presetId} {...props} />;
}

function PlannerPresetView({ state, dispatch }: Props) {
  const presetId = state.uiState.selectedPlannerPresetId!;
  const preset = state.plannerPresets[presetId];
  const initialDayKey = preset.dayOrder[0] ?? "monday";
  const initialDay = preset.days[initialDayKey];
  const initialPurpose = initialDay.purposes[0] ?? null;
  const [mode, setMode] = useState<PlannerMode>("schedule");
  const [selectedDayKey, setSelectedDayKey] = useState<PlannerDayKey>(initialDayKey);
  const [selectedPurposeId, setSelectedPurposeId] = useState<string | null>(
    initialPurpose?.id ?? null,
  );
  const [selectedEventId, setSelectedEventId] = useState<string | null>(
    initialDay.events.find((event) => event.purposeId === initialPurpose?.id)?.id ?? null,
  );
  const [isDetailsVisible, setIsDetailsVisible] = useState(true);
  const [isCreatingPurpose, setIsCreatingPurpose] = useState(false);
  const [purposeDraft, setPurposeDraft] = useState<PurposeDraft>(() =>
    purposeToDraft(initialPurpose),
  );
  const [applyDayKeys, setApplyDayKeys] = useState<PlannerDayKey[]>([initialDayKey]);
  const [dayTitleDraft, setDayTitleDraft] = useState(initialDay.title);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const chartRef = useRef<SVGSVGElement | null>(null);

  const effectiveDayKey = selectedDayKey;
  const day = preset.days[effectiveDayKey];
  const purposes = useMemo(() => day.purposes, [day.purposes]);
  const purposeById = useMemo(
    () => new Map(purposes.map((purpose) => [purpose.id, purpose])),
    [purposes],
  );
  const effectivePurposeId =
    selectedPurposeId && purposeById.has(selectedPurposeId)
      ? selectedPurposeId
      : purposes[0]?.id ?? null;
  const selectedPurpose = effectivePurposeId ? purposeById.get(effectivePurposeId) ?? null : null;
  const purposeEvents = useMemo(
    () =>
      day && effectivePurposeId
        ? day.events.filter((event) => event.purposeId === effectivePurposeId)
        : [],
    [day, effectivePurposeId],
  );
  const effectiveEventId =
    selectedEventId && purposeEvents.some((event) => event.id === selectedEventId)
      ? selectedEventId
      : purposeEvents[0]?.id ?? null;

  const displayEvents = useMemo(
    () =>
      day.events.map((event) =>
        dragPreview?.eventId === event.id
          ? {
              ...event,
              startMinutes: dragPreview.startMinutes,
              endMinutes: dragPreview.endMinutes,
            }
          : event,
      ),
    [day.events, dragPreview],
  );
  const eventLayouts = useMemo(() => assignPlannerEventLanes(displayEvents), [displayEvents]);
  const laneCount = Math.max(1, ...eventLayouts.map((layout) => layout.lane + 1));
  const allocationSegments = useMemo(
    () => buildPlannerAllocationSegments(purposes),
    [purposes],
  );
  const primaryAllocatedMinutes = purposes.reduce(
    (total, purpose) =>
      purpose.role === "primary" ? total + purpose.targetMinutes : total,
    0,
  );
  const selectedScheduledMinutes = selectedPurpose
    ? getPlannerPurposeScheduledMinutes(displayEvents, selectedPurpose.id)
    : 0;
  const selectedDisplayEvent = effectiveEventId
    ? displayEvents.find((event) => event.id === effectiveEventId) ?? null
    : null;

  const selectPurpose = (purposeId: string) => {
    const purpose = day.purposes.find((candidate) => candidate.id === purposeId) ?? null;
    setSelectedPurposeId(purposeId);
    const firstEvent = day.events.find((event) => event.purposeId === purposeId);
    setSelectedEventId(firstEvent?.id ?? null);
    setPurposeDraft(purposeToDraft(purpose));
    setApplyDayKeys([effectiveDayKey]);
    setIsCreatingPurpose(false);
  };

  const selectTimeBlock = (purposeId: string, eventId: string) => {
    selectPurpose(purposeId);
    setSelectedEventId(eventId);
  };

  const selectDay = (dayKey: PlannerDayKey) => {
    const nextDay = preset.days[dayKey];
    const nextPurpose = nextDay.purposes[0] ?? null;
    setSelectedDayKey(dayKey);
    setSelectedPurposeId(nextPurpose?.id ?? null);
    setSelectedEventId(
      nextDay.events.find((event) => event.purposeId === nextPurpose?.id)?.id ?? null,
    );
    setPurposeDraft(purposeToDraft(nextPurpose));
    setApplyDayKeys([dayKey]);
    setDayTitleDraft(nextDay.title);
    setIsCreatingPurpose(false);
    setDragPreview(null);
    dragStateRef.current = null;
  };

  const toggleApplyDay = (dayKey: PlannerDayKey) => {
    if (dayKey === effectiveDayKey) return;
    setApplyDayKeys((current) =>
      current.includes(dayKey)
        ? current.filter((candidate) => candidate !== dayKey)
        : [...current, dayKey],
    );
  };

  const savePurpose = () => {
    if (!selectedPurpose || !purposeDraft.title.trim()) return;
    dispatch({
      type: "update-planner-purpose",
      presetId,
      dayKey: effectiveDayKey,
      purposeId: selectedPurpose.id,
      updates: purposeDraft,
    });
  };

  const saveAndApplyPurpose = () => {
    if (!selectedPurpose || !purposeDraft.title.trim()) return;
    savePurpose();
    dispatch({
      type: "apply-planner-purpose-to-days",
      presetId,
      sourceDayKey: effectiveDayKey,
      purposeId: selectedPurpose.id,
      targetDayKeys: applyDayKeys,
    });
  };

  const createPurpose = () => {
    if (!purposeDraft.title.trim()) return;
    const purpose = createPlannerPurpose(purposeDraft);
    const dayKeys = applyDayKeys.includes(effectiveDayKey)
      ? applyDayKeys
      : [effectiveDayKey, ...applyDayKeys];
    dispatch({
      type: "create-planner-purpose",
      presetId,
      purpose,
      dayKeys,
    });
    setSelectedPurposeId(purpose.id);
    setSelectedEventId(null);
    setIsCreatingPurpose(false);
  };

  const addSlice = () => {
    if (!selectedPurpose) return;
    const range = getDefaultPlannerSliceRange(day.events);
    const eventId = makeId("planner-event");
    dispatch({
      type: "create-planner-event",
      presetId,
      eventId,
      dayKey: effectiveDayKey,
      purposeId: selectedPurpose.id,
      startMinutes: range.startMinutes,
      endMinutes: range.endMinutes,
    });
    setSelectedEventId(eventId);
  };

  const updateEventRange = (
    event: PlannerEvent,
    startMinutes: number,
    endMinutes: number,
  ) => {
    const start = Math.min(MINUTES_PER_DAY - PLANNER_SNAP_MINUTES, startMinutes);
    const end = Math.min(
      MINUTES_PER_DAY,
      Math.max(start + PLANNER_SNAP_MINUTES, endMinutes),
    );
    dispatch({
      type: "update-planner-event",
      presetId,
      dayKey: effectiveDayKey,
      eventId: event.id,
      updates: { startMinutes: start, endMinutes: end },
    });
  };

  const startHandleDrag = (
    event: ReactPointerEvent<SVGCircleElement>,
    plannerEvent: PlannerEvent,
    edge: DragState["edge"],
  ) => {
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // SVG-level pointer events still work when pointer capture is unavailable.
    }
    dragStateRef.current = { eventId: plannerEvent.id, edge };
    setDragPreview({
      eventId: plannerEvent.id,
      startMinutes: plannerEvent.startMinutes,
      endMinutes: plannerEvent.endMinutes,
    });
  };

  const getPointerMinutes = (event: ReactPointerEvent<SVGSVGElement>) => {
    const bounds = chartRef.current?.getBoundingClientRect();
    if (!bounds) return 0;
    const x = ((event.clientX - bounds.left) / bounds.width) * 600;
    const y = ((event.clientY - bounds.top) / bounds.height) * 600;
    let angle = Math.atan2(y - 300, x - 300) + Math.PI / 2;
    if (angle < 0) angle += Math.PI * 2;
    return snapPlannerMinute((angle / (Math.PI * 2)) * MINUTES_PER_DAY);
  };

  const handleChartPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState) return;
    const plannerEvent = displayEvents.find((candidate) => candidate.id === dragState.eventId);
    if (!plannerEvent) return;
    const nextMinutes = getPointerMinutes(event);
    setDragPreview({
      eventId: plannerEvent.id,
      startMinutes:
        dragState.edge === "start"
          ? Math.min(nextMinutes, plannerEvent.endMinutes - PLANNER_SNAP_MINUTES)
          : plannerEvent.startMinutes,
      endMinutes:
        dragState.edge === "end"
          ? Math.max(nextMinutes, plannerEvent.startMinutes + PLANNER_SNAP_MINUTES)
          : plannerEvent.endMinutes,
    });
  };

  const finishHandleDrag = () => {
    const preview = dragPreview;
    const event = preview
      ? day.events.find((candidate) => candidate.id === preview.eventId)
      : null;
    if (preview && event) {
      updateEventRange(event, preview.startMinutes, preview.endMinutes);
    }
    dragStateRef.current = null;
    setDragPreview(null);
  };

  const nudgeHandle = (
    keyboardEvent: ReactKeyboardEvent<SVGCircleElement>,
    event: PlannerEvent,
    edge: DragState["edge"],
  ) => {
    const delta =
      keyboardEvent.key === "ArrowLeft" || keyboardEvent.key === "ArrowDown"
        ? -PLANNER_SNAP_MINUTES
        : keyboardEvent.key === "ArrowRight" || keyboardEvent.key === "ArrowUp"
          ? PLANNER_SNAP_MINUTES
          : 0;
    if (!delta) return;
    keyboardEvent.preventDefault();
    if (edge === "start") {
      updateEventRange(
        event,
        clampPlannerMinute(
          Math.min(event.startMinutes + delta, event.endMinutes - PLANNER_SNAP_MINUTES),
          MINUTES_PER_DAY - PLANNER_SNAP_MINUTES,
        ),
        event.endMinutes,
      );
    } else {
      updateEventRange(
        event,
        event.startMinutes,
        clampPlannerMinute(
          Math.max(event.endMinutes + delta, event.startMinutes + PLANNER_SNAP_MINUTES),
        ),
      );
    }
  };

  const bandGap = laneCount > 8 ? 1 : laneCount > 5 ? 2 : 4;
  const bandWidth = Math.max(
    3,
    Math.min(54, (100 - bandGap * (laneCount - 1)) / laneCount),
  );
  const laneRadius = (lane: number) => {
    const inner = 164 + lane * (bandWidth + bandGap);
    return { inner, outer: inner + bandWidth, center: inner + bandWidth / 2 };
  };
  const selectedLayout = eventLayouts.find((layout) => layout.event.id === effectiveEventId);
  const selectedEventForHandles = selectedLayout?.event ?? null;
  const allocatedDifference = MINUTES_PER_DAY - primaryAllocatedMinutes;

  return (
    <section className="planner-layout">
      <div className="planner-radial-board">
        <header className="planner-radial-header">
          <div>
            <p className="planner-kicker">{preset.name}</p>
            <h1>Your daily rhythm</h1>
            <p>Set your main focuses, then place each child block on the 24-hour clock.</p>
          </div>
          <div className="planner-header-actions">
            <button
              type="button"
              className="planner-secondary-btn planner-add-purpose"
              onClick={() => {
                setPurposeDraft(purposeToDraft());
                setApplyDayKeys([effectiveDayKey]);
                setIsCreatingPurpose(true);
                setIsDetailsVisible(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Add focus
            </button>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="planner-details-toggle"
                  aria-label={isDetailsVisible ? "Hide planner details" : "Show planner details"}
                  onClick={() => setIsDetailsVisible((visible) => !visible)}
                >
                  {isDetailsVisible ? (
                    <PanelRightClose className="h-4 w-4" />
                  ) : (
                    <PanelRightOpen className="h-4 w-4" />
                  )}
                  <span>{isDetailsVisible ? "Hide details" : "Show details"}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {isDetailsVisible ? "Give the wheel more room" : "Open focus details"}
              </TooltipContent>
            </Tooltip>
          </div>
        </header>

        <div className="planner-radial-controls">
          <div className="planner-mode-toggle" aria-label="Planner mode">
            <button
              type="button"
              aria-pressed={mode === "schedule"}
              onClick={() => setMode("schedule")}
            >
              <CalendarClock className="h-4 w-4" />
              Schedule
            </button>
            <button
              type="button"
              aria-pressed={mode === "allocate"}
              onClick={() => setMode("allocate")}
            >
              <PieChart className="h-4 w-4" />
              Allocate
            </button>
          </div>

          <div className="planner-day-tabs" aria-label="Planner day">
            {preset.dayOrder.map((dayKey) => (
              <button
                key={dayKey}
                type="button"
                aria-label={DAY_LABELS[dayKey]}
                aria-pressed={effectiveDayKey === dayKey}
                onClick={() => selectDay(dayKey)}
              >
                <span className="planner-day-full-label">{DAY_LABELS[dayKey]}</span>
                <span className="planner-day-short-label">{DAY_SHORT_LABELS[dayKey]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className={`planner-radial-stage${isDetailsVisible ? "" : " planner-radial-stage--wide"}`}>
          <div className="planner-wheel-panel">
            <div className="planner-wheel-header">
              <label>
                <span>{DAY_LABELS[effectiveDayKey]}</span>
                <input
                  aria-label={`${DAY_LABELS[effectiveDayKey]} title`}
                  value={dayTitleDraft}
                  onChange={(event) => setDayTitleDraft(event.target.value)}
                  onBlur={() =>
                    dispatch({
                      type: "rename-planner-day",
                      presetId,
                      dayKey: effectiveDayKey,
                      title: dayTitleDraft,
                    })
                  }
                />
              </label>
              {mode === "schedule" ? (
                <span className="planner-wheel-status">
                  <Layers2 className="h-4 w-4" />
                  {laneCount === 1 ? "No overlaps" : `${laneCount} overlap lanes`}
                </span>
              ) : (
                <span
                  className={`planner-wheel-status${allocatedDifference < 0 ? " planner-wheel-status--warning" : ""}`}
                >
                  {allocatedDifference >= 0
                    ? `${formatPlannerDuration(allocatedDifference)} open`
                    : `${formatPlannerDuration(Math.abs(allocatedDifference))} over`}
                </span>
              )}
            </div>

            <div className="planner-wheel-wrap">
              <svg
                ref={chartRef}
                className="planner-wheel"
                viewBox="0 0 600 600"
                role="img"
                aria-label={
                  mode === "schedule"
                    ? `${DAY_LABELS[effectiveDayKey]} radial schedule`
                    : `${DAY_LABELS[effectiveDayKey]} focus allocation`
                }
                onPointerMove={handleChartPointerMove}
                onPointerUp={finishHandleDrag}
                onPointerCancel={finishHandleDrag}
              >
                <title id="planner-wheel-title">
                  {mode === "schedule"
                    ? `${DAY_LABELS[effectiveDayKey]} radial schedule`
                    : `${DAY_LABELS[effectiveDayKey]} focus allocation`}
                </title>
                <desc id="planner-wheel-description">
                  {mode === "schedule"
                    ? "A 24-hour radial timeline. Main focuses may contain multiple child blocks, and overlapping blocks use additional rings."
                    : "A daily allocation chart where primary focus targets share a 24-hour budget."}
                </desc>

                {mode === "schedule" ? (
                  <>
                    {Array.from({ length: 24 }, (_, hour) => {
                      const minutes = hour * 60;
                      const inner = getPlannerPoint(minutes, hour % 6 === 0 ? 270 : 275);
                      const outer = getPlannerPoint(minutes, 284);
                      return (
                        <line
                          key={hour}
                          className={`planner-wheel-tick${hour % 6 === 0 ? " planner-wheel-tick--major" : ""}`}
                          x1={inner.x}
                          y1={inner.y}
                          x2={outer.x}
                          y2={outer.y}
                        />
                      );
                    })}
                    {CLOCK_LABELS.map(({ minutes, label }) => {
                      const point = getPlannerPoint(minutes, 294);
                      return (
                        <text
                          key={minutes}
                          className="planner-wheel-hour-label"
                          x={point.x}
                          y={point.y}
                        >
                          {label}
                        </text>
                      );
                    })}
                    {Array.from({ length: laneCount }, (_, lane) => {
                      const radii = laneRadius(lane);
                      return (
                        <circle
                          key={lane}
                          className="planner-wheel-track"
                          cx="300"
                          cy="300"
                          r={(radii.inner + radii.outer) / 2}
                          strokeWidth={radii.outer - radii.inner}
                        />
                      );
                    })}
                    {eventLayouts.map(({ event, lane }) => {
                      const purpose = event.purposeId ? purposeById.get(event.purposeId) : null;
                      const radii = laneRadius(lane);
                      const isSelected = purpose?.id === effectivePurposeId;
                      return (
                        <path
                          key={event.id}
                          role="button"
                          tabIndex={0}
                          aria-label={`${event.title}, under ${purpose?.title ?? "No main focus"}, ${formatPlannerTime(event.startMinutes)} to ${formatPlannerTime(event.endMinutes)}`}
                          className={`planner-wheel-arc${isSelected ? " planner-wheel-arc--selected" : " planner-wheel-arc--muted"}`}
                          d={getPlannerArcPath(
                            event.startMinutes,
                            event.endMinutes,
                            radii.inner,
                            radii.outer,
                          )}
                          fill={COLOR_VARS[purpose?.color ?? event.color]}
                          onClick={() => {
                            if (event.purposeId) selectTimeBlock(event.purposeId, event.id);
                            setSelectedEventId(event.id);
                            setIsDetailsVisible(true);
                          }}
                          onKeyDown={(keyboardEvent) => {
                            if (keyboardEvent.key !== "Enter" && keyboardEvent.key !== " ") return;
                            keyboardEvent.preventDefault();
                            if (event.purposeId) selectTimeBlock(event.purposeId, event.id);
                            setSelectedEventId(event.id);
                            setIsDetailsVisible(true);
                          }}
                        >
                          <title>
                            {event.title} · {purpose?.title ?? "No main focus"}: {formatPlannerTime(event.startMinutes)} – {formatPlannerTime(event.endMinutes)}
                          </title>
                        </path>
                      );
                    })}
                  </>
                ) : (
                  <>
                    <circle
                      className="planner-wheel-track"
                      cx="300"
                      cy="300"
                      r="207"
                      strokeWidth="86"
                    />
                    {allocationSegments.map((segment) => (
                      <path
                        key={segment.purpose.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`${segment.purpose.title}, ${formatPlannerDuration(segment.purpose.targetMinutes)} daily target`}
                        className={`planner-wheel-arc${segment.purpose.id === effectivePurposeId ? " planner-wheel-arc--selected" : " planner-wheel-arc--muted"}`}
                        d={getPlannerArcPath(
                          segment.startMinutes,
                          segment.endMinutes,
                          164,
                          250,
                        )}
                        fill={COLOR_VARS[segment.purpose.color]}
                        onClick={() => {
                          selectPurpose(segment.purpose.id);
                          setIsDetailsVisible(true);
                        }}
                        onKeyDown={(keyboardEvent) => {
                          if (keyboardEvent.key !== "Enter" && keyboardEvent.key !== " ") return;
                          keyboardEvent.preventDefault();
                          selectPurpose(segment.purpose.id);
                          setIsDetailsVisible(true);
                        }}
                      >
                        <title>
                          {segment.purpose.title}: {formatPlannerDuration(segment.purpose.targetMinutes)}
                        </title>
                      </path>
                    ))}
                  </>
                )}

                <circle className="planner-wheel-center" cx="300" cy="300" r="146" />
                <text className="planner-wheel-center-day" x="300" y="245">
                  {DAY_LABELS[effectiveDayKey]}
                </text>
                <text className="planner-wheel-center-title" x="300" y="286">
                  {selectedPurpose?.title ?? "No main focuses yet"}
                </text>
                <text className="planner-wheel-center-total" x="300" y="340">
                  {selectedPurpose
                    ? formatPlannerDuration(
                        mode === "schedule"
                          ? selectedScheduledMinutes
                          : selectedPurpose.targetMinutes,
                      )
                    : "24h"}
                </text>
                <text className="planner-wheel-center-sub" x="300" y="372">
                  {selectedPurpose
                    ? mode === "schedule"
                      ? `${purposeEvents.length} ${purposeEvents.length === 1 ? "block" : "blocks"} today`
                      : selectedPurpose.role === "primary"
                        ? "daily primary target"
                        : "secondary · may overlap"
                    : "waiting to be shaped"}
                </text>

                {mode === "schedule" && selectedEventForHandles ? (
                  <>
                    {(["start", "end"] as const).map((edge) => {
                      const radii = laneRadius(selectedLayout?.lane ?? 0);
                      const value =
                        edge === "start"
                          ? selectedEventForHandles.startMinutes
                          : selectedEventForHandles.endMinutes;
                      const point = getPlannerPoint(value, radii.center);
                      return (
                        <circle
                          key={edge}
                          role="slider"
                          tabIndex={0}
                          aria-label={`Adjust ${edge} time for ${selectedPurpose?.title ?? selectedEventForHandles.title}`}
                          aria-valuemin={0}
                          aria-valuemax={MINUTES_PER_DAY}
                          aria-valuenow={value}
                          aria-valuetext={formatPlannerTime(value)}
                          data-testid={`planner-drag-handle-${edge}`}
                          className="planner-wheel-handle"
                          cx={point.x}
                          cy={point.y}
                          r="11"
                          onPointerDown={(event) =>
                            startHandleDrag(event, selectedEventForHandles, edge)
                          }
                          onKeyDown={(event) =>
                            nudgeHandle(event, selectedEventForHandles, edge)
                          }
                        >
                          <title>Drag or use arrow keys to adjust {edge} time</title>
                        </circle>
                      );
                    })}
                  </>
                ) : null}
              </svg>
            </div>

            <div className="planner-wheel-legend" aria-label="Purpose colors">
              {purposes.map((purpose) => (
                <button
                  key={purpose.id}
                  type="button"
                  aria-pressed={purpose.id === effectivePurposeId}
                  style={getPurposeStyle(purpose.color)}
                  onClick={() => selectPurpose(purpose.id)}
                >
                  <span className="planner-purpose-dot" />
                  {purpose.title}
                  {purpose.role === "secondary" ? <small>overlap</small> : null}
                </button>
              ))}
            </div>
          </div>

          {isDetailsVisible ? (
            <aside className="planner-details-panel" aria-label="Planner details">
              <div className="planner-details-header">
                <div>
                  <p className="planner-editor-kicker">
                    {isCreatingPurpose ? "New main focus" : "Day structure"}
                  </p>
                  <h2>{isCreatingPurpose ? "Shape a daily allocation" : "Main focuses"}</h2>
                </div>
              </div>

              {!isCreatingPurpose ? (
                <div
                  className="planner-purpose-list"
                  aria-label="Main focuses and child time blocks"
                >
                  {purposes.map((purpose) => {
                    const scheduledMinutes = getPlannerPurposeScheduledMinutes(day.events, purpose.id);
                    const childBlocks = day.events.filter(
                      (event) => event.purposeId === purpose.id,
                    );
                    return (
                      <div
                        key={purpose.id}
                        className="planner-focus-group"
                        style={getPurposeStyle(purpose.color)}
                      >
                        <button
                          type="button"
                          className="planner-focus-row"
                          aria-pressed={purpose.id === effectivePurposeId}
                          onClick={() => selectPurpose(purpose.id)}
                        >
                          <span className="planner-purpose-dot" />
                          <strong>{purpose.title}</strong>
                          <span>
                            {mode === "schedule"
                              ? formatPlannerDuration(scheduledMinutes)
                              : formatPlannerDuration(purpose.targetMinutes)}
                          </span>
                        </button>
                        {mode === "schedule" && childBlocks.length ? (
                          <div className="planner-child-blocks">
                            {childBlocks.map((event) => (
                              <button
                                key={event.id}
                                type="button"
                                className="planner-child-block"
                                aria-label={`${event.title}, ${formatPlannerTime(event.startMinutes)} to ${formatPlannerTime(event.endMinutes)}, under ${purpose.title}`}
                                aria-pressed={event.id === effectiveEventId}
                                onClick={() => selectTimeBlock(purpose.id, event.id)}
                              >
                                <span className="planner-child-block-marker" />
                                <span>{event.title}</span>
                                <small>
                                  {formatPlannerTime(event.startMinutes)}–{formatPlannerTime(event.endMinutes)}
                                </small>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                  {!purposes.length ? (
                    <p className="planner-purpose-empty">No main focuses on {DAY_LABELS[effectiveDayKey]} yet.</p>
                  ) : null}
                </div>
              ) : null}

              {isCreatingPurpose ? (
                <div className="planner-purpose-editor">
                  <PurposeFields draft={purposeDraft} onChange={setPurposeDraft} />
                  <PlannerDayPicker
                    selectedDayKey={effectiveDayKey}
                    selectedDays={applyDayKeys}
                    onToggle={toggleApplyDay}
                    label="Create on"
                  />
                  <div className="planner-editor-actions">
                    <button
                      type="button"
                      className="planner-secondary-btn"
                      onClick={() => {
                        setIsCreatingPurpose(false);
                        setPurposeDraft(purposeToDraft(selectedPurpose));
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="planner-primary-btn"
                      disabled={!purposeDraft.title.trim()}
                      onClick={createPurpose}
                    >
                      Create main focus
                    </button>
                  </div>
                </div>
              ) : selectedPurpose ? (
                <div className="planner-purpose-editor">
                  <PurposeFields draft={purposeDraft} onChange={setPurposeDraft} />
                  <button
                    type="button"
                    className="planner-primary-btn planner-save-purpose"
                    disabled={!purposeDraft.title.trim()}
                    onClick={savePurpose}
                  >
                    Save main focus
                  </button>

                  {mode === "schedule" ? (
                    <div className="planner-slices-section">
                      <div className="planner-section-heading">
                        <div>
                          <span>Child time blocks</span>
                          <small>Each block belongs to this main focus.</small>
                        </div>
                        <button type="button" onClick={addSlice}>
                          <Plus className="h-4 w-4" />
                          Add block
                        </button>
                      </div>

                      <div className="planner-slice-tabs">
                        {purposeEvents.map((event) => (
                          <button
                            key={event.id}
                            type="button"
                            aria-pressed={event.id === effectiveEventId}
                            onClick={() => setSelectedEventId(event.id)}
                          >
                            {event.title}
                            <small>{formatPlannerDuration(event.endMinutes - event.startMinutes)}</small>
                          </button>
                        ))}
                      </div>

                      {selectedDisplayEvent ? (
                        <div className="planner-slice-editor">
                          <label className="planner-field" key={selectedDisplayEvent.id}>
                            <span>Time block label</span>
                            <input
                              aria-label="Planner time block title"
                              className="planner-text-input"
                              defaultValue={selectedDisplayEvent.title}
                              onBlur={(event) => {
                                const title = event.currentTarget.value.trim();
                                if (!title || title === selectedDisplayEvent.title) return;
                                dispatch({
                                  type: "update-planner-event",
                                  presetId,
                                  dayKey: effectiveDayKey,
                                  eventId: selectedDisplayEvent.id,
                                  updates: { title },
                                });
                              }}
                            />
                          </label>
                          <div className="planner-field-grid">
                            <label className="planner-field">
                              <span>Start</span>
                              <select
                                aria-label="Planner time block start time"
                                className="planner-select"
                                value={plannerMinutesToInputValue(selectedDisplayEvent.startMinutes)}
                                onChange={(event) => {
                                  const nextStart = plannerInputValueToMinutes(event.target.value);
                                  updateEventRange(
                                    selectedDisplayEvent,
                                    Math.min(
                                      nextStart,
                                      selectedDisplayEvent.endMinutes - PLANNER_SNAP_MINUTES,
                                    ),
                                    selectedDisplayEvent.endMinutes,
                                  );
                                }}
                              >
                                {TIME_OPTIONS.slice(0, -1).map((option) => (
                                  <option
                                    key={option.value}
                                    value={plannerMinutesToInputValue(option.value)}
                                  >
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="planner-field">
                              <span>End</span>
                              <select
                                aria-label="Planner time block end time"
                                className="planner-select"
                                value={
                                  selectedDisplayEvent.endMinutes === MINUTES_PER_DAY
                                    ? "24:00"
                                    : plannerMinutesToInputValue(selectedDisplayEvent.endMinutes)
                                }
                                onChange={(event) => {
                                  const nextEnd =
                                    event.target.value === "24:00"
                                      ? MINUTES_PER_DAY
                                      : plannerInputValueToMinutes(event.target.value);
                                  updateEventRange(
                                    selectedDisplayEvent,
                                    selectedDisplayEvent.startMinutes,
                                    Math.max(
                                      nextEnd,
                                      selectedDisplayEvent.startMinutes + PLANNER_SNAP_MINUTES,
                                    ),
                                  );
                                }}
                              >
                                {TIME_OPTIONS.slice(1).map((option) => (
                                  <option
                                    key={option.value}
                                    value={
                                      option.value === MINUTES_PER_DAY
                                        ? "24:00"
                                        : plannerMinutesToInputValue(option.value)
                                    }
                                  >
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                          <div className="planner-slice-summary">
                            <Clock3 className="h-4 w-4" />
                            <span>
                              {formatPlannerTime(selectedDisplayEvent.startMinutes)} – {formatPlannerTime(selectedDisplayEvent.endMinutes)}
                            </span>
                            <strong>
                              {formatPlannerDuration(
                                selectedDisplayEvent.endMinutes - selectedDisplayEvent.startMinutes,
                              )}
                            </strong>
                          </div>
                          <AlertDialog>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertDialogTrigger
                                  aria-label="Delete selected time block"
                                  className="planner-delete-slice"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete block
                                </AlertDialogTrigger>
                              </TooltipTrigger>
                              <TooltipContent>Delete this time block</TooltipContent>
                            </Tooltip>
                            <AlertDialogContent className="alert-dialog-content">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="font-semibold text-[var(--ink-900)]">
                                  Delete this time block?
                                </AlertDialogTitle>
                                <AlertDialogDescription className="text-[var(--ink-700)]">
                                  The main focus remains, but this scheduled block will be removed.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="alert-dialog-cancel">Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="alert-dialog-destructive"
                                  onClick={() => {
                                    dispatch({
                                      type: "delete-planner-event",
                                      presetId,
                                      dayKey: effectiveDayKey,
                                      eventId: selectedDisplayEvent.id,
                                    });
                                    setSelectedEventId(null);
                                  }}
                                >
                                  Delete block
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      ) : (
                        <p className="planner-slice-empty">Add a block, then drag its handles around the wheel.</p>
                      )}
                    </div>
                  ) : (
                    <div className="planner-allocation-explainer">
                      <PieChart className="h-5 w-5" />
                      <p>
                        Primary focus targets share the 24-hour budget. Secondary focuses can overlap without increasing that total.
                      </p>
                    </div>
                  )}

                  <PlannerDayPicker
                    selectedDayKey={effectiveDayKey}
                    selectedDays={applyDayKeys}
                    onToggle={toggleApplyDay}
                    label="Copy current setup to"
                  />
                  <button
                    type="button"
                    className="planner-secondary-btn planner-apply-purpose"
                    disabled={applyDayKeys.length <= 1 || !purposeDraft.title.trim()}
                    onClick={saveAndApplyPurpose}
                  >
                    Apply to selected days
                  </button>

                  <AlertDialog>
                    <AlertDialogTrigger className="planner-delete-purpose">
                      <Trash2 className="h-4 w-4" />
                      Delete main focus from {DAY_LABELS[effectiveDayKey]}
                    </AlertDialogTrigger>
                    <AlertDialogContent className="alert-dialog-content">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="font-semibold text-[var(--ink-900)]">
                          Delete {selectedPurpose.title}?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-[var(--ink-700)]">
                          This removes the main focus and all of its child time blocks from {DAY_LABELS[effectiveDayKey]}. Other days are unchanged.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="alert-dialog-cancel">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="alert-dialog-destructive"
                          onClick={() => {
                            const nextPurpose = purposes.find(
                              (purpose) => purpose.id !== selectedPurpose.id,
                            );
                            dispatch({
                              type: "delete-planner-purpose",
                              presetId,
                              dayKey: effectiveDayKey,
                              purposeId: selectedPurpose.id,
                            });
                            setSelectedPurposeId(nextPurpose?.id ?? null);
                            setSelectedEventId(
                              day.events.find(
                                (event) => event.purposeId === nextPurpose?.id,
                              )?.id ?? null,
                            );
                            setPurposeDraft(purposeToDraft(nextPurpose));
                            setApplyDayKeys([effectiveDayKey]);
                          }}
                        >
                          Delete main focus
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ) : (
                <button
                  type="button"
                  className="planner-empty-add"
                  onClick={() => {
                    setPurposeDraft(purposeToDraft());
                    setApplyDayKeys([effectiveDayKey]);
                    setIsCreatingPurpose(true);
                  }}
                >
                  <Plus className="h-5 w-5" />
                  Add the first main focus
                </button>
              )}
            </aside>
          ) : null}
        </div>
      </div>
    </section>
  );
}
